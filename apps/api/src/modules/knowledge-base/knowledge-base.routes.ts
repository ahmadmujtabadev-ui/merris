import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { authenticate } from '../auth/auth.middleware.js';
import { AppError } from '../auth/auth.service.js';
import {
  ingestReport,
  ingestReportByPath,
  listReports,
  getReportById,
  getBenchmarkData,
} from './knowledge-base.service.js';
import { semanticSearch } from './search.service.js';
import { denseSearch } from './dense-search.service.js';

// ============================================================
// Route Registration
// ============================================================

export async function registerKnowledgeBaseRoutes(app: FastifyInstance): Promise<void> {
  // Register multipart plugin for PDF upload (skip if already registered by ingestion routes)
  if (!app.hasDecorator('multipartErrors')) {
    await app.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max for large sustainability PDFs
        files: 1,
      },
    });
  }

  // ----------------------------------------------------------
  // POST /api/v1/knowledge-base/ingest-report
  // Upload and ingest a sustainability PDF
  // ----------------------------------------------------------
  app.post(
    '/api/v1/knowledge-base/ingest-report',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const file = await request.file();
        if (!file) {
          return reply.code(400).send({ error: 'No file provided' });
        }

        // Validate PDF mime type
        if (file.mimetype !== 'application/pdf') {
          return reply.code(400).send({ error: 'Only PDF files are supported' });
        }

        // Read file buffer
        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
          return reply.code(400).send({ error: 'Empty file' });
        }

        // Extract metadata from multipart fields
        const fields = file.fields as Record<string, { value?: string } | undefined>;

        const company = fields['company']?.value;
        const reportYearStr = fields['reportYear']?.value;
        const sector = fields['sector']?.value;
        const country = fields['country']?.value;
        const disclosureId = fields['disclosureId']?.value;

        if (!company || !reportYearStr || !sector || !country) {
          return reply.code(400).send({
            error: 'Missing required fields: company, reportYear, sector, country',
          });
        }

        const reportYear = parseInt(reportYearStr, 10);
        if (isNaN(reportYear)) {
          return reply.code(400).send({ error: 'reportYear must be a valid number' });
        }

        const result = await ingestReport(buffer, {
          company,
          reportYear,
          sector,
          country,
          disclosureId: disclosureId || undefined,
        });

        return reply.code(201).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // POST /api/v1/knowledge-base/ingest-report-by-id
  // Ingest from already-downloaded PDF by file path
  // ----------------------------------------------------------
  app.post(
    '/api/v1/knowledge-base/ingest-report-by-id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const bodySchema = z.object({
          disclosureId: z.string().min(1),
          filePath: z.string().min(1),
          company: z.string().min(1),
          reportYear: z.number().int().min(1900).max(2100),
          sector: z.string().min(1),
          country: z.string().min(1),
        });

        const body = bodySchema.parse(request.body);

        const result = await ingestReportByPath(body.filePath, {
          company: body.company,
          reportYear: body.reportYear,
          sector: body.sector,
          country: body.country,
          disclosureId: body.disclosureId,
        });

        return reply.code(201).send({ result });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/reports
  // List ingested reports with optional filters
  // ----------------------------------------------------------
  app.get(
    '/api/v1/knowledge-base/reports',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const query = request.query as Record<string, string | undefined>;
        const sector = query['sector'];
        const country = query['country'];
        const minQuality = query['minQuality'] ? parseInt(query['minQuality'], 10) : undefined;

        const reports = await listReports({ sector, country, minQuality });

        return reply.code(200).send({ reports });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/reports/:id
  // Get full report detail with extracted data
  // ----------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/api/v1/knowledge-base/reports/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const report = await getReportById(request.params.id);
        if (!report) {
          return reply.code(404).send({ error: 'Report not found' });
        }

        return reply.code(200).send({ report });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // K-domain → M-module prefix mapping (mirrors scaffolding.routes MODULE_K_MAP)
  const K_MODULE_MAP: Record<string, string[]> = {
    K1: ['M01', 'M02'], K2: ['M03', 'M04'],
    K3: ['M05', 'M06'], K4: ['M07', 'M08'],
    K5: ['M09', 'M10'], K6: ['M11', 'M12'],
    K7: ['M13', 'M14'],
  };

  // Reverse map: module prefix → K-domain
  const MODULE_K_MAP: Record<string, string> = {};
  for (const [k, modules] of Object.entries(K_MODULE_MAP)) {
    for (const m of modules) MODULE_K_MAP[m] = k;
  }
  function moduleToKDomain(moduleName: string): string {
    const prefix = moduleName.match(/^(M\d{2})/)?.[1] ?? '';
    return MODULE_K_MAP[prefix] ?? 'K7';
  }

  // ----------------------------------------------------------
  // POST /api/v1/knowledge-base/search
  // Tries TF-IDF first; falls back to Voyage AI dense search.
  // ----------------------------------------------------------
  app.post(
    '/api/v1/knowledge-base/search',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const bodySchema = z.object({
          query: z.string().min(1),
          domains: z.array(z.string()).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        });

        const body = bodySchema.parse(request.body);
        const startTime = Date.now();

        // Try TF-IDF first
        let results = await semanticSearch({
          query: body.query,
          domains: body.domains,
          limit: body.limit,
        });

        // Fall back to dense (Voyage AI) search if TF-IDF has no data
        if (results.length === 0) {
          const modules = body.domains && body.domains.length > 0
            ? body.domains.flatMap((d) => K_MODULE_MAP[d] ?? [])
            : [];
          const denseResults = await denseSearch({
            query: body.query,
            modules: modules.length > 0 ? modules : undefined,
            limit: body.limit ?? 10,
            minScore: 0.3,
          });
          // Map dense results to the SearchResult shape the frontend expects
          results = denseResults.map((r) => {
            // Derive K-domain from actual module name
            const domain = body.domains?.[0] ?? moduleToKDomain(r.module);

            // Clean filename → readable title
            // e.g. "relx-relx-sustainability-2024.pdf"       → "Relx Sustainability 2024"
            //      "3i-group-3i-group-sustainability-2024.pdf" → "3i Group Sustainability 2024"
            //      "anglo-american-anglo-american-sustainability-2024.pdf" → "Anglo American Sustainability 2024"
            const base = r.filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
            const words = base.split(/\s+/);
            // Detect repeated prefix: try halves of 2..6 words to see if first N words repeat immediately
            let deduped = words;
            for (let n = 1; n <= Math.floor(words.length / 2); n++) {
              const prefix = words.slice(0, n).join(' ').toLowerCase();
              const next = words.slice(n, n * 2).join(' ').toLowerCase();
              if (prefix === next) {
                deduped = words.slice(n);
                break;
              }
            }
            // Also remove consecutive identical adjacent words
            deduped = deduped.filter((w, i) => i === 0 || w.toLowerCase() !== deduped[i - 1]!.toLowerCase());
            // Title-case each token
            const title = deduped
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');

            // Extract year from filename
            const yearMatch = r.filename.match(/(\d{4})/);
            const year = yearMatch?.[1] ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

            // Description: skip any leading partial word (chunk may start mid-sentence).
            // Find the first position where a capital letter follows a space, or just
            // the first capital letter if the text starts with a lowercase fragment.
            let desc = r.text.trim();
            const firstCapIdx = desc.search(/[A-Z]/);
            if (firstCapIdx > 0 && firstCapIdx < 60) {
              desc = desc.slice(firstCapIdx);
            }
            desc = desc.slice(0, 220);

            return {
              id: r.id,
              domain,
              collection: r.module,
              title,
              description: desc,
              score: r.score,
              source: r.filename,
              year,
              ingested: true,
            };
          });
        }

        const searchTime = Date.now() - startTime;

        return reply.code(200).send({
          results,
          totalCandidates: results.length,
          searchTime,
        });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );

  // ----------------------------------------------------------
  // GET /api/v1/knowledge-base/benchmarks/:metric
  // Get benchmark data for a specific metric across reports
  // ----------------------------------------------------------
  app.get<{ Params: { metric: string } }>(
    '/api/v1/knowledge-base/benchmarks/:metric',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Authentication required' });
        }

        const query = request.query as Record<string, string | undefined>;
        const sector = query['sector'];
        const country = query['country'];

        const benchmark = await getBenchmarkData(request.params.metric, {
          sector,
          country,
        });

        return reply.code(200).send({ benchmark });
      } catch (err) {
        return handleError(err, reply);
      }
    }
  );
}

// ============================================================
// Error Handler
// ============================================================

function handleError(
  err: unknown,
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
) {
  if (err instanceof AppError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }

  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return reply.code(500).send({ error: message });
}
