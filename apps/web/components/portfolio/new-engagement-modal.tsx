'use client';

import { useState } from 'react';
import { MerrisCard } from '@/components/merris/card';
import { MerrisButton } from '@/components/merris/button';
import { Chip } from '@/components/merris/chip';
import { FRAMEWORK_OPTIONS } from '@/lib/portfolio-constants';
import { api } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewEngagementModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const toggle = (fw: string) =>
    setFrameworks((prev) => (prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]));

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createEngagement({ name: name.trim(), frameworks });
      setName('');
      setFrameworks([]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
      <MerrisCard className="w-full max-w-md">
        <h2 className="mb-1 font-display text-[18px] font-bold text-merris-text">New Engagement</h2>
        <p className="mb-4 font-body text-[12px] text-merris-text-secondary">
          Create a new ESG verification or reporting cycle.
        </p>

        <label className="mb-1 block font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Engagement name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. QAPCO Sustainability 2026"
          className="mb-4 w-full rounded-merris-sm border border-merris-border-medium bg-merris-surface px-3 py-2 font-body text-[13px] text-merris-text outline-none focus:border-merris-primary"
        />

        <label className="mb-1.5 block font-body text-[11px] font-semibold uppercase tracking-wider text-merris-text-tertiary">
          Frameworks
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FRAMEWORK_OPTIONS.map((fw) => (
            <Chip key={fw} active={frameworks.includes(fw)} onClick={() => toggle(fw)}>
              {fw}
            </Chip>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded-merris-sm bg-merris-error-bg px-3 py-2 font-body text-[12px] text-merris-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <MerrisButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </MerrisButton>
          <MerrisButton variant="primary" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create'}
          </MerrisButton>
        </div>
      </MerrisCard>
    </div>
  );
}
