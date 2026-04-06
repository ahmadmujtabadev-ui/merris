# Merris Platform Architecture

> **AI co-pilot for ESG professionals.** Harvey-for-ESG model embedded in Office 365.
> GCC beachhead (mandatory ESG disclosure wave), expanding to EU/APAC.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Word     │ │ Excel    │ │ PowerPt  │ │ Outlook  │      │
│  │ Add-in   │ │ Add-in   │ │ Add-in   │ │ Add-in   │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │             │            │             │             │
│  ┌────┴─────┐ ┌────┴─────┐ ┌───┴──────┐                   │
│  │ Teams   │ │ Web App  │ │ Mobile   │                    │
│  │ Bot     │ │ (Next.js)│ │ (future) │                    │
│  └────┬─────┘ └────┬─────┘ └───┬──────┘                   │
└───────┼─────────────┼───────────┼──────────────────────────┘
        │             │           │
        └─────────────┼───────────┘
                      │
              ┌───────▼───────┐
              │  Fastify API  │
              │  /api/v1/*    │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
   │ MongoDB │  │  Redis  │  │ Claude  │
   │         │  │ (BullMQ)│  │   API   │
   └─────────┘  └─────────┘  └─────────┘
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| API | Fastify 4 + TypeScript |
| Database | MongoDB 8 + Mongoose |
| Queue | BullMQ + Redis |
| AI | Claude API (Anthropic SDK) |
| Web | Next.js 14 (App Router) |
| Office | Office.js + webpack |
| Teams | Bot Framework + Adaptive Cards |
| Auth | JWT + bcrypt |
| Build | Turborepo + pnpm |

---

## 2. Monorepo Structure

```
merris-platform/
├── apps/
│   ├── api/                    # Fastify backend (86 source files)
│   │   ├── src/
│   │   │   ├── server.ts       # Entry point
│   │   │   ├── lib/            # Infrastructure (db, queue, claude, storage, logger, graph)
│   │   │   ├── models/         # Shared Mongoose models
│   │   │   ├── modules/        # Feature modules (16 modules)
│   │   │   └── scripts/        # Seed, download, embedding scripts
│   │   └── package.json
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # Pages (App Router)
│   │   ├── components/         # React components
│   │   └── lib/                # Store, API client, i18n
│   ├── office-addins/          # Office 365 add-ins
│   │   ├── word/               # Word add-in (4-tab architecture)
│   │   ├── excel/              # Excel add-in
│   │   ├── powerpoint/         # PowerPoint add-in
│   │   ├── outlook/            # Outlook add-in
│   │   └── shared/             # Shared add-in code (API client, auth, styles)
│   └── teams-bot/              # Microsoft Teams bot
├── packages/
│   └── shared/                 # Types, constants, validators (Zod)
├── data/                       # Framework definitions, emission factors, knowledge base
├── turbo.json                  # Turborepo config
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

**Organizations** (`organizations`)
```
name            String
type            Enum        consulting | corporate | regulator
plan            Enum        starter | professional | enterprise
region          String
industry        String
settings        {language, timezone, currency}
branding        {logo, primaryColor, secondaryColor, fontFamily}
```

**Teams** (`teams`)
```
name            String
orgId           ObjectId    → organizations
memberIds       [ObjectId]  → users
leadId          ObjectId    → users
```

**Org Profiles** (`orgprofiles`)
```
orgId           ObjectId    unique → organizations
legalName       String
tradingName     String
country         String
industryGICS    String
listingStatus   Enum        listed | private | state_owned | sme
employeeCount   Number
facilities      [{name, type, country, coordinates, scope1Sources}]
currentFrameworks [String]
esgMaturity     Enum        none | beginner | intermediate | advanced
reportingHistory [{year, frameworks, url}]
```

**Framework Recommendations** (`frameworkrecommendations`)
```
orgId           ObjectId    unique → organizations
recommendations [{framework, category: mandatory|recommended|optional, reason, regulation}]
selections      {selected[], deselected[], confirmedAt}
```

### 3.2 ESG Frameworks

**Frameworks** (`frameworks`)
```
id              String      unique (e.g., "fw-gri-2021")
code            String      (e.g., "gri")
name            String
version         String
effectiveDate   Date
issuingBody     String
region          String      (e.g., "global", "EU", "Saudi Arabia")
type            Enum        mandatory | voluntary | rating | taxonomy
structure       {topics: [{code, name, disclosures: [...]}]}
```

**Disclosures** (`disclosures`) — flattened for cross-framework querying
```
id              String      unique
frameworkId     String      indexed
frameworkCode   String      indexed
code            String      indexed (e.g., "305-1")
name            String      text-indexed
description     String      text-indexed
topic           String      indexed
dataType        Enum        quantitative | qualitative | narrative | table
requiredMetrics [{name, unit, calculationMethod, description}]
guidanceText    String
crossReferences [{frameworkCode, disclosureCode, mappingType: equivalent|partial|related}]
```

**Cross-Framework Maps** (`cross_framework_maps`)
```
sourceFramework String      indexed
targetFramework String      indexed
version         String
mappings        [{gri_code, gri_name, target_code, target_name, mapping, notes}]
```

**Emission Factors** (`emission_factors`)
```
source          String      indexed (e.g., "DEFRA", "EPA")
country         String      indexed
year            Number      indexed
factor          Number
unit            String      (e.g., "kg CO2e / kWh")
scope           Enum        1 | 2 | 3
category        String      indexed
fuelType        String      indexed
```

### 3.3 Engagements & Data

**Engagements** (`engagements`)
```
orgId           ObjectId    → organizations
clientOrgId     ObjectId    optional → organizations
name            String
frameworks      [String]    framework codes
status          Enum        setup | data_collection | drafting | review | assurance | completed
deadline        Date
scope           {reportingPeriod: {start, end}, baselineYear, reportType, assuranceLevel}
```

**ESG Documents** (`esgdocuments`)
```
engagementId    ObjectId    indexed → engagements
filename        String
format          String
size            Number
hash            String
uploadSource    Enum        sharepoint | manual | email | api
status          Enum        queued | processing | ingested | failed
extractedData   [{metric, value, unit, confidence, pageRef, cellRef}]
extractedText   String
blobUrl         String
```

**Data Points** (`datapoints`)
```
engagementId    ObjectId    indexed → engagements
documentId      ObjectId    → esgdocuments
frameworkRef    String      (e.g., "GRI 305-1")
metricName      String
value           Number|String
unit            String
period          {year, quarter}
confidence      Enum        high | medium | low
status          Enum        auto_extracted | user_confirmed | user_edited | estimated | missing
extractionMethod Enum       ocr | table_parse | llm_extract | calculation | manual
auditTrail      [{action, userId, timestamp, previousValue, newValue, notes}]
```

### 3.4 Workflow & Reports

**Workflow Definitions** (`workflowdefinitions`)
```
engagementId    ObjectId    unique → engagements
stages          [{name, order, status, enteredAt, completedAt, approvedBy}]
currentStage    String
history         [{fromStage, toStage, action, performedBy, reason}]
```

Stage sequence: `Setup → Data Collection → Drafting → Internal Review → Partner Approval → Client Review → Assurance Prep → Final`

**Reports** (`reports`)
```
engagementId    ObjectId    indexed → engagements
title           String
type            Enum        sustainability_report | esg_report | tcfd_report | integrated_report | cdp_response | custom
language        Enum        en | ar | bilingual
status          Enum        draft | in_review | partner_approved | client_approved | final
structure       [{id, title, frameworkRef, disclosures, content, dataPoints, status, reviewComments}]
exportFormats   [Enum]      docx | pdf | html
```

**Presentations** (`presentations`)
```
engagementId    ObjectId    indexed → engagements
title           String
type            Enum        board_pack | investor_presentation | client_deliverable | strategy_deck | ...
slides          [{id, title, layout, content: {text, dataPoints, chartType, chartData, tableData}, speakerNotes}]
branding        {logo, primaryColor, secondaryColor, fontFamily}
```

### 3.5 Knowledge Base (7 Domains)

| Collection | Domain | Key Fields |
|-----------|--------|-----------|
| `kb_corporate_disclosures` | K1 | company, ticker, sector, reportYear, reportType, keyMetrics |
| `kb_climate_science` | K2 | source, category (ipcc/iea/ngfs/wri/ghg_protocol/sbti), data |
| `kb_regulatory` | K3 | jurisdiction, category, requirements[], penalties |
| `kb_sustainable_finance` | K4 | source, category (green_bonds/esg_ratings/taxonomy/pcaf) |
| `kb_environmental_science` | K5 | source, category (tnfd/biodiversity/water/circular_economy) |
| `kb_supply_chain` | K6 | source, category (due_diligence/forced_labour/conflict_minerals) |
| `kb_research` | K7 | authors, publication, abstract, keyFindings, citationKey |

**Embeddings** (`kb_embeddings`) — TF-IDF sparse vectors for semantic search
```
sourceCollection String     indexed
sourceId         ObjectId
domain           Enum       K1-K7
text             String
tfidfVector      Map<String, Number>
denseTerms       [String]   top 500 terms
denseWeights     [Number]
magnitude        Number     L2 norm for cosine similarity
```

**Knowledge Reports** (`kb_knowledge_reports`) — extracted metrics from corporate reports
```
company         String
reportYear      Number
sector          String      indexed
metrics         [{name, value, unit, frameworkRef, yearOverYear, confidence}]
narratives      [{frameworkRef, title, content, qualityScore, wordCount}]
quality         {overallScore, frameworkCoverage, dataCompleteness, narrativeQuality, assuranceLevel}
```

### 3.6 AI Memory

**Conversation Memory** (`conversation_memories`)
```
engagementId    ObjectId    indexed
userId          ObjectId    indexed
channel         Enum        word | excel | powerpoint | outlook | teams | web
userMessage     String
agentResponse   String
toolsUsed       [String]
documentContext String
```

**Decision Memory** (`decision_memories`)
```
engagementId    ObjectId    indexed
decision        String
reasoning       String
alternatives    [String]
context         String
category        Enum        methodology | framework | data | framing | scope | other
revisitable     Boolean
```

**Style Memory** (`style_memories`)
```
userId          ObjectId    indexed
orgId           ObjectId    indexed
clientOrgId     ObjectId    indexed
category        Enum        writing | formatting | framing | terminology | tone
preference      String
evidence        [String]
confidence      Number      0.0 - 1.0
```

### 3.7 Integrations

**SharePoint Connections** (`sharepointconnections`)
```
orgId           ObjectId    indexed
driveId         String
folderId        String
engagementId    ObjectId    indexed
status          Enum        active | disconnected | error
webhookSubscriptionId String
lastSync        Date
```

**SharePoint Sync Logs** (`sharepointsynclogs`)
```
connectionId    ObjectId    indexed
action          Enum        file_added | file_updated | file_deleted | full_sync | webhook_received
fileName        String
status          Enum        success | failed | skipped
```

---

## 4. API Routes

**Base:** `/api/v1` | **Auth:** JWT Bearer | **Validation:** Zod

### Authentication
```
POST   /auth/register              Register user + org
POST   /auth/login                 Login → JWT token
POST   /auth/refresh               Refresh token
GET    /auth/me                    Current user
POST   /users/invite               Invite user (owner|admin)
GET    /users                      List org users
PUT    /users/:id/role             Change role (owner)
```

### Organizations
```
POST   /organizations/:id/profile                  Create/update org profile
GET    /organizations/:id/profile                   Get org profile
GET    /organizations/:id/framework-recommendations Get recommended frameworks
POST   /organizations/:id/framework-selections      Confirm framework selection
```

### Frameworks & Data
```
GET    /frameworks                              List all frameworks
GET    /frameworks/:code                        Get framework by code
GET    /frameworks/:code/disclosures            List disclosures
GET    /disclosures/:id                         Get disclosure detail
GET    /disclosures/:id/cross-references        Cross-framework mappings
GET    /engagements/:id/data-agenda             Data collection agenda
GET    /emission-factors                        Query emission factors
GET    /emission-factors/:country/grid          Grid emission factor
```

### Engagements
```
GET    /engagements                             List engagements
POST   /engagements                             Create engagement
```

### Document Ingestion
```
POST   /engagements/:id/documents               Upload document (multipart, 50MB max)
GET    /engagements/:id/documents               List documents
GET    /documents/:id                           Get document
POST   /documents/:id/process                   Trigger processing
```

### Data Collection
```
GET    /engagements/:id/data-points             List data points (filter: status, framework, confidence)
POST   /engagements/:id/data-points             Create data point
PUT    /data-points/:id                         Update data point
POST   /data-points/:id/confirm                 Confirm data point
POST   /data-points/:id/estimate                Mark as estimated
GET    /engagements/:id/gap-register            View data gaps
POST   /engagements/:id/gap-register/assign     Assign gaps to team
GET    /engagements/:id/completeness            Completeness metrics
```

### Calculations
```
POST   /calculate                               Run calculation
POST   /engagements/:id/auto-calculate          Auto-calculate available metrics
```

### Workflow
```
POST   /engagements/:id/workflow/initialize     Initialize workflow stages
GET    /engagements/:id/workflow                 Get current workflow
PUT    /engagements/:id/workflow/advance         Advance to next stage
POST   /engagements/:id/workflow/return          Return to previous stage
GET    /engagements/:id/workflow/history         Transition history
```

### Reports
```
POST   /engagements/:id/reports                 Create report
GET    /engagements/:id/reports                  List reports
GET    /reports/:id                             Get report
PUT    /reports/:id                             Update report
PUT    /reports/:id/sections/:sectionId         Update section
POST   /reports/:id/sections/:sectionId/review  Add review comment
POST   /reports/:id/export                      Export (docx/pdf/html)
```

### Presentations
```
POST   /engagements/:id/presentations/generate  Generate deck
GET    /engagements/:id/presentations           List presentations
GET    /presentations/:id                       Get presentation
GET    /presentations/:id/download              Download PPTX
```

### Knowledge Base
```
POST   /knowledge-base/ingest-report            Ingest PDF report (multipart)
POST   /knowledge-base/ingest-report-by-id      Ingest by disclosure ID
GET    /knowledge-base/reports                   List knowledge reports
GET    /knowledge-base/reports/:id              Get knowledge report
POST   /knowledge-base/search                   Semantic search (TF-IDF)
GET    /knowledge-base/benchmarks/:metric       Peer benchmarks
```

### AI Agent
```
POST   /agent/chat                              Chat with ESG agent
POST   /agent/perceive                          Document perception analysis
POST   /agent/full-perception                   Full perception with memory
POST   /agent/judge                             Judge single section
POST   /agent/judge-document                    Judge full document
POST   /agent/catch-me-up                       Session summary
GET    /agent/memory/:engagementId              Get engagement memory
POST   /agent/action                            Execute agent action
GET    /agent/team/:engagementId                Team context & bottlenecks
POST   /agent/generate-report                   Generate full report
POST   /agent/generate-assurance-pack           Generate assurance pack
POST   /agent/generate-executive-summary        Generate executive summary
POST   /agent/learn/edit                        Learn from user edit
POST   /agent/learn/accept                      Learn from acceptance
POST   /agent/learn/reject                      Learn from rejection
```

### QA
```
POST   /engagements/:id/qa/run                  Run QA checks
GET    /engagements/:id/qa/history              QA history
```

---

## 5. AI Agent Architecture

### 5.1 Six Intelligence Capabilities

| Capability | Trigger | Output |
|-----------|---------|--------|
| **Perception** | Document open, every 30s | Section map, data mismatches, compliance gaps, readiness score |
| **Judgment** | Review buttons, @merris review | Section scores, critical issues, partner simulation |
| **Memory** | Every interaction | Conversation, decision, style memories persisted per engagement |
| **Multi-User** | Team activity | Team context, bottleneck detection, activity cards |
| **Work Product** | Generate commands | Full reports, board packs, assurance packs, executive summaries |
| **Learning** | Every Apply/Revise/Skip | Style memory updates, quality signal capture |

### 5.2 @Merris Command Classification

```
@merris review the numbers       → REVIEW    → Word comment + Insight card
@merris write an intro           → WRITE     → Action card (user applies)
@merris shorten this paragraph   → EDIT      → Action card with before/after
@merris insert emissions table   → INSERT    → Action card with table preview
@merris explain scope 3          → EXPLAIN   → Chat tab response
@merris add references           → REFERENCE → Action card with citations
@merris                          → EXPLAIN   → Context-aware suggestion in chat
```

### 5.3 Knowledge Base Search

TF-IDF sparse vector search across 7 domains:
1. Corporate Disclosures (K1) — peer reports, metrics, narratives
2. Climate Science (K2) — IPCC, IEA, SBTi, GHG Protocol
3. Regulatory (K3) — EU/GCC regulations, enforcement
4. Sustainable Finance (K4) — green bonds, ESG ratings, taxonomy
5. Environmental Science (K5) — TNFD, biodiversity, circular economy
6. Supply Chain (K6) — due diligence, forced labour, country risk
7. Research (K7) — academic, COP outcomes, Big 4 consulting

---

## 6. Word Add-in (4-Tab Architecture)

```
┌──────────────────────────────────────┐
│  [Insights]  [Actions]  [Chat]  [History]
├──────────────────────────────────────┤
│                                      │
│  Tab content area                    │
│  (scrollable)                        │
│                                      │
├──────────────────────────────────────┤
│  67/100 │ 3 actions │ 2 new insights │
│  [Ask Merris...                    ] │
└──────────────────────────────────────┘
```

### Modules

| File | Responsibility |
|------|---------------|
| `state.ts` | Central state manager, event emitter, typed data structures |
| `document-ops.ts` | All Word.js operations (read, insert, replace, comment, table, scroll) |
| `tabs/insights-tab.ts` | Section map, insight cards, review buttons, score display |
| `tabs/actions-tab.ts` | Action queue with Preview/Apply/Revise/Skip, batch ops |
| `tabs/chat-tab.ts` | Conversational UI, response routing to Insights/Actions |
| `tabs/history-tab.ts` | Activity log, "Catch me up" summary |
| `footer.ts` | Persistent footer: score, counts, quick input, proactive toggle |
| `merris-commands.ts` | @Merris polling (3s), classification, tab routing |
| `perception.ts` | Auto-perception on load, 30s re-perception, insight generation |
| `taskpane.ts` | Slim orchestrator: Office.onReady, engagement selection, module init |

### Design Rules

- **Only Actions tab modifies the document** (via explicit [Apply])
- **Nothing auto-inserts** — user approves every change
- **@Merris commands route to tabs** — REVIEW/EXPLAIN never touch the document body
- **Tab badges** notify of new unread items
- **Footer quick input** routes to Chat (which may create Actions/Insights)

---

## 7. Web Application

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` | Authentication |
| `/register` | Registration |
| `/engagements` | Engagement list |
| `/engagements/[id]` | Engagement workspace |
| `/data-collection` | Data point management |
| `/reports` | Report builder |
| `/reports/[id]` | Report detail |
| `/presentations` | Presentation generator |
| `/compliance` | Compliance dashboard |
| `/settings` | Organization settings |

### State Management

- **Zustand** for global state (auth, engagement, user)
- **Chat store** for conversation history
- **API client** with JWT auth wrapper
- **i18n** for English/Arabic

---

## 8. Data Layer

### Seeded Frameworks (13+)

| Code | Framework | Region | Type |
|------|----------|--------|------|
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

### Emission Factor Sources

- DEFRA 2025 (UK)
- EPA 2025 (US)
- GHG Protocol GWP
- Global grid factors (all countries)
- GCC-specific grid factors
- IPCC AR6 carbon budgets

### Cross-Framework Mappings

- GRI ↔ CDP, ESRS, ISSB, Saudi Exchange
- EU Taxonomy ↔ ESRS
- SFDR ↔ TCFD
- SFDR PAI ↔ GRI
- CSDDD ↔ GRI 308/414, ESRS S2

---

## 9. Infrastructure

### Queue System (BullMQ + Redis)

| Queue | Purpose |
|-------|---------|
| `document-ingestion` | Process uploaded documents |
| `pdf-extraction` | Extract text/data from PDFs |
| `calculation-engine` | Run ESG calculations |
| `report-generation` | Generate report exports |
| `embedding-generation` | Build TF-IDF vectors |

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `seed.ts` | `pnpm seed` | Seed frameworks, disclosures, emission factors, cross-maps |
| `seed-knowledge-base.ts` | `pnpm seed:kb` | Seed K1-K7 knowledge base entries |
| `download-reports.ts` | `pnpm download:reports` | Download corporate disclosure PDFs |
| `generate-embeddings.ts` | `pnpm generate:embeddings` | Build TF-IDF sparse vectors for KB search |

### Authentication Flow

1. Check localStorage for existing JWT
2. Try Merris API login (email/password)
3. Try Office SSO (Azure AD)
4. Fall back to dialog login
5. Auto-retry on 401 with fresh token

### Environment Variables

```
MONGODB_URI              MongoDB connection string
REDIS_URL                Redis connection string
ANTHROPIC_API_KEY        Claude API key
JWT_SECRET               JWT signing secret
PORT                     API server port (3001)
NEXT_PUBLIC_API_URL      API URL for web app
NEXT_PUBLIC_APP_URL      Web app URL
AZURE_TENANT_ID          Azure AD tenant
AZURE_CLIENT_ID          Azure AD client
AZURE_CLIENT_SECRET      Azure AD secret
AZURE_STORAGE_CONNECTION_STRING  Blob storage
```

---

## 10. Security

- **JWT authentication** on all endpoints (except register/login)
- **Role-based access control** (owner > admin > manager > analyst > reviewer > auditor_readonly)
- **Organization isolation** — users can only access their org's data
- **Zod validation** on all request bodies
- **bcrypt** password hashing
- **CORS** with credentials
- **Multipart upload** capped at 50MB
- **API key** secured via environment variable

---

## 11. Collection Summary

| Collection | Count | Purpose |
|-----------|-------|---------|
| `users` | — | User accounts |
| `organizations` | — | Organizations |
| `teams` | — | Team groupings |
| `orgprofiles` | — | Organization profiles |
| `frameworkrecommendations` | — | Framework recommendations |
| `frameworks` | 10+ | ESG framework definitions |
| `disclosures` | 300+ | Flattened disclosure requirements |
| `cross_framework_maps` | 8+ | Framework-to-framework mappings |
| `emission_factors` | 500+ | Emission factor database |
| `engagements` | — | Client engagements |
| `esgdocuments` | — | Uploaded documents |
| `datapoints` | — | Collected ESG data |
| `workflowdefinitions` | — | Workflow stage tracking |
| `reports` | — | Generated reports |
| `presentations` | — | Generated presentations |
| `kb_corporate_disclosures` | — | K1: Peer company reports |
| `kb_climate_science` | — | K2: IPCC, IEA, SBTi data |
| `kb_regulatory` | — | K3: Regulations & enforcement |
| `kb_sustainable_finance` | — | K4: Green bonds, ESG ratings |
| `kb_environmental_science` | — | K5: TNFD, biodiversity |
| `kb_supply_chain` | — | K6: Due diligence, risk |
| `kb_research` | — | K7: Academic & consulting |
| `kb_embeddings` | — | TF-IDF search vectors |
| `kb_knowledge_reports` | — | Extracted report metrics |
| `conversation_memories` | — | AI conversation history |
| `decision_memories` | — | Decision audit trail |
| `style_memories` | — | Writing style preferences |
| `sharepointconnections` | — | SharePoint integrations |
| `sharepointsynclogs` | — | Sync activity logs |

**Total: 30 collections, 70+ API endpoints, 16 API modules, 4 Office add-ins, 7 knowledge domains**
