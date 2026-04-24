'use client';

import clsx from 'clsx';
import { useChatStore } from '@/lib/chat-store';
import { KNOWLEDGE_SOURCES } from '@/lib/intelligence-constants';

export function SourceToggles() {
  const active = useChatStore((s) => s.knowledgeSources);
  const toggle = useChatStore((s) => s.toggleKnowledgeSource);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {KNOWLEDGE_SOURCES.map(({ key, label }) => {
        const isActive = active.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] transition-colors',
              isActive
                ? 'bg-merris-primary-bg font-semibold text-merris-primary'
                : 'bg-merris-surface-low text-merris-text-tertiary hover:text-merris-text-secondary',
            )}
          >
            <span
              className={clsx(
                'inline-block h-1 w-1 rounded-full',
                isActive ? 'bg-merris-primary' : 'bg-merris-text-tertiary',
              )}
            />
            {label}
          </button>
        );
      })}
      <span className="inline-flex items-center gap-1 rounded-full bg-merris-surface-low px-2 py-0.5 font-body text-[10px] text-merris-text-tertiary">
        🌐 Web
      </span>
    </div>
  );
}
