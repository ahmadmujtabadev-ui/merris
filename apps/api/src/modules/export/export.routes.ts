import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { generateWordDoc, generateExcelWorkbook } from './export.service.js';

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/export/word ─────────────────────────────────────
  // Body: { title, agentName, runId, generatedAt, content }
  // Returns: .docx file download
  app.post('/api/v1/export/word', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const {
        title       = 'ESG Analysis',
        agentName   = 'Merris Agent',
        runId       = 'r_000',
        generatedAt = new Date().toISOString(),
        content     = '',
      } = (request.body ?? {}) as {
        title?: string;
        agentName?: string;
        runId?: string;
        generatedAt?: string;
        content?: string;
      };

      const buf = await generateWordDoc({ title, agentName, runId, generatedAt, content });

      const filename = `merris-${runId.replace(/[^a-z0-9]/gi, '-')}.docx`;
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', String(buf.length))
        .send(buf);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      return reply.code(500).send({ error: message });
    }
  });

  // ── POST /api/v1/export/excel ────────────────────────────────────
  // Body: { title, agentName, runId, generatedAt, content, rows? }
  // Returns: .xlsx file download
  app.post('/api/v1/export/excel', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const {
        title       = 'ESG Analysis',
        agentName   = 'Merris Agent',
        runId       = 'r_000',
        generatedAt = new Date().toISOString(),
        content     = '',
        rows,
      } = (request.body ?? {}) as {
        title?: string;
        agentName?: string;
        runId?: string;
        generatedAt?: string;
        content?: string;
        rows?: Array<{ section: string; metric: string; value: string; unit?: string; framework?: string; status?: string }>;
      };

      const buf = generateExcelWorkbook({ title, agentName, runId, generatedAt, content, rows });

      const filename = `merris-${runId.replace(/[^a-z0-9]/gi, '-')}.xlsx`;
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', String(buf.length))
        .send(buf);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      return reply.code(500).send({ error: message });
    }
  });
}
