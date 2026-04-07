# Merris Platform Architecture

> **AI co-pilot for ESG professionals.** Harvey-for-ESG model embedded in Office 365.
> GCC beachhead (mandatory ESG disclosure wave), expanding to EU/APAC.
>
> **Last updated:** 2026-04-06 (post Phase L) · **Branch:** `main` @ `9489b1f`

---

## 0. Document conventions

- **Real**: works against real backend code with real data sources today
- **Real, frontend-not-wired**: backend exists; web/Office UI hasn't been pointed at it yet
- **Scaffolding (`seeded: false`)**: placeholder backend route returning hardcoded data with an explicit `seeded: false` flag in the response. Listed as honest stubs that future plans will replace.
- **Unverified**: code compiles, but the runtime path has not been exercised end-to-end against production infrastructure

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            CLIENTS                              │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Word     │ │ Excel    │ │ PowerPt  │ │ Outlook  │          │
│  │ Add-in   │ │ Add-in   │ │ Add-in   │ │ Add-in   │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │            │            │            │                  │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐                        │
│  │ Teams    │ │ Web App  │ │ Mobile   │                        │
│  │ Bot      │ │ Next.js  │ │ (future) │                        │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                        │
└───────┼────────────┼────────────┼───────────────────────────────┘
        │            │            │
        └────────────┼────────────┘
                     │
              ┌──────▼──────┐
              │ Fastify API │   POST /api/v1/assistant/chat
              │ /api/v1/*   │   ↳ Accept: application/json   → JSON
              └──────┬──────┘   ↳ Accept: text/event-stream  → SSE
                     │
        ┌────────────┼────────────┐──────────────┐
        │            │            │              │
   ┌────▼────┐  ┌────▼────┐  ┌────▼────┐    ┌────▼────┐
   │ MongoDB │  │  Redis  │  │ Claude  │    │  Azure  │
   │ Mongoose│  │ BullMQ  │  │   API   │    │ Blob    │
   └─────────┘  └─────────┘  └─────────┘    └─────────┘
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| API | Fastify 4 + TypeScript (NodeNext ESM) |
| Database | MongoDB 8 + Mongoose |
| Queue | BullMQ + Redis |
| AI | Claude API (`@anthropic-ai/sdk`), Sonnet 4 model |
| Streaming | Server-Sent Events (SSE) via content negotiation |
| Web | Next.js 14 (App Router) + React 18 + Tailwind 3.4 |
| State | Zustand |
| Office add-ins | Office.js + webpack 5 |
| Teams bot | Bot Framework + Adaptive Cards |
| Auth | JWT + bcrypt (migration to OAuth2 via Azure AD planned) |
| Wire types | `@merris/shared` workspace package (zod + discriminated unions) |
| Testing | Vitest + MongoMemoryServer (api), Vitest + RTL + jsdom (web) |
| Build | Turborepo + pnpm |

---

## 2. Monorepo Structure

```
merris-platform/
├── apps/
│   ├── api/                              Fastify backend
│   │   └── src/
│   │       ├── server.ts                 Entry; registers all route modules
│   │       ├── lib/                      Infra (db, redis, claude, logger, storage, graph)
│   │       ├── models/                   Shared Mongoose models
│   │       ├── modules/                  Feature modules (16 — domain-aligned)
│   │       │   ├── auth/
│   │       │   ├── organization/
│   │       │   ├── ingestion/            engagements + documents
│   │       │   ├── framework/            disclosures + cross-framework maps
│   │       │   ├── data-collection/
│   │       │   ├── calculation/
│   │       │   ├── agent/                ┌─ agent.service.ts        chat() — JSON path
│   │       │   │                         ├─ agent.stream.ts         chatStream() — SSE path
│   │       │   │                         ├─ tool-use-loop.ts        shared loop (Phase E dedup)
│   │       │   │                         ├─ system-prompt.ts        loadSystemPrompt()
│   │       │   │                         ├─ citations.ts            extractCitations + TOOL_CITATION_MAP
│   │       │   │                         ├─ agent.tools.ts          41+ tool definitions
│   │       │   │                         ├─ agent.context.ts        buildAgentContext()
│   │       │   │                         ├─ memory.ts               captureConversation
│   │       │   │                         ├─ perception.ts           document perception
│   │       │   │                         ├─ judgment.ts             judgeSection / judgeDocument
│   │       │   │                         ├─ workproduct.ts          generate-report / assurance-pack
│   │       │   │                         ├─ learning.ts             edit / accept / reject signals
│   │       │   │                         ├─ team-awareness.ts       multi-user context
│   │       │   │                         └─ agent.stream.test.ts    8 Vitest cases
│   │       │   ├── knowledge-base/       semantic search (TF-IDF)
│   │       │   ├── sharepoint/
│   │       │   ├── report/, presentation/
│   │       │   ├── qa/, assurance/, workflow/
│   │       ├── services/                 6-Product service layer (cross-cutting)
│   │       │   ├── assistant/            assistant.router.ts (POST /assistant/chat content-negotiated)
│   │       │   │                         + assistant.service.ts + evaluator.ts + sse.ts + metrics.ts
│   │       │   ├── knowledge/            knowledge.router.ts + knowledge.service.ts
│   │       │   │                         + benchmark.service.ts + enrichment-queue.ts
│   │       │   │                         + elevation.router.ts + 7 supporting services
│   │       │   ├── workflows/            workflows.router.ts + workflows.service.ts
│   │       │   │                         + templates/*.json (5 real templates)
│   │       │   ├── verification/         12 supporting services
│   │       │   ├── vault/                vault.router.ts + vault.service.ts + vault.model.ts
│   │       │   ├── annotations/          annotations.routes.ts (Phase K-lite)
│   │       │   └── scaffolding/          scaffolding.routes.ts (Phase G placeholder routes)
│   │       └── scripts/                  ~25 seed scripts (real public data sources)
│   ├── web/                              Next.js 14 (App Router) frontend
│   │   ├── app/
│   │   │   ├── (auth)/login, register
│   │   │   ├── (dashboard)/
│   │   │   │   ├── intelligence/         Plan 3 chat surface
│   │   │   │   ├── portfolio/[id]/documents/[docId]/  Plan 4 + Doc Viewer
│   │   │   │   ├── compliance/, knowledge/, firm-library/
│   │   │   │   ├── workflow-agents/, history/, config/, settings/
│   │   │   │   └── layout.tsx            light shell with MerrisSidebar+MerrisTopBar
│   │   │   ├── layout.tsx                Manrope+Inter via next/font
│   │   │   └── globals.css               Merris CSS variables
│   │   ├── components/
│   │   │   ├── merris/                   prototype-faithful primitives (Pill, Chip,
│   │   │   │                             MerrisButton, MerrisCard, ScoreRing, SectionLabel,
│   │   │   │                             MerrisSidebar, MerrisTopBar, PlaceholderPage)
│   │   │   ├── intelligence/             3-phase chat (IntelligenceView, ThinkingState,
│   │   │   │                             AdvisoryResponse, RefusalResponse, ConversationMessage,
│   │   │   │                             FollowUpInput, JurisdictionChips, SourceToggles,
│   │   │   │                             ChatInput, WorkingHeader, IntelligenceHero, CitationsList)
│   │   │   ├── portfolio/                EngagementCard, EngagementDetail + 5 subcomponents,
│   │   │   │                             NewEngagementModal, EngagementDocumentsSection,
│   │   │   │                             EngagementEmptyState
│   │   │   ├── document-viewer/          DocumentViewer, Header, Content, AnnotationsSidebar,
│   │   │   │                             EmptyState, document-viewer-data.ts
│   │   │   ├── pages/                    Plan 5 page bodies (knowledge, workflow-agents,
│   │   │   │                             compliance, firm-library, history, config, settings)
│   │   │   └── ui/                       shadcn-style primitives (kept for Radix integrations)
│   │   ├── lib/
│   │   │   ├── api.ts                    Typed ApiClient (real route inventory + SSE chatStream)
│   │   │   ├── chat-store.ts             Zustand: messages[], thinkingSteps, evaluation, citations
│   │   │   ├── store.ts                  useAuthStore + useEngagementStore
│   │   │   ├── design-tokens.ts          TS mirror of CSS variables
│   │   │   ├── intelligence-constants.ts JURISDICTIONS, KNOWLEDGE_SOURCES, THINKING_PHASES
│   │   │   └── portfolio-constants.ts    framework options + placeholder findings/team
│   │   ├── vitest.config.ts              Plan L test infra
│   │   └── vitest.setup.ts
│   ├── office-addins/
│   │   ├── word/                         4-tab architecture (Insights/Actions/Chat/History)
│   │   ├── excel/, powerpoint/, outlook/
│   │   └── shared/                       agent-panel, api-client, auth, engagement-selector
│   └── teams-bot/
├── packages/
│   └── shared/                           Workspace package
│       └── src/
│           ├── stream-events.ts          StreamEvent discriminated union (Plan 1)
│           ├── agent.ts                  Agent types
│           ├── ...
│           └── index.ts                  Re-exports
├── data/                                 Framework definitions, emission factors, KB seeds
├── docs/
│   ├── ARCHITECTURE.md                   This file
│   ├── superpowers/plans/                Implementation plans (Plan 1-5, Doc Viewer, etc.)
│   └── superpowers/decisions/            Production-readiness decisions
├── prompts/router.md                     Agent system prompt
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 3. Database Models (MongoDB)

### 3.1 Authentication & Organization

**Users** (`users`)
```
email           String      unique, lowercase
password        String      bcrypt hashed
name            String
orgId           ObjectId    → organizations
role            Enum        owner | admin | manager | analyst | reviewer | auditor_readonly
permissions     [{resource, actions[]}]
mfaEnabled      Boolean
preferences     {language: en|ar, timezone, notifications: {email, inApp, teams}}
teamIds         [ObjectId]  → teams
isActive        Boolean
```

**Organizations** (`organizations`) — name, type (consulting|corporate|regulator), plan, region, industry, settings, branding

**Teams** (`teams`) — name, orgId, memberIds, leadId

**Org Profiles** (`orgprofiles`) — legalName, country, industryGICS, listingStatus, employeeCount, facilities[], currentFrameworks[], esgMaturity, reportingHistory[]

**Framework Recommendations** (`frameworkrecommendations`) — recommendations[], selections{selected[], confirmedAt}

### 3.2 ESG Frameworks

**Frameworks** (`frameworks`) — id, code, name, version, effectiveDate, issuingBody, region, type (mandatory|voluntary|rating|taxonomy), structure{topics[]}

**Disclosures** (`disclosures`) — flattened for cross-framework querying. id, frameworkId, code, name, description, topic, dataType, requiredMetrics[], guidanceText, crossReferences[]

**Cross-Framework Maps** (`cross_framework_maps`) — sourceFramework, targetFramework, mappings[]

**Emission Factors** (`emission_factors`) — source, country, year, factor, unit, scope, category, fuelType

### 3.3 Engagements & Data

**Engagements** (`engagements`) — orgId, clientOrgId, name, frameworks[], status (setup|data_collection|drafting|review|assurance|completed), deadline, scope{reportingPeriod, baselineYear, reportType, assuranceLevel}

**ESG Documents** (`esgdocuments`) — engagementId, filename, format, size, hash, uploadSource (sharepoint|manual|email|api), status (queued|processing|ingested|failed), extractedData[], **extractedText**, blobUrl

**Data Points** (`datapoints`) — engagementId, documentId, frameworkRef, metricName, value, unit, period, confidence, status (auto_extracted|user_confirmed|user_edited|estimated|missing), extractionMethod, auditTrail[]

### 3.4 Workflow & Reports

**Workflow Definitions** (`workflowdefinitions`) — engagement-stage tracking. Stages: `Setup → Data Collection → Drafting → Internal Review → Partner Approval → Client Review → Assurance Prep → Final`

**Reports** (`reports`) — title, type, language, status, structure[{id, title, frameworkRef, content, dataPoints, status, reviewComments}], exportFormats[]

**Presentations** (`presentations`) — title, type, slides[{layout, content, speakerNotes}], branding

**Workflow Executions** *(in-memory store, Phase F)* — id, templateId, engagementId, status (running|completed|failed), currentStep, totalSteps, results, error?, startedAt, completedAt? · See §6.

### 3.5 Knowledge Base (7 Domains)

| Collection | Domain | Purpose |
|---|---|---|
| `kb_corporate_disclosures` | K1 | company, ticker, sector, reportYear, keyMetrics |
| `kb_climate_science` | K2 | source (ipcc/iea/sbti/ghg_protocol), category, data |
| `kb_regulatory` | K3 | jurisdiction, requirements[], penalties |
| `kb_sustainable_finance` | K4 | green bonds, ESG ratings, taxonomy, PCAF |
| `kb_environmental_science` | K5 | TNFD, biodiversity, water, circular economy |
| `kb_supply_chain` | K6 | due diligence, forced labour, conflict minerals |
| `kb_research` | K7 | academic, publication, abstract, citationKey |

Plus a number of **agent-tool-specific real collections** seeded by the scripts in §10.4:
`kb_water_risk` (WRI Aqueduct), `kb_climate_vulnerability` (ND-GAIN), `kb_sbti_targets` (SBTi), `kb_country_emissions` (IEA), `kb_emission_factors` (Climatiq + IEA), `kb_slavery_index` (Walk Free), `kb_forced_labour_goods` (US ILAB), `kb_protected_areas`, `kb_threatened_species` (IUCN), `kb_facility_emissions`, `kb_decarbonisation_pathways`, `kb_carbon_pricing`, `kb_corruption_index`, `kb_partner_intelligence`, etc.

**Embeddings** (`kb_embeddings`) — TF-IDF sparse vectors for semantic search. sourceCollection, sourceId, domain, text, tfidfVector, denseTerms[500], denseWeights[], magnitude

**Knowledge Reports** (`kb_knowledge_reports`) — extracted metrics from corporate reports. company, reportYear, sector, metrics[], narratives[], quality{}

### 3.6 AI Memory

**Conversation Memory** (`conversation_memories`) — engagementId, userId, channel, userMessage, agentResponse, toolsUsed[], documentContext

**Decision Memory** (`decision_memories`) — engagementId, decision, reasoning, alternatives[], category, revisitable

**Style Memory** (`style_memories`) — userId, orgId, clientOrgId, category (writing|formatting|framing|terminology|tone), preference, evidence[], confidence

### 3.7 Annotations *(Phase K-lite, in-memory store)*

**Document Annotations** *(currently `Map<documentId, DocumentAnnotation[]>` — Mongo-backed in next phase)*
```
id              String      `${documentId}-${ts}-${rand}`
documentId      String      indexed
severity        Enum        CRITICAL | IMPORTANT | MINOR
ref             String      e.g. 'GRI 305-1'
title           String
description     String
suggestedFix    String      optional
status          Enum        pending | applied | dismissed
createdAt       String      ISO timestamp
updatedAt       String
```

### 3.8 Integrations

**SharePoint Connections** (`sharepointconnections`) — orgId, driveId, folderId, engagementId, status, webhookSubscriptionId, lastSync

**SharePoint Sync Logs** (`sharepointsynclogs`) — connectionId, action (file_added|file_updated|file_deleted|full_sync|webhook_received), fileName, status

---

## 4. API Routes

**Base:** `/api/v1` · **Auth:** JWT Bearer · **Validation:** Zod (where applied)

### 4.1 Authentication

| Method | Path | Status |
|---|---|---|
| POST | `/auth/register` | Real |
| POST | `/auth/login` | Real |
| POST | `/auth/refresh` | Real |
| GET | `/auth/me` | Real |
| POST | `/users/invite` | Real (owner\|admin) |
| GET | `/users` | Real |
| PUT | `/users/:id/role` | Real (owner) |

### 4.2 Organizations

| Method | Path | Status |
|---|---|---|
| POST | `/organizations/:id/profile` | Real |
| GET | `/organizations/:id/profile` | Real |
| GET | `/organizations/:id/framework-recommendations` | Real |
| POST | `/organizations/:id/framework-selections` | Real |

### 4.3 Frameworks & Disclosures

| Method | Path | Status |
|---|---|---|
| GET | `/frameworks` | Real |
| GET | `/frameworks/:code` | Real |
| GET | `/frameworks/:code/disclosures` | Real |
| GET | `/disclosures/:id` | Real |
| GET | `/disclosures/:id/cross-references` | Real |
| GET | `/engagements/:id/data-agenda` | Real |
| GET | `/emission-factors` | Real |
| GET | `/emission-factors/:country/grid` | Real |

### 4.4 Engagements & Documents (ingestion module)

| Method | Path | Status |
|---|---|---|
| GET | `/engagements` | Real |
| POST | `/engagements` | Real (Plan 4) |
| POST | `/engagements/:id/documents` | Real, multipart, 50 MB cap |
| GET | `/engagements/:id/documents` | Real |
| GET | `/documents/:id` | Real, returns parsed `extractedText` |
| POST | `/documents/:id/process` | Real, triggers ingestion queue |

### 4.5 Data Collection

| Method | Path | Status |
|---|---|---|
| GET | `/engagements/:id/data-points` | Real |
| POST | `/engagements/:id/data-points` | Real |
| PUT | `/data-points/:id` | Real |
| POST | `/data-points/:id/confirm` | Real |
| POST | `/data-points/:id/estimate` | Real |
| GET | `/engagements/:id/gap-register` | Real |
| POST | `/engagements/:id/gap-register/assign` | Real |
| GET | `/engagements/:id/completeness` | Real |

### 4.6 Calculations

| Method | Path | Status |
|---|---|---|
| POST | `/calculate` | Real |
| POST | `/engagements/:id/auto-calculate` | Real |

### 4.7 Workflow Execution (services/workflows)

| Method | Path | Status |
|---|---|---|
| GET | `/workflows/templates` | Real, reads from `services/workflows/templates/*.json` |
| GET | `/workflows/templates/:id` | Real |
| POST | `/workflows/:templateId/run` | Real, dispatches the execution engine §6 |
| GET | `/workflows/:id/status` | Real, polled by web client every 1.5s during execution |
| GET | `/workflows/history` | Real, lists in-memory execution store |
| POST | `/workflows/builder/generate-steps` | Real stub (deterministic 5-step plan, Phase J) |

5 templates currently shipped: `assess-regulatory-impact`, `benchmark-company`, `review-sustainability-report`, `screen-investment-esg`, `validate-emissions`.

### 4.8 Workflow Stage Tracking (modules/workflow — separate from execution)

| Method | Path | Status |
|---|---|---|
| POST | `/engagements/:id/workflow/initialize` | Real |
| GET | `/engagements/:id/workflow` | Real |
| PUT | `/engagements/:id/workflow/advance` | Real |
| POST | `/engagements/:id/workflow/return` | Real |
| GET | `/engagements/:id/workflow/history` | Real |

### 4.9 Reports & Presentations

| Method | Path | Status |
|---|---|---|
| POST | `/engagements/:id/reports` | Real |
| GET | `/engagements/:id/reports` | Real |
| GET | `/reports/:id` | Real |
| PUT | `/reports/:id` | Real |
| PUT | `/reports/:id/sections/:sectionId` | Real |
| POST | `/reports/:id/sections/:sectionId/review` | Real |
| POST | `/reports/:id/export` | Real (docx/pdf/html) |
| POST | `/engagements/:id/presentations/generate` | Real |
| GET | `/engagements/:id/presentations` | Real |
| GET | `/presentations/:id` | Real |
| GET | `/presentations/:id/download` | Real (PPTX) |

### 4.10 Knowledge Base

| Method | Path | Status |
|---|---|---|
| POST | `/knowledge-base/ingest-report` | Real (multipart) |
| POST | `/knowledge-base/ingest-report-by-id` | Real |
| GET | `/knowledge-base/reports` | Real |
| GET | `/knowledge-base/reports/:id` | Real |
| POST | `/knowledge-base/search` | Real (TF-IDF semantic search) |
| GET | `/knowledge-base/benchmarks/:metric` | Real |

### 4.11 AI Agent (legacy module routes)

| Method | Path | Status |
|---|---|---|
| POST | `/agent/chat` | Real |
| POST | `/agent/perceive` | Real |
| POST | `/agent/full-perception` | Real |
| POST | `/agent/judge` | Real |
| POST | `/agent/judge-document` | Real |
| POST | `/agent/catch-me-up` | Real |
| GET | `/agent/memory/:engagementId` | Real |
| POST | `/agent/action` | Real |
| GET | `/agent/team/:engagementId` | Real |
| POST | `/agent/generate-report` | Real |
| POST | `/agent/generate-assurance-pack` | Real |
| POST | `/agent/generate-executive-summary` | Real |
| POST | `/agent/learn/{edit,accept,reject}` | Real |
| POST | `/agent/verify-document` | Stub (Phase E for Word add-in compile) |

### 4.12 Assistant (services/assistant — canonical product surface)

| Method | Path | Status |
|---|---|---|
| **POST** | **`/assistant/chat`** | **Real, content-negotiated:**<br>· `Accept: application/json` → JSON response with `{response, toolCalls, citations, references, confidence, data_gaps, evaluation}`<br>· `Accept: text/event-stream` → SSE stream of typed events §5 |
| POST | `/assistant/draft` | Real |
| POST | `/assistant/review` | Real |
| POST | `/assistant/deep-analysis` | Real |
| GET | `/assistant/suggestions` | Real (static set) |
| GET | `/assistant/memory/:engagementId` | Real |
| GET | `/assistant/team/:engagementId` | Real |
| POST | `/assistant/perceive` | Real |
| POST | `/assistant/full-perception` | Real |
| POST | `/assistant/judge` | Real |
| POST | `/assistant/judge-document` | Real |
| POST | `/assistant/catch-me-up` | Real |
| POST | `/assistant/generate-report` | Real |
| POST | `/assistant/generate-assurance-pack` | Real |
| POST | `/assistant/generate-executive-summary` | Real |
| POST | `/assistant/learn/{edit,accept,reject}` | Real |
| POST | `/assistant/action` | Real |
| GET | `/assistant/metrics` | Real (daily metrics from evaluator) |

### 4.13 Annotations (Phase K-lite)

| Method | Path | Status |
|---|---|---|
| GET | `/documents/:documentId/annotations` | Real backend, **in-memory store** (seeds 3 annotations on first read) |
| POST | `/documents/:documentId/annotations` | Real backend, in-memory |
| PATCH | `/documents/:documentId/annotations/:annotationId` | Real backend, in-memory |

### 4.14 Phase G Scaffolding (`seeded: false`)

These routes exist so the web client has real HTTP endpoints to call, but **return hardcoded data**. Every response includes `seeded: false`. They will be replaced with real data sources by future plans (see Decision 4.5 in `docs/superpowers/decisions/`).

| Method | Path | Replacement plan |
|---|---|---|
| GET | `/knowledge-base/collections` | Wire to real `db.collection('kb_*').countDocuments()` |
| GET | `/engagements/:id/framework-compliance` | Run real disclosure analysis pipeline |
| GET | `/engagements/:id/findings` | Aggregate via `judgeDocument` over engagement's docs |
| GET | `/assistant/history` | Project the `conversation_memories` collection |
| GET | `/team` | New team module |
| GET | `/preferences` | New user preferences module |
| GET | `/billing` | New subscription module (Stripe) |

### 4.15 QA & Assurance

| Method | Path | Status |
|---|---|---|
| POST | `/engagements/:id/qa/run` | Real |
| GET | `/engagements/:id/qa/history` | Real |
| POST | `/engagements/:id/assurance-pack` | Real |
| GET | `/engagements/:id/disclosures/:disclosureId/findings` | Real |

### 4.16 Service-layer routers (knowledge, vault, verification)

The `services/` modules register additional routes for cross-cutting product surfaces — knowledge enrichment + elevation, vault, verification. These are real but not yet surfaced in the web UI. See `apps/api/src/services/{knowledge,vault,verification}/`.

---

## 5. SSE Streaming Protocol *(Plan 1)*

### 5.1 Wire format

`POST /api/v1/assistant/chat` with `Accept: text/event-stream` returns a long-lived response with `Content-Type: text/event-stream`. The response opens with an SSE primer line (`:\n\n`) to satisfy proxies (Cloudflare, AWS ALB) that close idle connections. Subsequent frames are `data: <json>\n\n`.

### 5.2 Event types (`packages/shared/src/stream-events.ts`)

```ts
type StreamEvent =
  | ThinkingStepEvent       // { type, step, status: 'active'|'done', detail? }
  | ThinkingSourcesEvent    // { type, sources: string[] } — K-codes
  | TokenEvent              // { type, text }
  | EvaluationEvent         // { type, score, confidence, decision: 'PASS'|'FIX'|'REJECT'|'BLOCK' }
  | SourcesEvent            // { type, citations: CitationItem[] }
  | ErrorEvent              // { type, message }
  | DoneEvent;              // { type }

type ThinkingStepName =
  | 'Assessing query'
  | 'Searching context'
  | 'Retrieving intelligence'
  | 'Analyzing'
  | 'Evaluating quality'
  | 'Answering';
```

### 5.3 Phase ordering

```
1. Assessing query        active → done
2. Searching context      active → done    detail = "<engagement> — <industry>"
3. Retrieving intelligence active → done
   ↳ thinking_sources event (inline, before phase done)
4. Analyzing              active → done
   ↳ runs runToolUseLoop (shared with chat() JSON path)
5. Evaluating quality     active → done    detail = "score N (DECISION)"
6. Answering              active → done
   ↳ token event (full response text, currently one-shot)
   ↳ sources event (citations from extractCitations)
   ↳ evaluation event
done
```

### 5.4 Error path

If any phase throws, the `phase()` helper emits `done` with `detail: 'failed'` for the in-flight phase, then the outer try/catch in `chatStream` emits an `error` event followed by `done`. The frontend's chat-store reducer marks the failed phase appropriately and shows the error in the UI.

### 5.5 Hard-block path

If `checkHardBlocks(responseText)` returns truthy, the streaming path **does not regenerate** (would re-emit phases). Instead it suppresses the response with a synthetic warning string and emits a synthetic evaluation `{score: 0, decision: 'BLOCK'}`. The frontend's `RefusalResponse` archetype handles this case.

### 5.6 Backward compatibility

`Accept: application/json` (the default) keeps the original JSON response shape (`{response, toolCalls, citations, references, confidence, data_gaps, evaluation}`) — byte-equivalent to pre-Plan-1 behavior.

---

## 6. Workflow Execution Engine *(services/workflows)*

### 6.1 Templates

JSON files in `apps/api/src/services/workflows/templates/`:

| ID | Category | Steps |
|---|---|---|
| `assess-regulatory-impact` | Compliance | 5 |
| `benchmark-company` | Reporting | 5 |
| `review-sustainability-report` | Reporting | ~6 |
| `screen-investment-esg` | Due Diligence | ~6 |
| `validate-emissions` | Climate | ~6 |

A template is `{id, name, description, category, steps[]}`. Each step has `{id, name, tool, inputs}` where `inputs` may contain `$variable` references that get substituted from prior step results or initial workflow inputs.

### 6.2 Tool handlers

Each step's `tool` field dispatches to one of these handlers:

| Tool | Backend module | Real? |
|---|---|---|
| `perceive_document` | `modules/agent/perception.ts` | Real |
| `judge_document` | `modules/agent/judgment.ts` | Real |
| `search_knowledge` | `modules/knowledge-base/search.service.ts` | Real (TF-IDF) |
| `verify_compliance` | `services/verification/compliance-checker.ts` | Real |
| `generate_text` | calls `agent/agent.service.ts:chat()` | Real |
| `detect_frameworks` | inline regex over document body | Real |
| `benchmark` | `semanticSearch` scoped to corporate disclosures | Real |
| `calculate` | `modules/calculation/calculation.service.ts` | Real |

### 6.3 Execution lifecycle

```
runWorkflow(templateId, engagementId, inputs)
  ├─ executionId = `wf-${ts}-${rand}`
  ├─ executionStore.set(executionId, { status: 'running', currentStep: 0, totalSteps: N })
  └─ for each step:
       ├─ executionStore.set(executionId, { ...current, currentStep: i+1 })
       ├─ resolved = substituteVariables(step.inputs, stepResults, inputs)
       ├─ result = await toolHandlers[step.tool](resolved, engagementId)
       └─ stepResults[step.id] = result
  └─ executionStore.set(executionId, { status: 'completed', results: stepResults, completedAt })
```

Errors mark `status: 'failed'` with `error: errorMessage` and capture partial `stepResults`.

The store is **in-memory** (`Map<string, WorkflowExecution>`) and lost on restart. Persistence to Mongo is filed as a follow-up.

### 6.4 Frontend status polling *(Phase H)*

The Workflow Agents page's Run button calls `runWorkflowTemplate`, then if the response is `running` it sets a `setInterval` polling `getWorkflowExecutionStatus` every 1.5s until status flips off `running`. Cleanup runs on unmount, on a new run starting, and on poll error.

---

## 7. AI Agent Architecture

### 7.1 Six Intelligence Capabilities

| Capability | Trigger | Output |
|---|---|---|
| **Perception** | Document open, every 30s | Section map, data mismatches, compliance gaps, readiness score |
| **Judgment** | Review buttons, `@merris review` | Section scores, critical issues, partner simulation |
| **Memory** | Every interaction | Conversation, decision, style memories persisted per engagement |
| **Multi-User** | Team activity | Team context, bottleneck detection |
| **Work Product** | Generate commands | Full reports, board packs, assurance packs, executive summaries |
| **Learning** | Apply / Revise / Skip | Style memory updates, quality signal capture |

### 7.2 Shared tool-use loop *(Phase E refactor)*

`tool-use-loop.ts` exports `runToolUseLoop({client, request, context, onToolCall?})` which is the **single** tool-use loop in the codebase. Both `chat()` (JSON path) and `chatStream()` (SSE path) call it. Up to 20 rounds, 41 registered tools, full message history threading.

`onToolCall` callback fires after each tool executes. The SSE path uses it to accumulate `domain` hints from `TOOL_CITATION_MAP` for the `thinking_sources` event.

### 7.3 Citation extraction *(Plan 1 follow-up #1)*

`citations.ts` houses `extractCitations(toolCalls)`, `TOOL_CITATION_MAP` (13 mapped tools with authoritative source metadata), `determineConfidence`, and `toWireCitations(Citation[]) → CitationItem[]`. Both chat paths produce identical citation sets.

### 7.4 Two-layer evaluator *(services/assistant/evaluator.ts)*

1. **Hard-block check** — fast deterministic regex against the response. If matched, regenerate once (JSON) or suppress with warning (SSE).
2. **AI evaluator** — LLM-based scoring of the response against the user query. Returns `{score, decision: 'PASS'|'FIX'|'REJECT', flags, fix_instructions?}`. On `FIX`, calls `autoRewrite`. On `REJECT`, regenerates once.

### 7.5 @Merris command classification (Word add-in)

```
@merris review the numbers       → REVIEW    → Word comment + Insight card
@merris write an intro           → WRITE     → Action card (user applies)
@merris shorten this paragraph   → EDIT      → Action card with before/after
@merris insert emissions table   → INSERT    → Action card with table preview
@merris explain scope 3          → EXPLAIN   → Chat tab response
@merris add references           → REFERENCE → Action card with citations
@merris                          → EXPLAIN   → Context-aware suggestion in chat
```

### 7.6 Knowledge base search

TF-IDF sparse vector search across 7 KB domains via `services/knowledge/knowledge.service.ts` and `modules/knowledge-base/search.service.ts`. The semantic search service is **real** and queries real seeded collections — the Knowledge web page does NOT yet wire to it (see §11 What's Real vs Scaffolding).

---

## 8. Web Application

### 8.1 Routes (15 total)

| Route | Component | Status |
|---|---|---|
| `/` | Server-side redirect → `/intelligence` | Real |
| `/login`, `/register` | Auth pages (restyled in Plan 2) | Real backend |
| `/intelligence` | `IntelligenceView` 3-phase orchestrator | Real (chat against real backend, multi-turn) |
| `/portfolio` | `PortfolioGrid` + `EngagementCard` + `NewEngagementModal` | Real (api.listEngagements, createEngagement) |
| `/portfolio/[id]` | `EngagementDetail` (header, readiness donut, framework grid, findings, sidebar, documents) | Real engagement + uploads; framework % and findings are placeholder |
| `/portfolio/[id]/documents/[docId]` | `DocumentViewer` (header, content, annotations sidebar) | Real document content; annotations are in-memory backend |
| `/knowledge` | `KnowledgePage` (Plan 5) | Hydrates from `/knowledge-base/collections` (Phase G scaffolding) |
| `/compliance` | `CompliancePage` (Plan 5) | Hydrates from `/engagements/:id/framework-compliance` (Phase G scaffolding) |
| `/firm-library` | `FirmLibraryPage` (Plan 5) | Static prototype |
| `/workflow-agents` | `WorkflowAgentsPage` Library + Builder tabs | **Real** (hydrates from real `/workflows/templates`, runs via `/workflows/:id/run` with status polling) |
| `/history` | `HistoryPage` | Hydrates from `/assistant/history` (Phase G scaffolding) |
| `/config` | `AIConfigPage` | Frontend localStorage only |
| `/settings` | `SettingsPage` (4 sub-tabs: Profile, Team, Preferences, Billing) | Profile real (auth store); rest from Phase G scaffolding |

### 8.2 Component layout

```
components/
├── merris/                          Prototype-faithful primitives
│   ├── pill.tsx, chip.tsx          variants matched to prototype
│   ├── button.tsx                  MerrisButton (primary/secondary)
│   ├── card.tsx                    MerrisCard with optional hover
│   ├── score-ring.tsx              small ring + 130px donut
│   ├── label.tsx                   SectionLabel
│   ├── sidebar.tsx                 192px, 9 nav items
│   ├── top-bar.tsx                 engagement selector dropdown wired to store
│   └── placeholder-page.tsx        used by route stubs
├── intelligence/
│   ├── intelligence-view.tsx       3-phase orchestrator (home → thinking → response)
│   ├── intelligence-hero.tsx       home phase
│   ├── jurisdiction-chips.tsx      Qatar/Oman/UAE/Saudi/EU/UK
│   ├── source-toggles.tsx          K1-K7 + Web
│   ├── chat-input.tsx              hero composer (with context controls)
│   ├── working-header.tsx          M avatar + "Working..." pill
│   ├── thinking-state.tsx          vertical timeline subscribed to chat-store
│   ├── advisory-response.tsx       default response archetype
│   ├── refusal-response.tsx        BLOCK decision archetype
│   ├── citations-list.tsx          rendered inside response cards
│   ├── conversation-message.tsx    completed exchange in history
│   └── follow-up-input.tsx         simplified composer for follow-ups (Plan I)
├── portfolio/
│   ├── portfolio-grid.tsx
│   ├── engagement-card.tsx
│   ├── new-engagement-modal.tsx
│   ├── engagement-empty-state.tsx
│   ├── engagement-detail.tsx       orchestrator
│   ├── engagement-detail-header.tsx
│   ├── engagement-detail-readiness.tsx     130px donut
│   ├── engagement-detail-frameworks.tsx    4-cell compliance grid (placeholder)
│   ├── engagement-detail-findings.tsx      severity-coloured cards (placeholder)
│   ├── engagement-detail-sidebar.tsx       Workflow Terminal + Team
│   └── engagement-documents-section.tsx    real upload + list
├── document-viewer/
│   ├── document-viewer.tsx                 orchestrator with mode tabs
│   ├── document-viewer-header.tsx          name + version + Edit/Review/Export
│   ├── document-viewer-content.tsx         paragraph renderer (no rich text yet)
│   ├── document-annotations-sidebar.tsx    apply/dismiss with optimistic UI
│   ├── document-empty-state.tsx
│   └── document-viewer-data.ts             ANNOTATIONS_FIXTURE fallback
├── pages/
│   ├── knowledge/{knowledge-data.ts, knowledge-page.tsx}
│   ├── workflow-agents/{workflow-agents-data.ts, workflow-agents-page.tsx, builder-tab.tsx}
│   ├── compliance/{compliance-data.ts, compliance-page.tsx}
│   ├── firm-library/{firm-library-data.ts, firm-library-page.tsx}
│   ├── history/{history-data.ts, history-page.tsx}
│   ├── config/ai-config-page.tsx
│   └── settings/settings-page.tsx
└── ui/                              shadcn-style primitives kept for Radix dialogs/dropdowns
```

### 8.3 State management

- **Zustand** stores in `lib/`:
  - `useAuthStore` — user, token, org, locale, sidebar state
  - `useEngagementStore` — current engagement, engagements list
  - `useChatStore` — phase, thinkingSteps, tokenText, citations, evaluation, **messages[]** (multi-turn), jurisdiction, knowledgeSources, errorMessage
- **API client** — `lib/api.ts` is a typed `ApiClient` class with: token management, generic `get/post/put/patch/delete`, multipart `upload`, plus typed domain methods covering every real backend route + the SSE `chatStream(payload, onEvent)` consumer that parses `data:` frames into typed `StreamEvent` objects.

### 8.4 Test infrastructure *(Phase L)*

```
apps/web/
├── vitest.config.ts                jsdom env, @ alias, vitest globals
├── vitest.setup.ts                 jest-dom matchers via expect.extend
├── lib/chat-store.test.ts          10 reducer tests (handleEvent exported)
├── components/merris/pill.test.tsx 4 RTL tests
└── components/intelligence/
    └── conversation-message.test.tsx  5 RTL tests
```

19 tests total, all passing. `pnpm --filter @merris/web test`.

The dual-vitest-version workaround (jest-dom matchers via explicit `expect.extend`) is documented inline in `vitest.setup.ts`.

---

## 9. Word Add-in (4-Tab Architecture)

```
┌──────────────────────────────────────────┐
│  [Insights]  [Actions]  [Chat]  [History]│
├──────────────────────────────────────────┤
│                                          │
│  Tab content area (scrollable)           │
│                                          │
├──────────────────────────────────────────┤
│  67/100 │ 3 actions │ 2 new insights     │
│  [Ask Merris...                        ] │
└──────────────────────────────────────────┘
```

### Modules

| File | Responsibility |
|---|---|
| `state.ts` | Central state manager, event emitter, typed data structures |
| `document-ops.ts` | Word.js operations (read, insert, replace, comment, table, scroll) |
| `tabs/insights-tab.ts` | Section map, insight cards, review buttons, score display |
| `tabs/actions-tab.ts` | Action queue with Preview/Apply/Revise/Skip, batch ops |
| `tabs/chat-tab.ts` | Conversational UI, response routing |
| `tabs/history-tab.ts` | Activity log, "Catch me up" summary |
| `footer.ts` | Score, counts, quick input, proactive toggle |
| `merris-commands.ts` | @Merris polling (3s), classification, tab routing |
| `perception.ts` | Auto-perception on load, 30s re-perception, insight generation |
| `taskpane.ts` | Slim orchestrator: Office.onReady, engagement selection, module init |

### Design Rules

- **Only Actions tab modifies the document** (via explicit [Apply])
- **Nothing auto-inserts** — user approves every change
- **@Merris commands route to tabs** — REVIEW/EXPLAIN never touch the document body
- **Tab badges** notify of new unread items
- **Footer quick input** routes to Chat (which may create Actions/Insights)

### Status (Phase E)

The add-in **compiles** after Phase E rescued the in-flight WIP from the original session-start dirty state and added the missing api-client type stubs (`judgeFullDocument`, `verifyDocument`, `runWorkflow`, plus `DocumentJudgment`, `VerifyDocumentResult`, `RunWorkflowResult` shapes). It has **not been verified at runtime in actual Word in this session** — that's the highest-priority Phase E follow-up.

---

## 10. Data Layer

### 10.1 Seeded Frameworks (13+)

| Code | Framework | Region | Type |
|---|---|---|---|
| `gri` | GRI Standards 2021 | Global | Voluntary |
| `esrs` | ESRS 2024 | EU | Mandatory |
| `issb` | IFRS S1 & S2 | Global | Mandatory |
| `tcfd` | TCFD Recommendations | Global | Voluntary |
| `cdp` | CDP Climate 2025 | Global | Rating |
| `sasb-og` | SASB Oil & Gas | Global | Voluntary |
| `sasb-re` | SASB Real Estate | Global | Voluntary |
| `saudi-exchange` | Saudi Exchange 29 KPIs | Saudi Arabia | Mandatory |
| `adx` | ADX ESG Guide | UAE | Mandatory |
| `qse` | QSE ESG Guidance | Qatar | Voluntary |

### 10.2 Emission Factor Sources

DEFRA 2025 (UK) · EPA 2025 (US) · GHG Protocol GWP · Global grid factors (all countries) · GCC-specific grid factors · IPCC AR6 carbon budgets

### 10.3 Cross-Framework Mappings

GRI ↔ CDP, ESRS, ISSB, Saudi Exchange · EU Taxonomy ↔ ESRS · SFDR ↔ TCFD · SFDR PAI ↔ GRI · CSDDD ↔ GRI 308/414, ESRS S2

### 10.4 Real public data seeds (apps/api/src/scripts/)

~25 seed scripts that pull from real public data sources. Each populates a real Mongo collection that the agent's tool handlers query at runtime. **None of this is mocked.**

| Script | Source | Powers tool |
|---|---|---|
| `seed-water-risk.ts` | WRI Aqueduct 4.0 | `get_water_stress` |
| `seed-climate-vulnerability.ts` | ND-GAIN Country Index | `get_climate_vulnerability` |
| `seed-slavery-index.ts` | Walk Free Global Slavery Index | `get_forced_labour_risk` |
| `seed-sbti-targets.ts` | SBTi Companies Taking Action | `get_sbti_status` |
| `seed-country-emissions.ts`, `seed-energy-instruments.ts` | IEA | `get_emission_factor` |
| `seed-knowthechain.ts`, `seed-forced-labour-goods.ts` | US ILAB | `get_product_labour_risk` |
| `seed-protected-areas.ts`, `seed-forest-data.ts` | IUCN, GBIF, WDPA | biodiversity tools |
| `seed-sector-benchmarks.ts` | worldsteel, IEA, GCCA, IOGP | `get_anomaly_check` |
| `seed-precedent-cases.ts` | Merris precedent library | `get_precedent` |
| `seed-decarbonisation-pathways.ts`, `seed-carbon-pricing.ts`, `seed-abatement-tech.ts`, `seed-regulatory-maturity.ts`, `seed-corruption-index.ts`, `seed-ndc-targets.ts`, `seed-facility-emissions.ts`, `seed-partner-intelligence.ts`, `seed-assurance-standards.ts` | Various public sources | Various |

These scripts must be run after a fresh deploy. Without them, the agent tools return empty results and citations don't fire.

---

## 11. What's Real vs Scaffolding *(honesty matrix)*

This section exists because earlier versions of this doc, and earlier statements from the implementation team, were imprecise about which parts of the system have real data paths and which return hardcoded placeholders. The reality:

### 11.1 Real (works against real data + real backend code)

- Auth (register, login, JWT, bcrypt)
- Engagements list / create / detail
- Document upload → ingestion → text extraction → retrieval
- Agent chat (JSON + SSE), tool-use loop, citation extraction
- 41+ agent tools with real Mongo-backed handlers (water risk, SBTi, climate vulnerability, emission factors, etc.)
- Workflow execution engine + 5 real templates + 8 tool handlers + status polling
- Two-layer evaluator
- Conversation memory capture
- Knowledge base TF-IDF semantic search
- Knowledge base report ingestion + extraction
- Document perception + judgment (used by Word add-in)
- ~20 seed scripts pulling from real public data sources

### 11.2 Real backend, frontend not yet wired

- The Knowledge web page shows hardcoded K1-K7 metadata but the **real KB collections + semantic search service exist**. Wire by querying the real collections for entry counts.
- The History web page shows 4 hardcoded entries but **real `conversation_memories` exist**. Wire by projecting that collection.
- The Engagement Detail's framework compliance grid is hardcoded, but `verify_compliance` tool can produce it per-document. Aggregate per engagement.
- Workflow Agents "Recently Run" cards are hardcoded; `GET /workflows/history` already returns the real execution store.

### 11.3 Real but unverified at runtime

- Word add-in (compiles, never opened in real Word)
- Several agent tool handlers (defined, not exercised end-to-end)
- The 5 workflow templates (handlers are real but require seeded engagements + KB to produce useful output)

### 11.4 Scaffolding *(`seeded: false` placeholder routes — Phase G)*

- `/knowledge-base/collections`, `/engagements/:id/framework-compliance`, `/engagements/:id/findings`, `/assistant/history`, `/team`, `/preferences`, `/billing` — all return hardcoded data with the `seeded: false` flag.

### 11.5 In-memory only

- Workflow execution store (lost on restart — persistence is a follow-up)
- Document annotation store (Phase K-lite — Mongo persistence is the next step)

### 11.6 Pure frontend hardcoded

- AI Config page localStorage toggles
- Workflow Agents page hardcoded prebuilt agents (used as fallback when real templates fail to load)
- Firm Library page (no backend module exists)
- Compliance page disclosure matrix
- Settings page Profile fallback values

---

## 12. Infrastructure

### 12.1 Queue System (BullMQ + Redis)

| Queue | Purpose |
|---|---|
| `document-ingestion` | Process uploaded documents |
| `pdf-extraction` | Extract text/data from PDFs |
| `calculation-engine` | Run ESG calculations |
| `report-generation` | Generate report exports |
| `embedding-generation` | Build TF-IDF vectors |

### 12.2 Scripts

| Script | Command | Purpose |
|---|---|---|
| `seed.ts` | `pnpm seed` | Seed frameworks, disclosures, emission factors, cross-maps |
| `seed-knowledge-base.ts` | `pnpm seed:kb` | Seed K1-K7 entries |
| `download-reports.ts` | `pnpm download:reports` | Download corporate disclosure PDFs |
| `generate-embeddings.ts` | `pnpm generate:embeddings` | Build TF-IDF sparse vectors |
| `seed-*.ts` (~20 scripts) | individual | Real public data seeds (see §10.4) |
| `sse-smoke-test.ts` | `pnpm --filter @merris/api smoke:sse` | Standalone SSE wire-format launcher with in-memory Mongo + fetch interceptor for Anthropic |

### 12.3 Authentication Flow

1. Check localStorage for existing JWT
2. Try Merris API login (email/password)
3. Try Office SSO (Azure AD) — Word add-in
4. Fall back to dialog login
5. Auto-retry on 401 with fresh token

**Status:** the bcrypt + JWT path is real; Microsoft OAuth migration is the highest-priority decision in `docs/superpowers/decisions/2026-04-06-prod-readiness-decisions.md` (decision 2.1).

### 12.4 Environment Variables

```
MONGODB_URI                       MongoDB connection string
REDIS_URL                         Redis connection string
ANTHROPIC_API_KEY                 Claude API key
JWT_SECRET                        JWT signing secret
PORT                              API server port (3001)
NEXT_PUBLIC_API_URL               API URL for web app
NEXT_PUBLIC_APP_URL               Web app URL
AZURE_TENANT_ID                   Azure AD tenant
AZURE_CLIENT_ID                   Azure AD client
AZURE_CLIENT_SECRET               Azure AD secret
AZURE_STORAGE_CONNECTION_STRING   Blob storage
```

### 12.5 Deployment

**Status:** none. The product has never been deployed. All testing in this session has been against `localhost` with the in-memory smoke launcher. Hosting target decisions (1.1, 1.2, 1.3, 1.4) are blockers in the production-readiness decisions document.

---

## 13. Security

- **JWT authentication** on all endpoints (except register/login)
- **Role-based access control** (owner > admin > manager > analyst > reviewer > auditor_readonly)
- **Organization isolation** — every Mongo query that touches user data is scoped by `orgId`. **Multi-tenant isolation has not been formally audited.** This is a blocker before alpha (decision 2.5).
- **Zod validation** on most request bodies (some routes still use loose `any` casts)
- **bcrypt** password hashing (cost factor default)
- **CORS** enabled with credentials
- **Multipart upload** capped at 50 MB
- **API key** secured via environment variable

### Known gaps before production

- No rate limiting (decision 2.3)
- No CSRF protection (decision 2.4)
- localStorage JWT storage is XSS-vulnerable (decision 2.2 — switch to httpOnly cookies)
- No audit logging on state changes (decision 2.8)
- No secret rotation (decision 2.7)
- No penetration test (decision 2.6)

---

## 14. Test Infrastructure

### 14.1 Backend (apps/api)

Vitest 1.6.x with `MongoMemoryServer` and mocked Anthropic client.

| Test file | Count | What it covers |
|---|---|---|
| `agent.test.ts` | 25 pass / 3 fail | Auth, tool dispatch, action execution. **3 pre-existing failures from a tool count drift (41 → 44)**, not introduced by this session's work. |
| `agent.stream.test.ts` | 8 pass | Phase ordering, content negotiation, citation parity, getClient null branch, outer catch / failed phase, hard-block path |
| Various module tests | — | auth, ingestion, organization, data-collection, framework, assurance |

### 14.2 Frontend (apps/web — Phase L)

Vitest 2.1.x with React Testing Library + jsdom.

| Test file | Count | What it covers |
|---|---|---|
| `lib/chat-store.test.ts` | 10 pass | `handleEvent` reducer (exported for testing) — phase transitions, sources, token, evaluation, error, done with messages push |
| `components/merris/pill.test.tsx` | 4 pass | Pill primitive renders + variant classes |
| `components/intelligence/conversation-message.test.tsx` | 5 pass | ConversationMessage renders question/answer/citations/confidence |

19 tests total, all green. `pnpm --filter @merris/web test`.

### 14.3 What tests prove and don't prove

**Prove:** the asserted invariants hold in the test environment with documented mocks.

**Do NOT prove:** real Anthropic responses are good, real RAG retrieval quality, UI behavior in a real browser, performance under load, end-to-end integration with real Mongo + Redis + queues. **No end-to-end test against a real production environment exists in this session because no production environment exists yet.**

---

## 15. Plans & decisions

### 15.1 Implementation plans (`docs/superpowers/plans/`)

| Plan | Status |
|---|---|
| `2026-04-06-backend-chat-sse.md` | Plan 1 — shipped |
| `2026-04-06-web-foundation.md` | Plan 2 — shipped |
| `2026-04-06-intelligence-page.md` | Plan 3 — shipped |
| `2026-04-06-portfolio.md` | Plan 4 — shipped |
| `2026-04-06-remaining-pages.md` | Plan 5 — shipped |
| `2026-04-06-document-viewer.md` | Doc viewer module — shipped |
| Earlier (`2026-03-29-*`, `2026-04-03-*`) | Pre-session planning |

### 15.2 Production-readiness decisions (`docs/superpowers/decisions/`)

`2026-04-06-prod-readiness-decisions.md` — **55 decisions across 8 tracks** (Software/Infrastructure, Auth & Security, Observability & Ops, Data & ESG vertical, Product scope & voice, Legal & compliance, Go-to-market & partners, Workforce / division of labor). Lock these to unblock multi-agent execution of the production-readiness phases.

The two highest-leverage decisions:
- **2.1 — Auth provider** (Microsoft OAuth recommended)
- **4.1 — ESG vertical focus** (CSRD/ESRS recommended)

---

## 16. Collection Summary

| Collection | Count | Purpose |
|---|---|---|
| `users` | — | User accounts |
| `organizations` | — | Organizations |
| `teams` | — | Team groupings |
| `orgprofiles` | — | Organization profiles |
| `frameworkrecommendations` | — | Framework recommendations |
| `frameworks` | 13+ | ESG framework definitions |
| `disclosures` | 300+ | Flattened disclosure requirements |
| `cross_framework_maps` | 8+ | Framework-to-framework mappings |
| `emission_factors` | 500+ | Emission factor database |
| `engagements` | — | Client engagements |
| `esgdocuments` | — | Uploaded documents |
| `datapoints` | — | Collected ESG data |
| `workflowdefinitions` | — | Workflow stage tracking |
| `reports` | — | Generated reports |
| `presentations` | — | Generated presentations |
| `kb_corporate_disclosures` | — | K1: Peer reports |
| `kb_climate_science` | — | K2: IPCC, IEA, SBTi |
| `kb_regulatory` | — | K3: Regulations |
| `kb_sustainable_finance` | — | K4: Green bonds |
| `kb_environmental_science` | — | K5: TNFD |
| `kb_supply_chain` | — | K6: Due diligence |
| `kb_research` | — | K7: Academic |
| `kb_embeddings` | — | TF-IDF search vectors |
| `kb_knowledge_reports` | — | Extracted report metrics |
| `kb_water_risk` | seeded | WRI Aqueduct |
| `kb_climate_vulnerability` | seeded | ND-GAIN |
| `kb_sbti_targets` | seeded | SBTi |
| `kb_country_emissions` | seeded | IEA |
| `kb_slavery_index` | seeded | Walk Free |
| `kb_forced_labour_goods` | seeded | US ILAB |
| `kb_threatened_species` | seeded | IUCN Red List |
| `kb_protected_areas` | seeded | WDPA |
| (other agent-tool collections) | seeded | various — see §10.4 |
| `conversation_memories` | — | AI conversation history |
| `decision_memories` | — | Decision audit trail |
| `style_memories` | — | Writing style preferences |
| `sharepointconnections` | — | SharePoint integrations |
| `sharepointsynclogs` | — | Sync activity logs |
| **(in-memory)** `executionStore` | — | Workflow executions (Phase F — Mongo persistence is a follow-up) |
| **(in-memory)** `annotationStore` | — | Document annotations (Phase K-lite — Mongo persistence is a follow-up) |

---

## 17. Build & test commands

```bash
# Full monorepo build (8 tasks: shared, api, web, teams-bot, 4 office-addins)
pnpm build

# Per-package builds
pnpm --filter @merris/shared build
pnpm --filter @merris/api build
pnpm --filter @merris/web build

# Tests
pnpm --filter @merris/api test               # Vitest, includes agent.stream.test.ts
pnpm --filter @merris/web test                # Vitest + RTL + jsdom (19 tests)

# Dev servers
pnpm --filter @merris/api dev                 # API on :3001 (requires Mongo + Redis + Claude key)
pnpm --filter @merris/web dev                 # Web on :3000

# SSE smoke launcher (in-memory Mongo + Anthropic fetch interceptor)
pnpm --filter @merris/api smoke:sse           # Listens on :3099, prints curl commands
```

---

## 18. Open questions & known gaps

| # | Item | Owner |
|---|---|---|
| 1 | Multi-tenant isolation audit script | SE |
| 2 | Workflow execution Mongo persistence | SE |
| 3 | Annotation Mongo persistence | SE |
| 4 | Word add-in runtime verification | Joint |
| 5 | Real RAG corpus for chosen vertical (ESRS recommended) | ESG |
| 6 | Evaluator validation against 30 expert-graded ESG questions | ESG |
| 7 | Real findings aggregation from `judgeDocument` outputs | SE |
| 8 | Hosting + observability + CI/CD provisioning | SE |
| 9 | Lawyer-reviewed privacy policy + ToS + DPA | ESG (+lawyer) |
| 10 | Microsoft OAuth migration | SE |
| 11 | Rate limiting + CSRF + httpOnly cookies | SE |
| 12 | Three pre-existing test failures in `agent.test.ts` (tool count drift) | SE |

See `docs/superpowers/decisions/2026-04-06-prod-readiness-decisions.md` for the full 55-decision blocker list.

---

**Summary line:** 30+ Mongo collections, ~110 backend routes (real + scaffolding), 16 API modules + 6 service-layer modules, 4 Office add-ins, 7 knowledge domains + ~12 agent-tool collections, 15 web routes, 19 web tests + 33 api tests.
