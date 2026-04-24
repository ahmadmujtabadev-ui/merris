// src/services/verification/verification.router.ts

import { FastifyInstance } from "fastify";
import { authenticate } from "../../modules/auth/auth.middleware";
import { verifyFull, verifyCalculation, verifyConsistency, verifyCompliance, verifyBenchmark, verifyAnomaly, verifyCrossDocument } from "./verification.service";
import { formatVerificationReport } from "./format";
import { determineApplicableFrameworks, getExcludedFrameworks } from "./entity-context";
import { generateFrameworkIndex } from "./index-generator";

export async function registerVerificationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/verify/full", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks } = request.body as any;
    const result = await verifyFull(engagementId, documentBody, frameworks || []);
    return reply.send(result);
  });

  app.post("/api/v1/verify/calculation", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyCalculation(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/consistency", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyConsistency(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/compliance", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks } = request.body as any;
    const result = await verifyCompliance(engagementId, documentBody, frameworks || []);
    return reply.send(result);
  });

  app.post("/api/v1/verify/benchmark", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyBenchmark(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/anomaly", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody } = request.body as any;
    const result = await verifyAnomaly(engagementId, documentBody);
    return reply.send(result);
  });

  app.post("/api/v1/verify/cross-document", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId } = request.body as any;
    const result = await verifyCrossDocument(engagementId);
    return reply.send(result);
  });

  app.post("/api/v1/verify/generate-index", { preHandler: [authenticate] }, async (request, reply) => {
    const { documentBody, framework, entity } = request.body as any;

    // Check entity context if provided
    if (entity) {
      const excluded = getExcludedFrameworks(entity, [framework]);
      if (excluded.length > 0) {
        return reply.send({
          error: 'Framework not applicable',
          excluded,
          suggestion: `${framework} does not apply to this entity. Applicable frameworks: ${determineApplicableFrameworks(entity).join(', ')}`,
        });
      }
    }

    const index = await generateFrameworkIndex(documentBody, framework);
    return reply.send(index);
  });

  app.post("/api/v1/verify/assurance-readiness", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks, entity } = request.body as any;
    if (!entity) return reply.code(400).send({ error: 'Entity info required for assurance readiness assessment' });

    const report = await verifyFull(engagementId, documentBody, frameworks || []);
    const { checkAssuranceReadiness } = await import("./assurance-readiness.js");
    const readiness = await checkAssuranceReadiness(entity, report.findings);
    return reply.send({ verification: report.summary, assurance_readiness: readiness });
  });

  app.post("/api/v1/verify/full/formatted", { preHandler: [authenticate] }, async (request, reply) => {
    const { engagementId, documentBody, frameworks, entity } = request.body as any;
    const report = await verifyFull(engagementId, documentBody, frameworks || [], entity || undefined);
    const formatted = formatVerificationReport(report);

    // Enrich with entity-specific framework exclusions from the report
    if (report.applicableFrameworks) {
      formatted.applicableFrameworks = report.applicableFrameworks;
    }
    if (report.excludedFrameworks) {
      formatted.excludedFrameworks = report.excludedFrameworks;
    }

    return reply.send(formatted);
  });
}
