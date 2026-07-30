import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, productSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { addProductPhoto, assertPhotoMutablePreCheck } from '../../services/products/product-photos.js';
import { assertProductCreationEligible } from '../../services/products/product-creation-eligibility.js';
import { processProductUpload } from '../../services/products/product-image-processor.js';
import {
  newQuarantineRequestId,
  quarantineDirKey,
  removeKeyPrefix,
  writeQuarantineFile,
} from '../../services/products/product-media-storage.js';
import {
  reconcileMediaCapacityReservation,
  releaseMediaCapacityReservation,
  reserveMediaCapacity,
} from '../../services/products/product-media-capacity.js';

const paramSchema = z.object({ productId: z.string().uuid() });

function validationError(title: string): never {
  throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title });
}

export async function photoUploadRoute(app: FastifyInstance) {
  app.post('/:productId/photos', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };

    // Authorize before accepting the multipart body at all — an unauthorized or
    // wrongly-timed request never causes the server to stream/decode a file.
    await assertPhotoMutablePreCheck(actor, productId);
    // `assertPhotoMutablePreCheck` only ever admits a non-admin onto a
    // draft/changes_required product; the mode gate is an orthogonal capability
    // check on top of that (e.g. a draft created while mode was `all`, now
    // frozen for mutation because mode flipped to `off`). Admins are exempt —
    // admin moderation/correction remains available in every mode.
    if (actor.role !== 'admin') {
      await assertProductCreationEligible(actor, 'photo');
    }

    if (!req.isMultipart()) {
      validationError('Expected a multipart/form-data upload');
    }

    const cfg = getConfig().media;
    const root = cfg.root;
    const parts = req.parts();

    // One file, no extra fields/parts. Busboy delivers parts sequentially over the
    // same request stream, so "is there a second part" can only be answered *after*
    // the first part's stream has been fully drained — hence the two-phase read
    // below rather than a single-pass loop.
    const first = await parts.next();
    if (first.done || first.value.type !== 'file') {
      if (!first.done && first.value.type === 'field') {
        validationError('A photo file is required, not a form field');
      }
      validationError('A photo file is required');
    }
    const filePart = first.value;

    const requestId = newQuarantineRequestId();
    let reservationId: string | undefined;
    try {
      // Reserved *before* a single byte is streamed to disk — worst-case source
      // plus both generated variants at their absolute ceilings. Reserving only
      // after `writeQuarantineFile` (as an earlier version of this route did) let
      // N concurrent uploaders put N × MEDIA_MAX_UPLOAD_BYTES on the volume while
      // the budget still read zero, exactly the disk-exhaustion mode the reserve
      // headroom exists to prevent (reviewer-p3 I3). Reconciled down to the real
      // generated size once encoding finishes.
      const reservation = await reserveMediaCapacity({
        bytes: cfg.maxUploadBytes + cfg.maxDisplayBytes + cfg.maxThumbnailBytes,
      });
      reservationId = reservation.id;

      const written = await writeQuarantineFile(root, requestId, filePart.file, cfg.maxUploadBytes);
      if (filePart.file.truncated) {
        throw new AppError({
          status: 413,
          code: 'payload_too_large',
          title: 'Upload exceeds the maximum allowed size',
        });
      }

      const next = await parts.next();
      if (!next.done) {
        if (next.value.type === 'file') next.value.file.resume();
        validationError('Only one file and no additional fields are allowed');
      }

      const processed = await processProductUpload({ sourcePath: written.path });
      await reconcileMediaCapacityReservation(reservation.id, processed.display.bytes + processed.thumb.bytes);

      const product = await addProductPhoto(actor, {
        productId,
        processed,
        capacityReservationId: reservation.id,
        requestMeta: { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      });
      reservationId = undefined; // addProductPhoto releases it on every terminal path
      return reply.status(201).send(productSchema.parse(product));
    } finally {
      await removeKeyPrefix(root, quarantineDirKey(requestId)).catch(() => {});
      if (reservationId) await releaseMediaCapacityReservation(reservationId).catch(() => {});
    }
  });
}
