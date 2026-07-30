import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, productSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import { addProductPhoto, assertPhotoMutablePreCheck } from '../../services/products/product-photos.js';
import { assertProductCreationEligible } from '../../services/products/product-creation-eligibility.js';
import {
  type DailyByteQuotaReservation,
  reconcileDailyByteQuota,
  reserveDailyByteQuota,
} from '../../services/products/product-creation-quotas.js';
import { processProductUpload } from '../../services/products/product-image-processor.js';
import {
  newQuarantineRequestId,
  quarantineDirKey,
  removeKeyPrefix,
  writeQuarantineFile,
} from '../../services/products/product-media-storage.js';
import {
  assertMediaCapacityReservationLive,
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
    // frozen for mutation because mode flipped to `off`). `assertProductCreationEligible`
    // already treats an admin actor as eligible in every mode on its own — one
    // converged policy across all six call sites (reviewer-p7 I6), same as
    // create/patch/submit and the other two photo routes.
    await assertProductCreationEligible(actor, 'photo');

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
    let quotaReservation: DailyByteQuotaReservation | undefined;
    // Real source bytes actually streamed for this attempt, whatever the
    // outcome — the amount a failed/rejected upload gets charged against the
    // daily quota (reviewer-p7 I2). Stays 0 if the attempt never reaches
    // `writeQuarantineFile` (e.g. the quota/capacity reservation itself is
    // what rejects it), so nothing is charged for work that never happened.
    let attemptedBytes = 0;
    try {
      const worstCaseBytes = cfg.maxUploadBytes + cfg.maxDisplayBytes + cfg.maxThumbnailBytes;
      // Per-user/day fair-share quota is checked *before* the global capacity
      // reservation round trip — a quota rejection should never cost a
      // reservation, and it's an independent, complementary limit (quotas bound
      // one user's share; capacity bounds the whole server's budget). Admins
      // performing a correction are exempt, same as the mode gate above. The
      // check itself atomically reserves the worst-case estimate (reviewer-p7
      // I1) and must be reconciled on every terminal path below.
      if (actor.role !== 'admin') {
        quotaReservation = await reserveDailyByteQuota(actor.id, worstCaseBytes);
      }

      // Reserved *before* a single byte is streamed to disk — worst-case source
      // plus both generated variants at their absolute ceilings. Reserving only
      // after `writeQuarantineFile` (as an earlier version of this route did) let
      // N concurrent uploaders put N × MEDIA_MAX_UPLOAD_BYTES on the volume while
      // the budget still read zero, exactly the disk-exhaustion mode the reserve
      // headroom exists to prevent (reviewer-p3 I3). Reconciled down to the real
      // generated size once encoding finishes.
      const reservation = await reserveMediaCapacity({ bytes: worstCaseBytes });
      reservationId = reservation.id;

      const written = await writeQuarantineFile(root, requestId, filePart.file, cfg.maxUploadBytes);
      attemptedBytes = written.bytes;
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

      // Heartbeat right before the decode/encode step — the longest-running part
      // of this window, and the one whose duration this route doesn't fully
      // control (bounded by MEDIA_PROCESSING_DEADLINE_MS, which can itself run
      // close to the reservation's default TTL under load). Without this, a
      // slow-but-legitimate upload could have its reservation silently expire
      // mid-decode (reviewer-p3 R2).
      await assertMediaCapacityReservationLive(reservation.id);
      const processed = await processProductUpload({ sourcePath: written.path });
      const reconciled = await reconcileMediaCapacityReservation(reservation.id, processed.display.bytes + processed.thumb.bytes);
      if (!reconciled) {
        // The reservation expired between the heartbeat above and now — refuse
        // rather than silently proceeding to write final bytes under a
        // capacity guarantee that's no longer real.
        throw new AppError({
          status: 507,
          code: 'capacity_exceeded',
          title: 'Media capacity reservation expired before processing completed',
        });
      }

      const product = await addProductPhoto(actor, {
        productId,
        processed,
        capacityReservationId: reservation.id,
        requestMeta: { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      });
      reservationId = undefined; // addProductPhoto releases it on every terminal path
      // Reconciles the quota reservation down to the real accepted
      // display+thumb total (only runs once `addProductPhoto` has actually
      // committed the reference transaction). A Redis blip here must not
      // turn a fully successful, persisted upload into a 500 — the client
      // would only retry and upload it again — so failures are logged, not
      // thrown (reviewer-p7 M3).
      if (quotaReservation) {
        const settled = quotaReservation;
        quotaReservation = undefined;
        await reconcileDailyByteQuota(settled, processed.display.bytes + processed.thumb.bytes).catch((err: unknown) => {
          logger.warn({ err, actorId: actor.id }, 'failed to reconcile daily byte quota after a successful upload');
        });
      }
      return reply.status(201).send(productSchema.parse(product));
    } finally {
      await removeKeyPrefix(root, quarantineDirKey(requestId)).catch(() => {});
      if (reservationId) await releaseMediaCapacityReservation(reservationId).catch(() => {});
      // Any remaining reservation here means the attempt failed — reconcile
      // down to the real source bytes actually streamed (never the
      // worst-case ceiling), so a rejected/corrupt upload still costs real
      // quota instead of nothing (reviewer-p7 I2).
      if (quotaReservation) {
        await reconcileDailyByteQuota(quotaReservation, attemptedBytes).catch((err: unknown) => {
          logger.warn({ err, actorId: actor.id }, 'failed to reconcile daily byte quota after a failed upload');
        });
      }
    }
  });
}
