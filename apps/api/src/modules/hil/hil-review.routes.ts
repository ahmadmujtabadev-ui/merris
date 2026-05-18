import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { HilReviewModel } from './hil-review.model.js';
import { AppError } from '../auth/auth.service.js';

export async function registerHilReviewRoutes(app: FastifyInstance): Promise<void> {

  // ── List pending reviews (optionally filtered by engagementId) ──
  app.get('/api/v1/hil/reviews', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { engagementId, status = 'pending' } = request.query as {
        engagementId?: string;
        status?: string;
      };

      const filter: Record<string, unknown> = { status };
      if (engagementId) filter['engagementId'] = engagementId;

      const reviews = await HilReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return reply.send({ reviews });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Get single review by reviewId ────────────────────────────────
  app.get('/api/v1/hil/reviews/:reviewId', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { reviewId } = request.params as { reviewId: string };
      const review = await HilReviewModel.findOne({ reviewId }).lean();
      if (!review) return reply.code(404).send({ error: 'Review not found' });
      return reply.send(review);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Approve a review ─────────────────────────────────────────────
  app.post('/api/v1/hil/reviews/:reviewId/approve', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

      const { reviewId } = request.params as { reviewId: string };
      const { notes } = (request.body ?? {}) as { notes?: string };

      const review = await HilReviewModel.findOne({ reviewId });
      if (!review) return reply.code(404).send({ error: 'Review not found' });
      if (review.status !== 'pending') {
        return reply.code(409).send({ error: `Review already ${review.status}` });
      }

      review.status = 'approved';
      review.reviewNotes = notes;
      review.reviewedBy = request.user.userId;
      review.reviewedAt = new Date();
      await review.save();

      return reply.send({ ok: true, review });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Reject a review ──────────────────────────────────────────────
  app.post('/api/v1/hil/reviews/:reviewId/reject', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Authentication required' });

      const { reviewId } = request.params as { reviewId: string };
      const { notes } = (request.body ?? {}) as { notes?: string };

      const review = await HilReviewModel.findOne({ reviewId });
      if (!review) return reply.code(404).send({ error: 'Review not found' });
      if (review.status !== 'pending') {
        return reply.code(409).send({ error: `Review already ${review.status}` });
      }

      review.status = 'rejected';
      review.reviewNotes = notes;
      review.reviewedBy = request.user.userId;
      review.reviewedAt = new Date();
      await review.save();

      return reply.send({ ok: true, review });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}

function handleError(
  err: unknown,
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
) {
  if (err instanceof AppError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.code(500).send({ error: message });
}
