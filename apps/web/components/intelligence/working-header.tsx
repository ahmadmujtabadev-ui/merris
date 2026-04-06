'use client';

export function WorkingHeader() {
  return (
    <div className="mb-5 flex items-center gap-2">
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-merris-primary font-display text-[11px] font-bold text-white">
        M
      </div>
      <span className="font-display text-[13px] font-semibold text-merris-primary">Working...</span>
    </div>
  );
}
