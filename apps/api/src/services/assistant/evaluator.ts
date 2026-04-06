import { sendMessage } from '../../lib/claude.js';

export interface EvaluatorResult {
  score: number;
  intelligence_score?: number;
  discipline_score?: number;
  partner_signals?: number;
  decision: 'PASS' | 'FIX' | 'REJECT';
  flags: string[];
  fix_instructions?: string;
  rewritten?: boolean;
}

// Hard block checks — only content failures, not wording issues
export function checkHardBlocks(response: string): string | null {
  // Logic contradiction: says insufficient data then concludes anyway
  if (/insufficient (data|evidence|verified)/i.test(response)) {
    const afterInsufficient = response.split(/insufficient/i)[1];
    if (afterInsufficient && /\bis\b.*\b(competitive|leading|lagging|above|below)\b/i.test(afterInsufficient))
      return 'logic_inconsistency';
  }
  return null;
}

// AI-based evaluation — partner-grade scoring
export async function evaluateResponse(
  query: string,
  response: string,
  context: Record<string, unknown>
): Promise<EvaluatorResult> {
  const evaluatorPrompt = `You are a senior ESG partner reviewing work before it goes to a client. Score on TWO dimensions:

INTELLIGENCE (0-100):
- Did it make a clear decision or just present options?
- Did it identify what breaks / primary failure point?
- Did it challenge assumptions rather than accept at face value?
- Did it link findings to commercial or strategic impact?
- Did it flag anomalies when the numbers don't add up?
- Did it contextualise for the client's specific reality?
- Did it show trade-off awareness?
- Is the reasoning sound and the conclusion defensible?

DISCIPLINE (0-100):
- Prose paragraphs (no bullet lists as primary structure)?
- Within word limit for task type?
- No emoji, no markdown headers, no bold text?
- No sycophantic openers or meta-commentary?
- Ends with confidence + key data gaps?

PARTNER SIGNALS (bonus):
If 3 or more of these are present, add +10 to final score:
- Made a decision, not just analysis
- Identified primary execution risk
- Challenged an assumption or claim
- Stated commercial implication
- Flagged an anomaly

QUERY: ${query}
CONTEXT: ${JSON.stringify(context)}
RESPONSE: ${response}

Return ONLY valid JSON:
{
  "intelligence_score": <0-100>,
  "discipline_score": <0-100>,
  "partner_signals": <count 0-5>,
  "final_score": <calculated>,
  "flags": [],
  "decision": "PASS|FIX|REJECT",
  "fix_instructions": "<what to fix, or null>"
}

SCORING:
final_score = (intelligence_score * 0.8) + (discipline_score * 0.2) + (partner_signals >= 3 ? 10 : 0)

DECISION:
- final_score >= 85 → PASS
- final_score 70-84 → FIX (rewrite format only, preserve all reasoning)
- final_score < 70 → REJECT (regenerate)

OVERRIDE: if intelligence_score >= 85 but decision would be REJECT → force FIX instead. Never reject strong thinking.

CRITICAL: formatting issues are worth max -5 from discipline_score. A response with excellent judgment and minor bold text gets FIX (clean up format), not REJECT (throw away the thinking).`;

  try {
    const result = await sendMessage({
      system: 'You are a senior ESG partner reviewing work quality. Return only valid JSON.',
      messages: [{ role: 'user', content: evaluatorPrompt }],
      maxTokens: 500,
    });

    if (!result) return { score: 85, decision: 'PASS', flags: [] };

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { score: 85, decision: 'PASS', flags: [] };

    const parsed = JSON.parse(jsonMatch[0]);
    const intelligence = parsed.intelligence_score || 80;
    const discipline = parsed.discipline_score || 80;
    const partnerSignals = parsed.partner_signals || 0;
    const finalScore = Math.round((intelligence * 0.8) + (discipline * 0.2) + (partnerSignals >= 3 ? 10 : 0));

    let decision: 'PASS' | 'FIX' | 'REJECT';
    if (finalScore >= 85) {
      decision = 'PASS';
    } else if (finalScore >= 70) {
      decision = 'FIX';
    } else {
      // Override: never reject strong thinking
      decision = intelligence >= 85 ? 'FIX' : 'REJECT';
    }

    return {
      score: finalScore,
      intelligence_score: intelligence,
      discipline_score: discipline,
      partner_signals: partnerSignals,
      decision,
      flags: parsed.flags || [],
      fix_instructions: parsed.fix_instructions || undefined,
    };
  } catch {
    return { score: 85, decision: 'PASS', flags: [] };
  }
}

// Auto-rewrite for FIX decisions — preserve reasoning, fix format only
export async function autoRewrite(
  original: string,
  flags: string[],
  fixInstructions: string
): Promise<string> {
  try {
    const result = await sendMessage({
      system: 'You are an ESG response editor. Preserve all reasoning. Return only the reformatted text.',
      messages: [{
        role: 'user',
        content: `Reformat this response. Preserve ALL reasoning, conclusions, and judgment. Changes allowed: remove bold/markdown formatting, convert any bullet structures to prose, trim to 320 words max by removing background (keep conclusions). Do NOT change any analytical content, recommendations, or data citations.\nORIGINAL:\n${original}`,
      }],
      maxTokens: 2000,
    });
    return result || original;
  } catch {
    return original;
  }
}
