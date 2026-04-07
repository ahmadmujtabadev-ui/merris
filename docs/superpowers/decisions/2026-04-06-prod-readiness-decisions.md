# Merris Production-Readiness Decisions

> **Owner sign-off:** these decisions block autonomous execution of the prototype→production work. Once each decision is locked, the implementation phase can run as a series of subagent dispatches without further blocking on humans.
>
> **Tracks:**
> - **SE** = Software Engineer decides (infra, security, ops, library choices)
> - **ESG** = ESG / Product owner decides (vertical focus, content, design partners, voice)
> - **Joint** = needs both
>
> **Status field:** `[ ]` open · `[~]` in progress · `[x]` locked · `[—]` deferred / not applicable

---

## Track 1 — Software / Infrastructure  (owner: SE)

### 1.1 Hosting platform — web (Next.js)

- [ ] **Decision needed**
- **Options:**
  - **A. Vercel** — fastest path, zero-config for Next.js 14, free tier comfortable for alpha. ~$20/month for the first paid tier when needed.
  - **B. Cloudflare Pages** — cheaper at scale, good edge perf, more setup friction with Next.js app router.
  - **C. AWS Amplify / S3+CloudFront** — most flexible, most setup overhead.
  - **D. Self-hosted on the same box as the API** — cheapest, worst dev experience, blocks Vercel-only Next features.
- **Recommendation:** **A. Vercel.** Next.js is their first-party product. Friction is near zero for shipping today.
- **Locked answer:**

### 1.2 Hosting platform — API (Fastify)

- [ ] **Decision needed**
- **Options:**
  - **A. Render** — Heroku-like, good Fastify support, free tier sleeps after 15 min idle, $7/month for always-on.
  - **B. Fly.io** — best raw perf for the price, slightly more setup. Native Mongo addon.
  - **C. Railway** — closest to Render, more polished UI, slightly pricier.
  - **D. AWS ECS / Lightsail** — full control, longest setup.
- **Recommendation:** **B. Fly.io.** Fastify deploys cleanly via a Dockerfile, the free tier handles a few thousand requests/day, and scaling later is straightforward.
- **Locked answer:**

### 1.3 MongoDB hosting

- [ ] **Decision needed**
- **Options:**
  - **A. MongoDB Atlas M0 (free)** — 512 MB storage, shared cluster, fine for alpha but no point-in-time restore.
  - **B. MongoDB Atlas M10 (~$60/month)** — dedicated cluster, daily backups, point-in-time restore, the realistic baseline for "I cannot lose user data".
  - **C. Self-hosted Mongo on the API box** — no extra cost, no managed backups, you become the DBA. Bad idea.
- **Recommendation:** **B. Atlas M10.** $60/month is the cost of one beta user signing up — pay for backups.
- **Locked answer:**

### 1.4 Redis (BullMQ + ingestion queue)

- [ ] **Decision needed**
- **Options:**
  - **A. Upstash Redis (free tier 10k commands/day)** — REST-based, fits the serverless model.
  - **B. Redis Cloud (free 30 MB)** — closer to vanilla Redis.
  - **C. Self-hosted on the API box** — fine for alpha, lose data on restart.
- **Recommendation:** **A. Upstash.** Free tier is enough for alpha, scales without vendor lock-in.
- **Locked answer:**

### 1.5 Domain + TLS

- [ ] **Decision needed**
- **Options:**
  - **A. `merris.ai`** — confirm availability + register
  - **B. `merris.app`** / `getmerris.com` / other fallback if `.ai` is taken
- **Subdomain plan:** `app.merris.ai` for the web app, `api.merris.ai` for the API, `status.merris.ai` for the status page.
- **Recommendation:** Buy `merris.ai` if available. TLS is free via Let's Encrypt / Vercel automatic certs.
- **Locked answer:**

### 1.6 CI/CD pipeline

- [ ] **Decision needed**
- **Options:**
  - **A. GitHub Actions** — free for public repos, generous for private, integrates with everything.
  - **B. Vercel + Render auto-deploys only** — simpler, no PR checks.
  - **C. Buildkite / CircleCI** — overkill for current size.
- **Recommendation:** **A. GitHub Actions** with this minimum job set:
  1. On every PR: `pnpm install` + `pnpm build` + `pnpm test`
  2. On merge to `main`: trigger Vercel + Render auto-deploys (they handle the actual deploy)
  3. On failure: post a comment on the PR
- **Locked answer:**

### 1.7 Secret management

- [ ] **Decision needed**
- **Options:**
  - **A. Hosting-platform native** — Vercel env vars + Fly secrets + Atlas user keys. Simplest, no extra service.
  - **B. Doppler** — single dashboard for all envs, $0 for small teams.
  - **C. 1Password Secrets Automation** — best if your team already uses 1Password.
- **Recommendation:** **A. Native** for alpha, **B. Doppler** if you grow past 3 environments.
- **Locked answer:**

### 1.8 Error tracking

- [ ] **Decision needed**
- **Options:**
  - **A. Sentry** — industry standard, 5k events/month free, handles backend + frontend + Next.js source maps.
  - **B. Rollbar / Bugsnag** — fine, smaller communities.
  - **C. nothing for alpha** — bad idea even for alpha.
- **Recommendation:** **A. Sentry.** Install on day 1 of Phase 0.
- **Locked answer:**

### 1.9 Application analytics

- [ ] **Decision needed**
- **Options:**
  - **A. PostHog (cloud)** — free 1M events/month, open source, privacy-friendly, ESG-friendly story.
  - **B. PostHog (self-hosted)** — better privacy story, more ops work.
  - **C. Mixpanel** — slicker UI, less data ownership.
  - **D. nothing for alpha** — defensible if you're watching every session live.
- **Recommendation:** **A. PostHog cloud.** Wire signup, login, chat-sent, workflow-run, document-uploaded as a minimum event set.
- **Locked answer:**

### 1.10 Uptime monitoring

- [ ] **Decision needed**
- **Options:**
  - **A. Better Stack (formerly Better Uptime)** — free tier, polished, status page included.
  - **B. UptimeRobot** — free, less polished.
  - **C. Pingdom** — paid only.
- **Recommendation:** **A. Better Stack.** Comes with a hosted status page on the same domain.
- **Locked answer:**

### 1.11 Email transactional provider

- [ ] **Decision needed** (only if you're keeping local auth or sending verification emails)
- **Options:**
  - **A. Resend** — built for developers, $0 first 100 emails/day.
  - **B. Postmark** — most reliable transactional, $10/month entry.
  - **C. SendGrid** — works fine, more enterprise feel.
- **Recommendation:** **A. Resend.** Skip entirely if you go OAuth-only (decision 2.1).
- **Locked answer:**

### 1.12 Feature flag system

- [ ] **Decision needed**
- **Options:**
  - **A. PostHog feature flags** — free, ships with the analytics decision above.
  - **B. LaunchDarkly** — overkill at this stage.
  - **C. Hardcode `if (env.PROD) { ... }`** — fine for alpha.
- **Recommendation:** **C. Hardcode** for alpha, **A. PostHog flags** when private beta starts.
- **Locked answer:**

---

## Track 2 — Auth & Security  (owner: SE)

### 2.1 Auth provider

- [ ] **Decision needed**  ← **highest leverage decision in this whole document**
- **Options:**
  - **A. Microsoft Entra ID (Azure AD) OAuth via NextAuth** — best fit for ESG audience because every enterprise ESG analyst already has an M365 account. Single setup unlocks the Word add-in story too.
  - **B. Auth0 / Clerk** — fastest to ship, free tier covers alpha, vendor lock-in. ~$23/month at scale.
  - **C. Harden the existing local password auth** — currently 60% done in `apps/api/src/modules/auth`. Needs email verification, password reset, rate limiting, httpOnly cookies, CSRF.
  - **D. Both A and C** — local for early friendlies, OAuth for enterprise users later.
- **Recommendation:** **A. Microsoft OAuth.** Same auth surface for the web app and the Word add-in, no email-deliverability problems, no password reset flows to build.
- **Locked answer:**

### 2.2 Session storage

- [ ] **Decision needed**
- **Options:**
  - **A. httpOnly secure cookies** — XSS-resistant, the right answer.
  - **B. localStorage with JWT** — current implementation, vulnerable to XSS, easy to swap later.
- **Recommendation:** **A. httpOnly cookies.** Convert during the auth hardening pass.
- **Locked answer:**

### 2.3 Rate limiting

- [ ] **Decision needed**
- **Options:**
  - **A. `@fastify/rate-limit`** — first-party plugin, 10 lines to install, in-memory or Redis-backed.
  - **B. Cloudflare WAF rules** — only if you put the API behind Cloudflare.
  - **C. nothing** — vulnerable to credential stuffing on `/auth/login`.
- **Recommendation:** **A. `@fastify/rate-limit`** with Redis backend (decision 1.4).
- **Default config:** 5 attempts per IP per 15 min on `/auth/login` and `/auth/register`; 60 req/min global default.
- **Locked answer:**

### 2.4 CSRF protection

- [ ] **Decision needed**
- **Options:**
  - **A. `@fastify/csrf-protection`** — first-party plugin, double-submit cookie pattern.
  - **B. SameSite=Strict cookies + Origin header check only** — simpler, sufficient for most cases.
  - **C. nothing** — required for state-changing requests if you use cookies.
- **Recommendation:** **A. `@fastify/csrf-protection`** for state-changing endpoints.
- **Locked answer:**

### 2.5 Multi-tenant data isolation audit

- [ ] **Decision needed (the audit must happen, the question is who does it)**
- **The audit:** every Mongo query that touches user-owned data must be scoped by `orgId`. Currently this is enforced ad-hoc per route handler. Before alpha: write a script that creates two test orgs with one engagement each and verifies user A cannot see user B's engagements/documents/findings via any API path.
- **Recommendation:** SE writes the audit script, you sign off on the test plan.
- **Locked answer:**

### 2.6 Penetration test

- [ ] **Decision needed**
- **Options:**
  - **A. Self-audit using OWASP Top 10 checklist** — free, you have to know what you're doing.
  - **B. Snyk + Dependabot** — automated dependency scanning, good baseline.
  - **C. Hire a pen-tester** — $3-8k, skip until private beta.
- **Recommendation:** **A + B for alpha**, **C before private beta**.
- **Locked answer:**

### 2.7 Secret rotation

- [ ] **Decision needed**
- **Options:**
  - **A. Manual rotation every 90 days** — fine for alpha
  - **B. Automated via Doppler / Vault** — overkill until private beta
- **Recommendation:** **A. Manual** with a calendar reminder.
- **Locked answer:**

### 2.8 Audit logging

- [ ] **Decision needed**
- **What it means:** record every state-changing action (create engagement, upload doc, run workflow, apply finding) with `who, what, when, from where`.
- **Options:**
  - **A. Append to a Mongo `audit_log` collection on every state change** — simplest, queryable.
  - **B. Stream to a managed audit service** — overkill.
  - **C. Defer to private beta** — defensible for alpha if you're under NDA with all users.
- **Recommendation:** **C for alpha, A for private beta.**
- **Locked answer:**

---

## Track 3 — Observability & Ops  (owner: SE)

### 3.1 Structured logging

- [ ] **Decision needed**
- **Status:** Fastify already uses pino. Need to enable JSON output, add request IDs, and ship logs somewhere queryable.
- **Options:**
  - **A. Stdout → Fly/Render log aggregator (free)** — fine for alpha.
  - **B. Logtail / Better Stack Logs** — searchable, $0 first 1 GB/month.
  - **C. Datadog / New Relic** — overkill.
- **Recommendation:** **A for alpha**, **B when Sentry alerts get noisy**.
- **Locked answer:**

### 3.2 Backup / disaster recovery

- [ ] **Decision needed**
- **Options:**
  - **A. Atlas built-in backups (M10+)** — daily snapshots, point-in-time restore, $0 above the cluster cost.
  - **B. Cron job dumping `mongodump` to S3 nightly** — DIY, brittle.
  - **C. nothing** — unacceptable past day 1 of alpha.
- **Recommendation:** **A. Atlas M10 backups.** Already covered if you pick option B in decision 1.3.
- **Recovery test:** before alpha launch, restore a backup to a scratch cluster and verify the data.
- **Locked answer:**

### 3.3 Status page

- [ ] **Decision needed**
- **Options:**
  - **A. Better Stack hosted status page** — included in 1.10 if you pick that.
  - **B. statuspage.io** — paid only.
  - **C. Simple `/status` route on the web app** — dumb but fine for alpha.
- **Recommendation:** **A.**
- **Locked answer:**

### 3.4 Incident response runbook

- [ ] **Decision needed**
- **Status:** does not exist
- **Options:**
  - **A. Write a 1-page runbook** — covers: who's on call, how to roll back a deploy, how to read Sentry, how to restore a backup, how to disable a broken feature flag.
  - **B. Defer to private beta**
- **Recommendation:** **A.** SE writes it during Phase 1 of execution.
- **Locked answer:**

### 3.5 On-call rotation

- [ ] **Decision needed**
- **Recommendation:** No formal on-call for alpha (3-5 friendly users, NDA, no SLA). Set up Sentry to email you on errors. Revisit at private beta.
- **Locked answer:**

---

## Track 4 — Data & ESG vertical  (owner: ESG / you)

### 4.1 Beta vertical focus

- [ ] **Decision needed**  ← **highest leverage decision in this whole document, ESG-side**
- **Options:**
  - **A. CSRD/ESRS readiness assessments** — highest urgency for EU clients (mandatory reporting deadlines hit Jan 2026 for many wave-1 companies, the wave behind that is now).
  - **B. GRI 2024 sustainability reports** — most universally recognised, largest existing corpus.
  - **C. Saudi Vision 2030 / GCC ESG** — your stated GCC market positioning, less competition.
  - **D. TCFD / IFRS S2 climate disclosure** — narrow scope, easy to demo, mature standard.
  - **E. Try to do all of them** — what we're doing now. The reason the product feels broad and shallow.
- **Why it matters:** every other ESG decision (which collections to seed, which evaluator prompts to tune, which design partners to recruit, which sales pitch to make) flows from this.
- **Recommendation:** **A. CSRD/ESRS.** Highest pain × narrowest competition.
- **Locked answer:**

### 4.2 Real corpus to seed for the chosen vertical

- [ ] **Decision needed**
- **Sub-decisions:**
  - **a. Standards documents** — for CSRD: ESRS E1-E5, S1-S4, G1 official PDFs. Where do you source them? (EFRAG website is the primary source, all PDFs are public.)
  - **b. Sample disclosures** — 5-10 real public sustainability reports to use as test corpora. Suggested: Schneider, Unilever, Engie, Iberdrola, ADNOC.
  - **c. Frameworks crosswalk** — does Merris need to know that ESRS E1 ≈ TCFD ≈ GRI 305? Build the mapping or skip?
  - **d. Sector taxonomies** — SASB Materiality Map, GICS sectors? Source?
- **Recommendation:** SE can write the ingestion pipelines and seed scripts; ESG owner provides the source list and sign-off on quality of the ingested content.
- **Locked answer:**

### 4.3 Evaluator validation set

- [ ] **Decision needed**
- **What it means:** the two-layer evaluator scores responses on a 0-100 scale with PASS/FIX/REJECT/BLOCK decisions. Before alpha, we need to validate that those scores track the judgment of a real ESG expert.
- **Action:** ESG owner writes 30-50 representative ESG questions, submits each through the chat, grades the responses on a side-by-side rubric (correct? defensible? auditable?). If evaluator scores don't track expert grades, the entire "transparent reasoning trace" value prop is at risk.
- **Owner:** ESG owner (you), since you're an ESG expert and intend to test the alpha yourself.
- **Locked answer:**

### 4.4 Refusal protocol

- [ ] **Decision needed**
- **Question:** what queries should Merris refuse to answer? The current `BLOCK` decision is triggered by hard-block heuristics that I haven't validated against ESG-specific risk patterns.
- **Examples to think about:**
  - "What's the exact carbon footprint of this private company?" (defensibility risk)
  - "Will my ESG report pass the auditor?" (legal exposure)
  - "Is this greenwashing?" (defamation risk)
  - "Generate a fictional CSRD disclosure that looks real" (intentional misuse)
- **Recommendation:** ESG owner writes a 1-page refusal policy. SE wires the patterns into the hard-block check.
- **Locked answer:**

### 4.5 Data sources for placeholder pages

- [ ] **Decision needed** — for each of the 4 Phase G placeholder routes, decide if/when to wire real data:

| Page | Real source available today? | Decision |
|---|---|---|
| Knowledge | Yes — KB collections + semantic search | [ ] wire for alpha · [ ] defer |
| Compliance (framework progress) | No — needs disclosure analysis pipeline | [ ] build for alpha · [ ] defer · [ ] honest "coming soon" |
| Findings | Partially — `judgeDocument` can produce them per-doc | [ ] aggregate per engagement for alpha · [ ] defer |
| History | Yes — `memory.ts` captures conversations | [ ] wire feed for alpha · [ ] defer |
| Team / Preferences / Billing | No — modules don't exist | [ ] hide or "coming soon" for alpha |

- **Recommendation:** Wire Knowledge + History (cheap), defer Compliance + Findings until Phase 4.4 evaluator validation, hide Team/Preferences/Billing under "Coming soon" labels for alpha.
- **Locked answer:**

### 4.6 Multilingual / RTL support

- [ ] **Decision needed**
- **Status:** dropped during the merris-platform-7 migration (Plan 2). Currently English-only, no `dir` attribute.
- **Question:** does your alpha audience include Arabic-speaking GCC users? If yes, RTL needs to come back.
- **Recommendation:** ESG owner decides based on design partner list.
- **Locked answer:**

### 4.7 Source attribution standards

- [ ] **Decision needed**
- **Question:** when Merris cites a source, what's the minimum bar? Title + year? Title + URL? Title + URL + page number + excerpt? Currently `TOOL_CITATION_MAP` provides title + source + year + url + domain + excerpt, which is good but inconsistent across tools.
- **Recommendation:** ESG owner sets the standard, SE enforces it via a Zod schema on `Citation`.
- **Locked answer:**

### 4.8 Greenwashing / claim defensibility guardrails

- [ ] **Decision needed**
- **Question:** the evaluator already flags unsourced claims. What's the policy for what gets stripped vs. flagged vs. allowed-with-warning?
- **Recommendation:** ESG owner writes a 1-page guidelines doc. SE wires it into the evaluator prompt + the response renderer.
- **Locked answer:**

---

## Track 5 — Product scope & voice  (owner: Joint)

### 5.1 Alpha scope cut

- [ ] **Decision needed**
- **Question:** which of the 15 routes are visible to alpha users? Some pages are too prototype-y to show real ESG professionals without context.
- **Recommendation matrix:**

| Route | Alpha-visible? | Reason |
|---|---|---|
| `/intelligence` | Yes | Core product |
| `/portfolio` + `/portfolio/[id]` | Yes | Core product |
| `/portfolio/[id]/documents/[docId]` | Yes (read-only mode) | Real document content |
| `/knowledge` | Yes (after wiring 4.5) | Real after wire |
| `/workflow-agents` | Yes | Real templates |
| `/compliance` | **Hidden behind feature flag** | Currently 100% placeholder |
| `/firm-library` | **Hidden** | No backend |
| `/history` | Yes (after wiring 4.5) | Easy real wire |
| `/config` | **Hidden** | No backend |
| `/settings` | Yes (Profile tab only) | Profile is real, others hidden |

- **Locked answer:**

### 5.2 Alpha disclaimer / labeling

- [ ] **Decision needed**
- **Options:**
  - **A. Footer banner: "Closed alpha — features in active development, data may be reset"** + the 📋 Placeholder pills as already implemented.
  - **B. Modal on first login** explaining the alpha state, requiring acknowledgment.
  - **C. Both.**
- **Recommendation:** **C.** Clear consent before users invest time.
- **Locked answer:**

### 5.3 Voice & tone for the assistant

- [ ] **Decision needed**
- **Question:** the agent currently uses the prompt at `prompts/router.md`. Should it sound like an ESG consultant (formal, hedged), an analyst tool (terse, factual), or a junior researcher (deferential, eager)?
- **Recommendation:** ESG owner reviews the current prompt and rewrites it in the voice of "a senior ESG analyst at a Big Four". Keep edits in `prompts/router.md`.
- **Locked answer:**

### 5.4 Pricing communication

- [ ] **Decision needed**
- **Question:** should the alpha mention pricing at all? Most alphas don't.
- **Recommendation:** No pricing in alpha. Add a "talk to us" link on the landing page (decision 7.2).
- **Locked answer:**

### 5.5 Product naming & taglines

- [ ] **Decision needed**
- **Current state:** The hero says "Where sustainability meets precision". Other strings inherited from the prototype.
- **Recommendation:** ESG owner reviews + locks the headline copy. SE wires.
- **Locked answer:**

---

## Track 6 — Legal & compliance  (owner: ESG, possibly with lawyer)

### 6.1 Privacy policy

- [ ] **Decision needed**
- **Options:**
  - **A. Termly / iubenda template** — $10-30/month, generated from a questionnaire.
  - **B. Lawyer-reviewed custom** — $1500-3000.
  - **C. Adapt an open-source template** — free, you're on your own.
- **Recommendation:** **A. Termly** for alpha. **B. Lawyer-reviewed** before private beta.
- **Locked answer:**

### 6.2 Terms of service

- [ ] **Decision needed**
- Same options as 6.1.
- **Recommendation:** Same as 6.1.
- **Locked answer:**

### 6.3 Data Processing Agreement template

- [ ] **Decision needed**
- **Question:** ESG professionals at regulated entities will ask for a DPA. Do you have one?
- **Options:**
  - **A. 1-page DPA addendum for design partners** — sufficient for alpha NDA setup.
  - **B. Full GDPR-compliant DPA** — required for EU customers in private beta.
- **Recommendation:** **A** for alpha, **B** before any EU customer signs in private beta.
- **Locked answer:**

### 6.4 Data residency commitment

- [ ] **Decision needed**
- **Question:** GCC and EU customers will both ask "where is our data stored?". Atlas can pin clusters to a region (EU-West-1, ME-South-1, etc.).
- **Recommendation:** EU region for alpha (covers most likely beta users). Document the region in the privacy policy.
- **Locked answer:**

### 6.5 Cookie banner

- [ ] **Decision needed**
- **Required if:** any user is in the EU/EEA/UK or you use any cookie that's not strictly necessary.
- **Options:**
  - **A. Termly cookie banner** — comes with the privacy policy.
  - **B. Cookie consent open-source library**
  - **C. Skip** — only if no cookies beyond the auth session.
- **Recommendation:** **A** if 6.1 is also Termly.
- **Locked answer:**

### 6.6 PII / data deletion process

- [ ] **Decision needed**
- **Question:** what happens when a user asks "delete my account and all my data"?
- **Recommendation:** Document a manual SE-runs-a-script process for alpha. Automate before private beta.
- **Locked answer:**

### 6.7 AI / model use disclosure

- [ ] **Decision needed**
- **Question:** EU AI Act requires transparency about AI use. Some users will also want to know which model is generating responses.
- **Recommendation:** Add a "Powered by Claude Sonnet 4 · Merris ESG agent" line in the response footer. Document in the privacy policy.
- **Locked answer:**

---

## Track 7 — Go-to-market & design partners  (owner: ESG / you)

### 7.1 Design partner shortlist

- [ ] **Decision needed**
- **Question:** who are the 3-5 ESG professionals you can email today and who would say yes to a 30-min call?
- **Format:** name, role, company, ESG focus, why they'd care.
- **Recommendation:** Lock the list before any of the technical work starts. The work is designed FOR these specific humans.
- **Locked answer:**

### 7.2 Landing page

- [ ] **Decision needed**
- **Question:** alpha users still need a URL to find. Does `merris.ai` redirect to `app.merris.ai`, or does it serve a marketing landing page first?
- **Options:**
  - **A. No landing page yet** — `merris.ai` redirects directly to the app login.
  - **B. Single-page Framer/Webflow site** — fastest, decent for alpha.
  - **C. Custom landing page in `apps/web` at `/`** — most control, more work.
- **Recommendation:** **A** for alpha (no public surface), **B** when private beta starts.
- **Locked answer:**

### 7.3 Feedback collection channel

- [ ] **Decision needed**
- **Options:**
  - **A. Linear** — best for engineering follow-through, $0 free tier.
  - **B. Notion database** — most flexible, not engineer-friendly.
  - **C. GitHub Issues on a private repo** — fine if your team lives there.
  - **D. Slack channel with the design partners**
- **Recommendation:** **A. Linear** for the engineering side, **D. Slack** for partner conversation. Both forward to the same `feedback@merris.ai` inbox.
- **Locked answer:**

### 7.4 Onboarding ritual for each design partner

- [ ] **Decision needed**
- **Question:** does each design partner get a hand-curated onboarding (you set up their first engagement, seed it with relevant docs, schedule a kickoff call) or self-serve?
- **Recommendation:** Hand-curated for alpha (3-5 partners only). Self-serve onboarding is a private-beta concern.
- **Locked answer:**

### 7.5 Success criteria for the alpha

- [ ] **Decision needed**
- **Question:** how do you decide whether the alpha is a success and you should invest more vs. pivot vs. stop?
- **Suggested metrics:**
  - **a.** At least 3 of 5 partners log in 3+ times in the first 2 weeks
  - **b.** At least 1 partner says "I would pay for this if X" with a specific X
  - **c.** Less than 25% of chat responses get a thumbs-down (need to add the thumbs button)
  - **d.** No data integrity / safety incidents
- **Recommendation:** ESG owner sets the bar, SE makes sure the metrics are measurable.
- **Locked answer:**

### 7.6 Communication cadence with design partners

- [ ] **Decision needed**
- **Recommendation:** Weekly 30-min check-in per partner for the first 4 weeks. Slack/email for issues between calls.
- **Locked answer:**

---

## Track 8 — Workforce / division of labor  (owner: Joint)

### 8.1 Who runs the multi-agent execution after decisions are locked

- [ ] **Decision needed**
- **Recommendation:** Claude Code runs the implementation phases as a series of subagent dispatches against this same repo. ESG owner reviews demos at each phase milestone. SE reviews PRs and merges.
- **Locked answer:**

### 8.2 Branch & merge policy for the production-readiness work

- [ ] **Decision needed**
- **Options:**
  - **A. Continue current pattern** — feature branches per phase, merged into `main` after review.
  - **B. Long-running `production-readiness` branch** — merge at the end.
  - **C. Trunk-based** — straight to main, no branches.
- **Recommendation:** **A.** Same pattern that's been working.
- **Locked answer:**

### 8.3 Demo cadence to ESG owner

- [ ] **Decision needed**
- **Recommendation:** End of each phase, Claude Code records what shipped + the next phase's plan. ESG owner reviews + approves before next phase starts.
- **Locked answer:**

### 8.4 Decision veto / unblock channel

- [ ] **Decision needed**
- **Question:** if a subagent dispatch hits a decision-blocked moment (e.g., needs an ESG policy answer), what's the unblock process?
- **Recommendation:** Claude Code marks the dispatch as `NEEDS_DECISION`, parks the work, surfaces the question in the next sync. ESG owner answers, work resumes.
- **Locked answer:**

---

## Decision dependency graph

This is the order things have to lock before others can move:

```
1.5 (domain) ──┐
               ├──→ 1.1 (web host) ──→ 1.6 (CI/CD) ──→ all execution
1.2 (api host) ┘                                            ▲
                                                            │
2.1 (auth) ────→ 2.2, 2.3, 2.4 ──→ ─────────────────────────┤
                                                            │
1.3 (mongo) ──→ 1.4 (redis) ──→ 3.1, 3.2 ──→ ───────────────┤
                                                            │
4.1 (vertical) ──→ 4.2 (corpus) ──→ 4.3, 4.4, 4.7, 4.8 ─────┤
                                                            │
5.1 (scope cut) ─→ 5.2, 5.3 ──→ 7.4 (onboarding) ───────────┤
                                                            │
6.1, 6.2, 6.3 (legal) ──→ 7.1 (partners) ──→ 7.5, 7.6 ──────┘
                                                            │
8.1, 8.2, 8.3, 8.4 ─────────────────────────────────────────┘
```

The single highest-leverage decisions are **2.1 (auth provider)** and **4.1 (vertical focus)**. Lock those two first; everything downstream flows.

---

## Sign-off

| Track | Owner | Decisions | Status |
|---|---|---|---|
| 1. Software / Infrastructure | SE | 12 | ☐ |
| 2. Auth & Security | SE | 8 | ☐ |
| 3. Observability & Ops | SE | 5 | ☐ |
| 4. Data & ESG vertical | ESG | 8 | ☐ |
| 5. Product scope & voice | Joint | 5 | ☐ |
| 6. Legal & compliance | ESG (+lawyer) | 7 | ☐ |
| 7. Go-to-market & partners | ESG | 6 | ☐ |
| 8. Workforce / labor | Joint | 4 | ☐ |
| **Total** | | **55** | |

Once every box has an answer, hand this back to Claude Code and the production-readiness execution starts as a series of multi-agent dispatches running as much in parallel as task independence allows.
