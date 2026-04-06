import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill } from './pill';

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill>Active</Pill>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the default variant classes', () => {
    render(<Pill>Test</Pill>);
    const el = screen.getByText('Test');
    expect(el.className).toContain('text-merris-primary');
    expect(el.className).toContain('bg-merris-primary-bg');
  });

  it('applies the critical variant classes', () => {
    render(<Pill variant="critical">Critical</Pill>);
    const el = screen.getByText('Critical');
    expect(el.className).toContain('text-merris-error');
    expect(el.className).toContain('bg-merris-error-bg');
  });

  it('uses smaller padding when size="sm"', () => {
    render(<Pill size="sm">Small</Pill>);
    const el = screen.getByText('Small');
    expect(el.className).toContain('px-1.5');
    expect(el.className).toContain('py-0.5');
  });
});
