'use client';

import { JurisdictionChips } from './jurisdiction-chips';
import { SourceToggles } from './source-toggles';
import { ChatInput } from './chat-input';

export function IntelligenceHero() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-11 text-center">
      <h1 className="font-display text-[34px] font-extrabold leading-[1.15] text-merris-text">
        Where sustainability meets <span className="text-merris-primary">precision</span>
      </h1>
      <p className="mt-2 mb-6 font-body text-[14px] text-merris-text-secondary">
        Analyze, validate, and report with institutional-grade ESG intelligence.
      </p>

      <div className="mb-7 flex justify-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-merris-sm bg-merris-primary px-[18px] py-[9px] font-display text-[13px] font-semibold text-white"
        >
          📄 Review report
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-merris-sm bg-merris-surface px-[14px] py-[7px] font-display text-[12px] font-medium text-merris-text border border-merris-border-medium"
        >
          🧱 Extract data
        </button>
      </div>

      <div className="mb-2">
        <JurisdictionChips />
      </div>
      <div className="mb-6">
        <SourceToggles />
      </div>

      <ChatInput />

      <div className="mt-7 flex justify-center gap-5 font-body text-[10px] text-merris-text-tertiary">
        <span>● High Performance</span>
        <span className="text-merris-primary">● Private Cloud</span>
        <span className="text-merris-primary">● ESG Validated</span>
      </div>
    </div>
  );
}
