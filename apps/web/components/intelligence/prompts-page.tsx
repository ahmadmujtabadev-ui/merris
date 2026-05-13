'use client';

import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/chat-store';

interface PromptCard {
  id: string;
  category: string;
  categoryColor: string;
  title: string;
  description: string;
  tags: string[];
  jurisdictions: string[];
}

const PROMPT_LIBRARY: PromptCard[] = [
  // ── Regulatory Analysis ──
  {
    id: 'p1',
    category: 'Regulatory Analysis',
    categoryColor: 'bg-[#e0f2fe] text-[#0369a1]',
    title: 'Basel IV Capital Adequacy Comparison',
    description: 'Compare Basel IV capital requirements across GCC banking regulators. Identify divergences in implementation timelines and transitional arrangements.',
    tags: ['Capital', 'Basel IV', 'Banking'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi'],
  },
  {
    id: 'p2',
    category: 'Regulatory Analysis',
    categoryColor: 'bg-[#e0f2fe] text-[#0369a1]',
    title: 'IFRS 9 Provisioning Deep Dive',
    description: 'Analyse IFRS 9 staging criteria and provisioning models across regional banks. Highlight Significant Increase in Credit Risk (SICR) threshold differences.',
    tags: ['IFRS 9', 'Credit Risk', 'Provisioning'],
    jurisdictions: ['Qatar', 'UAE'],
  },
  {
    id: 'p3',
    category: 'Regulatory Analysis',
    categoryColor: 'bg-[#e0f2fe] text-[#0369a1]',
    title: 'QCB vs CBUAE Regulatory Divergence',
    description: 'Side-by-side comparison of QCB and CBUAE regulatory frameworks on liquidity, capital, and concentration risk requirements.',
    tags: ['QCB', 'CBUAE', 'Regulation'],
    jurisdictions: ['Qatar', 'UAE'],
  },
  {
    id: 'p4',
    category: 'Regulatory Analysis',
    categoryColor: 'bg-[#e0f2fe] text-[#0369a1]',
    title: 'AML/CFT Compliance Framework Review',
    description: 'Review AML/CFT requirements under FATF recommendations and local implementation across GCC. Include STR thresholds and beneficial ownership rules.',
    tags: ['AML', 'CFT', 'FATF'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi', 'Oman'],
  },

  // ── ESG & Sustainability ──
  {
    id: 'p5',
    category: 'ESG & Sustainability',
    categoryColor: 'bg-[#f0fdf4] text-[#15803d]',
    title: 'TCFD Disclosure Gap Analysis',
    description: 'Assess entity TCFD disclosures against the 11 recommended disclosures. Identify gaps in governance, strategy, risk management, and metrics.',
    tags: ['TCFD', 'Climate Risk', 'Disclosure'],
    jurisdictions: ['UAE', 'EU', 'UK'],
  },
  {
    id: 'p6',
    category: 'ESG & Sustainability',
    categoryColor: 'bg-[#f0fdf4] text-[#15803d]',
    title: 'Scope 3 Methodology Benchmarking',
    description: 'Compare Scope 3 GHG emissions calculation methodologies across regional and global peers. Flag inconsistencies in category coverage and boundary setting.',
    tags: ['Scope 3', 'GHG Protocol', 'Emissions'],
    jurisdictions: ['EU', 'UK'],
  },
  {
    id: 'p7',
    category: 'ESG & Sustainability',
    categoryColor: 'bg-[#f0fdf4] text-[#15803d]',
    title: 'CSRD vs ISSB Alignment Assessment',
    description: 'Map CSRD (ESRS) requirements against ISSB S1/S2 standards. Identify double materiality nuances and reporting burden implications for cross-border entities.',
    tags: ['CSRD', 'ISSB', 'Materiality'],
    jurisdictions: ['EU', 'UK'],
  },
  {
    id: 'p8',
    category: 'ESG & Sustainability',
    categoryColor: 'bg-[#f0fdf4] text-[#15803d]',
    title: 'Net-Zero Target Credibility Review',
    description: 'Evaluate net-zero commitments against Science Based Targets initiative (SBTi) criteria. Assess interim milestones, Scope coverage, and third-party validation.',
    tags: ['Net-Zero', 'SBTi', 'Climate'],
    jurisdictions: ['UAE', 'EU'],
  },

  // ── Credit & Market Risk ──
  {
    id: 'p9',
    category: 'Credit & Market Risk',
    categoryColor: 'bg-[#fef3c7] text-[#b45309]',
    title: 'Concentration Risk Limit Framework',
    description: 'Analyse single-borrower and sector concentration risk limits under regional frameworks. Compare with Basel Committee guidance on large exposures.',
    tags: ['Concentration Risk', 'Large Exposures', 'Credit'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi'],
  },
  {
    id: 'p10',
    category: 'Credit & Market Risk',
    categoryColor: 'bg-[#fef3c7] text-[#b45309]',
    title: 'Real Estate Exposure Stress Testing',
    description: 'Model real estate sector stress scenarios for a GCC banking portfolio. Apply regulatory haircuts and assess capital adequacy under adverse conditions.',
    tags: ['Real Estate', 'Stress Testing', 'Capital'],
    jurisdictions: ['Qatar', 'UAE'],
  },
  {
    id: 'p11',
    category: 'Credit & Market Risk',
    categoryColor: 'bg-[#fef3c7] text-[#b45309]',
    title: 'Liquidity Coverage Ratio Deep Dive',
    description: 'Review LCR components and HQLA eligibility criteria. Identify operational deposit treatment differences between QCB and Basel LCR standards.',
    tags: ['LCR', 'Liquidity', 'HQLA'],
    jurisdictions: ['Qatar', 'UAE'],
  },

  // ── Governance & Strategy ──
  {
    id: 'p12',
    category: 'Governance & Strategy',
    categoryColor: 'bg-[#f5f3ff] text-[#7c3aed]',
    title: 'Board Governance Best Practice Review',
    description: 'Benchmark board composition, committee structure, and independence requirements against GCC regulatory expectations and international best practice.',
    tags: ['Governance', 'Board', 'Independence'],
    jurisdictions: ['Qatar', 'UAE'],
  },
  {
    id: 'p13',
    category: 'Governance & Strategy',
    categoryColor: 'bg-[#f5f3ff] text-[#7c3aed]',
    title: 'Digital Banking Licensing Requirements',
    description: 'Compare digital bank licensing frameworks across GCC regulators. Cover capital requirements, cybersecurity standards, and operational resilience mandates.',
    tags: ['Digital Banking', 'Licensing', 'Fintech'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi'],
  },
  {
    id: 'p14',
    category: 'Governance & Strategy',
    categoryColor: 'bg-[#f5f3ff] text-[#7c3aed]',
    title: 'Related Party Transaction Controls',
    description: 'Analyse related party transaction (RPT) disclosure and approval requirements. Map differences in threshold triggers, board approval mechanisms, and public disclosure obligations.',
    tags: ['RPT', 'Disclosure', 'Corporate Governance'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi'],
  },

  // ── Peer Intelligence ──
  {
    id: 'p15',
    category: 'Peer Intelligence',
    categoryColor: 'bg-[#f0fdfa] text-[#0f766e]',
    title: 'GCC Banking Sector Profitability Benchmarks',
    description: 'Compare ROE, ROA, NIM, and cost-to-income ratios across major GCC banks. Identify structural drivers of performance divergence and peer positioning.',
    tags: ['ROE', 'NIM', 'Profitability'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi', 'Oman'],
  },
  {
    id: 'p16',
    category: 'Peer Intelligence',
    categoryColor: 'bg-[#f0fdfa] text-[#0f766e]',
    title: 'Capital Markets Development Trajectory',
    description: 'Track GCC capital markets development: sukuk issuance trends, equity market depth, and foreign investor participation. Benchmark against MSCI EM peers.',
    tags: ['Capital Markets', 'Sukuk', 'Equity'],
    jurisdictions: ['Qatar', 'UAE', 'Saudi'],
  },
];

const CATEGORIES = [...new Set(PROMPT_LIBRARY.map((p) => p.category))];

const FLAG: Record<string, string> = {
  Qatar: '🇶🇦', Oman: '🇴🇲', UAE: '🇦🇪', Saudi: '🇸🇦', EU: '🇪🇺', UK: '🇬🇧',
};

export function PromptsPage() {
  const router = useRouter();
  const startQuery = useChatStore((s) => s.startQuery);

  function handleUse(prompt: PromptCard) {
    void startQuery(prompt.title + '. ' + prompt.description);
    router.push('/intelligence');
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      {/* Page header */}
      <div className="border-b border-merris-border bg-white px-8 py-6">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-merris-border bg-white text-merris-text-tertiary hover:border-merris-primary hover:text-merris-primary"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
            <div>
              <h1 className="font-display text-[22px] font-bold text-merris-text">Intelligence Prompt Library</h1>
              <p className="font-body text-[12px] text-merris-text-tertiary">
                {PROMPT_LIBRARY.length} curated prompts · Click any card to open in Intelligence
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {CATEGORIES.map((category) => {
          const prompts = PROMPT_LIBRARY.filter((p) => p.category === category);
          const colorCls = prompts[0]?.categoryColor ?? 'bg-merris-surface-low text-merris-text-secondary';
          return (
            <div key={category} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 font-display text-[11px] font-bold ${colorCls}`}>
                  {category}
                </span>
                <span className="font-body text-[11px] text-merris-text-tertiary">{prompts.length} prompts</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="group overflow-hidden rounded-2xl border border-merris-border bg-white shadow-sm transition-all hover:border-merris-primary hover:shadow-md"
                  >
                    <div className="px-6 py-5">
                      <h3 className="mb-2 font-display text-[14px] font-bold text-merris-text group-hover:text-merris-primary">
                        {prompt.title}
                      </h3>
                      <p className="font-body text-[12px] leading-relaxed text-merris-text-secondary">
                        {prompt.description}
                      </p>

                      {/* Tags */}
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {prompt.jurisdictions.map((j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded-full border border-merris-border bg-[#f5f3ef] px-2 py-0.5 font-body text-[10px] text-merris-text-secondary">
                            {FLAG[j] ?? ''} {j}
                          </span>
                        ))}
                        {prompt.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-tertiary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-merris-border px-6 py-3">
                      <span className={`rounded-full px-2 py-0.5 font-body text-[9px] font-semibold ${colorCls}`}>
                        {category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUse(prompt)}
                        className="flex items-center gap-1.5 rounded-lg bg-merris-primary px-3 py-1.5 font-display text-[11px] font-bold text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-90"
                      >
                        Use prompt
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
