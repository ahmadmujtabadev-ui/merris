'use client';

import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';
import { KNOWLEDGE_SOURCES } from '@/lib/intelligence-constants';

// Maps K-vault labels to their real M-module sources in kb_dense_embeddings
const MODULE_MAP: Record<string, string[]> = {
  K1: ['M08-social', 'M12-templates'],
  K2: ['M03-emission-factors', 'M06-carbon-markets'],
  K3: ['M01-regulatory', 'M13-caselaw'],
  K4: ['M04-benchmarks', 'M09-financial'],
  K5: ['M10-sector', 'M11-jurisdictions'],
  K6: ['M05-climate', 'M07-environmental'],
  K7: ['M02-frameworks', 'M14-research'],
};

function computeKCounts(denseByModule: Record<string, number>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [k, modules] of Object.entries(MODULE_MAP)) {
    counts[k] = modules.reduce((sum, mod) => sum + (denseByModule[mod] ?? 0), 0);
  }
  return counts;
}

interface SourceTogglesProps {
  denseByModule?: Record<string, number>;
}

export function SourceToggles({ denseByModule }: SourceTogglesProps) {
  const active = useChatStore((s) => s.knowledgeSources);
  const toggle = useChatStore((s) => s.toggleKnowledgeSource);

  const sourceCounts = denseByModule && Object.keys(denseByModule).length > 0
    ? computeKCounts(denseByModule)
    : { K1: 2184, K2: 1041, K3: 1762, K4: 872, K5: 1318, K6: 946, K7: 1124 };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {KNOWLEDGE_SOURCES.map(({ key, label }) => {
        const isActive = active.includes(key);
        const count = sourceCounts[key];
        const shortKey = key; // e.g. "K1"
        const shortLabel = label.replace(key + ' ', ''); // e.g. "Disclosures"
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-body text-[11px] transition-all',
              isActive
                ? 'bg-merris-primary-bg font-semibold text-merris-primary'
                : 'border border-merris-border bg-white text-merris-text-tertiary hover:text-merris-text-secondary',
            )}
          >
            <span
              className={clsx(
                'inline-block h-1.5 w-1.5 rounded-full',
                isActive ? 'bg-merris-primary' : 'bg-merris-text-tertiary',
              )}
            />
            <span className="font-semibold">{shortKey}</span>
            <span className={clsx(!isActive && 'opacity-60')}>{shortLabel}</span>
            {count && (
              <span className={clsx('font-mono text-[9px]', isActive ? 'text-merris-primary/60' : 'text-merris-text-tertiary')}>
                {count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
      {/* Web source */}
      <button className="inline-flex items-center gap-1.5 rounded-lg border border-merris-border bg-white px-2.5 py-1 font-body text-[11px] text-merris-text-secondary hover:border-merris-primary">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
        <span className="font-semibold text-blue-600">Web</span>
        <span className="rounded-full bg-blue-50 px-1 font-mono text-[9px] text-blue-500">live</span>
      </button>
    </div>
  );
}
