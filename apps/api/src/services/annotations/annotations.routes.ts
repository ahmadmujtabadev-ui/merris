// src/services/annotations/annotations.routes.ts
//
// Document annotation persistence. In-memory store for now — Phase K-lite.
// Real Mongo persistence is a follow-up.

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../modules/auth/auth.middleware.js';

export type AnnotationSeverity = 'CRITICAL' | 'IMPORTANT' | 'MINOR';
export type AnnotationStatus = 'pending' | 'applied' | 'dismissed';

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  severity: AnnotationSeverity;
  ref: string;
  title: string;
  description: string;
  suggestedFix?: string;
  status: AnnotationStatus;
  createdAt: string;
  updatedAt: string;
}

// In-memory store keyed by documentId
const annotationStore = new Map<string, DocumentAnnotation[]>();

// Seed a few annotations for any document the viewer asks about, so the
// frontend gets something visible during early development. Real annotations
// will eventually come from the assurance pack endpoint.
function seedFor(documentId: string): DocumentAnnotation[] {
  const now = new Date().toISOString();
  return [
    {
      id: `${documentId}-a1`,
      documentId,
      severity: 'CRITICAL',
      ref: 'GRI 305-1',
      title: 'Mismatched Direct Emissions',
      description: 'Reported Scope 1 (14,200 tCO2e) does not match facility-level sum (15,840 tCO2e).',
      suggestedFix: 'Reconcile facility emissions or restate the headline Scope 1 figure to 15,840 tCO2e.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${documentId}-a2`,
      documentId,
      severity: 'IMPORTANT',
      ref: 'G2.1',
      title: 'Vague Board Oversight',
      description: 'No mention of a Climate Risk Subcommittee or named board sponsor.',
      suggestedFix: 'Add a sentence naming the board sponsor for climate risk and the cadence of reviews.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${documentId}-a3`,
      documentId,
      severity: 'MINOR',
      ref: 'Format',
      title: 'Missing Appendix Link',
      description: 'Reference to Appendix D is broken.',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getOrSeed(documentId: string): DocumentAnnotation[] {
  if (!annotationStore.has(documentId)) {
    annotationStore.set(documentId, seedFor(documentId));
  }
  return annotationStore.get(documentId)!;
}

export async function registerAnnotationRoutes(app: FastifyInstance): Promise<void> {
  // ----- List annotations for a document -----
  app.get<{ Params: { documentId: string } }>(
    '/api/v1/documents/:documentId/annotations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const annotations = getOrSeed(request.params.documentId);
      return reply.send({ annotations });
    },
  );

  // ----- Update an annotation's status (apply / dismiss) -----
  app.patch<{ Params: { documentId: string; annotationId: string }; Body: { status: AnnotationStatus } }>(
    '/api/v1/documents/:documentId/annotations/:annotationId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { documentId, annotationId } = request.params;
      const { status } = request.body;
      if (!['pending', 'applied', 'dismissed'].includes(status)) {
        return reply.code(400).send({ error: 'Invalid status' });
      }
      const annotations = getOrSeed(documentId);
      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation) {
        return reply.code(404).send({ error: 'Annotation not found' });
      }
      annotation.status = status;
      annotation.updatedAt = new Date().toISOString();
      return reply.send({ annotation });
    },
  );

  // ----- Create a new annotation -----
  app.post<{
    Params: { documentId: string };
    Body: {
      severity: AnnotationSeverity;
      ref: string;
      title: string;
      description: string;
      suggestedFix?: string;
    };
  }>(
    '/api/v1/documents/:documentId/annotations',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { documentId } = request.params;
      const { severity, ref, title, description, suggestedFix } = request.body;
      if (!title || !description || !severity || !ref) {
        return reply.code(400).send({ error: 'severity, ref, title, description are required' });
      }
      const now = new Date().toISOString();
      const annotation: DocumentAnnotation = {
        id: `${documentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        documentId,
        severity,
        ref,
        title,
        description,
        suggestedFix,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      const annotations = getOrSeed(documentId);
      annotations.push(annotation);
      return reply.code(201).send({ annotation });
    },
  );
}
