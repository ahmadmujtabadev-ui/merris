export type AnnotationSeverity = 'CRITICAL' | 'IMPORTANT' | 'MINOR';
export type AnnotationStatus = 'pending' | 'applied' | 'dismissed';

export interface DocumentAnnotation {
  id: string;
  severity: AnnotationSeverity;
  ref: string;            // e.g. 'GRI 305-1'
  title: string;
  description: string;
  suggestedFix?: string;  // text to apply
  status: AnnotationStatus;
}

// Hardcoded annotations matching the prototype FINDS spirit. Real annotations
// will eventually come from the assurance pack endpoint. The viewer's apply-fix
// button mutates these in local state only.
export const ANNOTATIONS_FIXTURE: DocumentAnnotation[] = [
  {
    id: 'a1',
    severity: 'CRITICAL',
    ref: 'GRI 305-1',
    title: 'Mismatched Direct Emissions',
    description: 'Reported Scope 1 (14,200 tCO2e) does not match facility-level sum (15,840 tCO2e).',
    suggestedFix: 'Reconcile facility emissions or restate the headline Scope 1 figure to 15,840 tCO2e.',
    status: 'pending',
  },
  {
    id: 'a2',
    severity: 'IMPORTANT',
    ref: 'G2.1',
    title: 'Vague Board Oversight',
    description: 'No mention of a Climate Risk Subcommittee or named board sponsor.',
    suggestedFix: 'Add a sentence naming the board sponsor for climate risk and the cadence of reviews.',
    status: 'pending',
  },
  {
    id: 'a3',
    severity: 'MINOR',
    ref: 'Format',
    title: 'Missing Appendix Link',
    description: 'Reference to Appendix D is broken.',
    status: 'pending',
  },
];
