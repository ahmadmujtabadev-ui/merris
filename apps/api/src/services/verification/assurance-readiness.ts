// src/services/verification/assurance-readiness.ts
//
// Assurance readiness checker — maps verification findings to
// assurance standard impacts and generates pre-verification checklist.

import mongoose from 'mongoose';
import type { VerificationFinding } from './verification.service';
import { determineApplicableFrameworks, type EntityInfo } from './entity-context';

export interface AssuranceApplicability {
  framework: string;
  standard: string;
  level: string;
  deadline: string;
  status: 'ready' | 'partially_ready' | 'not_ready';
}

export interface AssuranceImpact {
  finding_id: string;
  original_finding: string;
  assurance_standard: string;
  verifier_action: string;
  likely_outcome: string;
  evidence_required: string[];
  remediation: string;
}

export interface AssuranceReadinessReport {
  entity: string;
  applicable_assurance: AssuranceApplicability[];
  findings_with_assurance_impact: AssuranceImpact[];
  pre_verification_checklist: Array<{
    priority: 'critical' | 'high' | 'medium';
    action: string;
    deadline_recommendation: string;
  }>;
  readiness_score: number;
}

export async function checkAssuranceReadiness(
  entity: EntityInfo,
  findings: VerificationFinding[]
): Promise<AssuranceReadinessReport> {
  const db = mongoose.connection.db!;
  const standards = await db.collection('kb_assurance_standards').find({}).toArray();

  const frameworks = determineApplicableFrameworks(entity);

  // Map frameworks to assurance requirements
  const applicable: AssuranceApplicability[] = [];
  const frameworkStandardMap: Record<string, string> = {
    'esrs': 'ISAE_3000',
    'gri': 'ISAE_3000',
    'issb': 'ISAE_3410',
    'tcfd': 'ISAE_3410',
    'qse': 'GCC_ASSURANCE',
    'saudi-exchange': 'GCC_ASSURANCE',
    'adx': 'GCC_ASSURANCE',
  };

  for (const fw of frameworks) {
    const stdCode = frameworkStandardMap[fw] || 'ISAE_3000';
    const std = standards.find((s: any) => s.standard_code === stdCode);

    let level = 'not_required';
    let deadline = 'No mandatory deadline';

    if (fw === 'esrs') {
      level = 'limited (moving to reasonable by 2028)';
      deadline = 'FY2024 reports (published 2025)';
    } else if (fw === 'issb' || fw === 'tcfd') {
      level = 'recommended';
      deadline = 'Varies by jurisdiction';
    } else if (['qse', 'saudi-exchange', 'adx'].includes(fw)) {
      level = 'voluntary';
      deadline = 'No mandatory deadline — encouraged by exchange';
    }

    const criticalFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
    const status = criticalFindings === 0 ? 'ready' : criticalFindings <= 3 ? 'partially_ready' : 'not_ready';

    applicable.push({
      framework: fw.toUpperCase(),
      standard: std?.standard_name || stdCode,
      level,
      deadline,
      status,
    });
  }

  // Map findings to assurance impact
  const impacts: AssuranceImpact[] = [];
  for (const f of findings.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 10)) {
    let standard = 'ISAE 3000';
    let verifier_action = 'Would investigate and request supporting evidence';
    let likely_outcome = 'Observation in management letter';
    let evidence: string[] = ['Supporting documentation', 'Calculation workpapers'];
    let remediation = 'Address finding before verifier site visit';

    if (f.type === 'calculation_error') {
      standard = 'ISAE 3410';
      verifier_action = 'Would independently recalculate using verified emission factors';
      likely_outcome = f.severity === 'critical' ? 'Qualified opinion on GHG statement' : 'Emphasis of matter paragraph';
      evidence = ['Utility bills', 'Meter readings', 'Emission factor source documentation', 'Calculation spreadsheet'];
      remediation = 'Correct calculation and document methodology with source references';
    } else if (f.type === 'consistency_issue') {
      standard = 'ISAE 3000';
      verifier_action = 'Would cross-check all quantitative claims against source data';
      likely_outcome = 'Adverse finding requiring correction before sign-off';
      evidence = ['Source data for all quantitative claims', 'Data reconciliation workpapers'];
      remediation = 'Reconcile all figures between narrative and data tables';
    } else if (f.type === 'compliance_gap') {
      standard = 'ISAE 3000';
      verifier_action = 'Would note missing disclosure against framework requirements';
      likely_outcome = f.severity === 'critical' ? 'Qualified opinion — incomplete reporting' : 'Observation — additional disclosure recommended';
      evidence = ['Framework requirement mapping', 'Justification for omissions'];
      remediation = 'Add missing disclosure or document reason for omission';
    } else if (f.type === 'anomaly') {
      standard = 'ISAE 3410';
      verifier_action = 'Would perform analytical review and request explanation';
      likely_outcome = 'Inquiry requiring management explanation';
      evidence = ['Year-on-year trend analysis', 'Operational context for changes'];
      remediation = 'Prepare narrative explanation for significant changes';
    }

    impacts.push({
      finding_id: f.id,
      original_finding: f.description,
      assurance_standard: standard,
      verifier_action,
      likely_outcome,
      evidence_required: evidence,
      remediation,
    });
  }

  // Pre-verification checklist
  const checklist: AssuranceReadinessReport['pre_verification_checklist'] = [];

  const calcErrors = findings.filter(f => f.type === 'calculation_error');
  if (calcErrors.length > 0) {
    checklist.push({ priority: 'critical', action: `Correct ${calcErrors.length} calculation error(s) and document methodology`, deadline_recommendation: '2 weeks before verifier engagement' });
  }

  const consistencyIssues = findings.filter(f => f.type === 'consistency_issue');
  if (consistencyIssues.length > 0) {
    checklist.push({ priority: 'critical', action: `Resolve ${consistencyIssues.length} narrative-data inconsistency(ies)`, deadline_recommendation: '2 weeks before verifier engagement' });
  }

  const complianceGaps = findings.filter(f => f.type === 'compliance_gap' && f.severity === 'high');
  if (complianceGaps.length > 0) {
    checklist.push({ priority: 'high', action: `Address ${complianceGaps.length} mandatory disclosure gap(s)`, deadline_recommendation: '4 weeks before verifier engagement' });
  }

  checklist.push({ priority: 'medium', action: 'Compile all utility bills, meter readings, and fuel purchase records for reporting period', deadline_recommendation: '4 weeks before verifier engagement' });
  checklist.push({ priority: 'medium', action: 'Document emission factor sources with publication references', deadline_recommendation: '4 weeks before verifier engagement' });
  checklist.push({ priority: 'medium', action: 'Prepare organizational boundary documentation and consolidation approach', deadline_recommendation: '4 weeks before verifier engagement' });

  // Readiness score
  const totalIssues = findings.length;
  const criticalHigh = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
  const readiness_score = totalIssues === 0 ? 100 : Math.max(0, Math.round(100 - (criticalHigh * 5) - ((totalIssues - criticalHigh) * 1)));

  return {
    entity: entity.name,
    applicable_assurance: applicable,
    findings_with_assurance_impact: impacts,
    pre_verification_checklist: checklist,
    readiness_score,
  };
}
