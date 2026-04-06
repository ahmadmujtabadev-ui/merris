import { merrisTokens } from '@/lib/design-tokens';

interface ScoreRingProps {
  score: number;       // 0–100
  size?: number;       // px
  variant?: 'small' | 'donut';
}

/**
 * Mirrors the prototype Rn (small ring, 40px) and Dn (donut, 130px) components.
 * Color: red <40, amber <70, green ≥70 (matches prototype thresholds).
 */
export function ScoreRing({ score, size = 40, variant = 'small' }: ScoreRingProps) {
  const sz = variant === 'donut' ? 130 : size;
  const stroke = variant === 'donut' ? 7 : 3;
  const r = (sz - stroke - 2) / 2;
  const c = 2 * Math.PI * r;
  const color =
    variant === 'donut'
      ? merrisTokens.primary
      : score >= 70
        ? merrisTokens.success
        : score >= 40
          ? merrisTokens.warning
          : merrisTokens.error;

  return (
    <svg width={sz} height={sz} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={merrisTokens.surfaceLow} strokeWidth={stroke} />
      <circle
        cx={sz / 2}
        cy={sz / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        strokeLinecap="round"
      />
      <text
        x={sz / 2}
        y={variant === 'donut' ? sz / 2 - 4 : sz / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={merrisTokens.text}
        fontSize={variant === 'donut' ? 30 : 11}
        fontWeight={variant === 'donut' ? 700 : 600}
        fontFamily={merrisTokens.fontDisplay}
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {variant === 'donut' ? score : `${score}%`}
      </text>
      {variant === 'donut' && (
        <text
          x={sz / 2}
          y={sz / 2 + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill={merrisTokens.textTertiary}
          fontSize={10}
          fontFamily={merrisTokens.fontBody}
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          /100
        </text>
      )}
    </svg>
  );
}
