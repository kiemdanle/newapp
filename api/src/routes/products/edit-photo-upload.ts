import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { addProductEditPhoto, assertEditPhotoMutablePreCheck } from '../../services/products/product-photos.js';
import { toProductEditRow } from '../../services/products/product-edits.js';
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

const paramSchema = z.object({ editId: z.string().uuid() });

function validationError(title: string): never {
  throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title });
}

export async function editPhotoUploadRoute(app: FastifyInstance) {
  app.post('/:editId/photos', { onRequest: app.requireAuth }, async (req, reply) => {
    const { editId } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };

    await assertEditPhotoMutablePreCheck(actor, editId);

    if (!req.isMultipart()) {
      validationError('Expected a multipart/form-data upload');
    }

    const cfg = getConfig().media;
    const root = cfg.root;
    const parts = req.parts();

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

      const reservation = await reserveMediaCapacity({
        bytes: cfg.maxUploadBytes + cfg.maxDisplayBytes + cfg.maxThumbnailBytes,
      });
      reservationId = reservation.id;

      const processed = await processProductUpload({ sourcePath: written.path });
      await reconcileMediaCapacityReservation(reservation.id, processed.display.bytes + processed.thumb.bytes);

      const edit = await addProductEditPhoto(actor, {
        editId,
        processed,
        capacityReservationId: reservation.id,
      });
      reservationId = undefined; // addProductEditPhoto releases it on every terminal path
      return reply.status(201).send(toProductEditRow(edit));
    } finally {
      await removeKeyPrefix(root, quarantineDirKey(requestId)).catch(() => {});
      if (reservationId) await releaseMediaCapacityReservation(reservationId).catch(() => {});
    }
  });
}
