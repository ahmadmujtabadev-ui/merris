import { Framework, IFramework } from '../../models/framework.model.js';
import { Disclosure, IDisclosure } from '../../models/disclosure.model.js';
import { EmissionFactor, IEmissionFactor } from '../../models/emission-factor.model.js';
import { CrossFrameworkMap } from '../../models/cross-map.model.js';
import { AppError } from '../auth/auth.service.js';

// ============================================================
// Types
// ============================================================

export interface FrameworkSummary {
  id: string;
  code: string;
  name: string;
  version: string;
  issuingBody: string;
  region: string;
  type: string;
  topicCount: number;
  disclosureCount: number;
}

export interface DataAgendaItem {
  metricName: string;
  unit: string;
  frameworks: string[];
  disclosureCodes: string[];
  topic: string;
  dataType: string;
  status: 'required' | 'optional' | 'satisfied';
  priority: number;
}

export interface DataAgenda {
  required: DataAgendaItem[];
  optional: DataAgendaItem[];
  satisfied: DataAgendaItem[];
  summary: {
    totalMetrics: number;
    uniqueMetrics: number;
    deduplicatedCount: number;
    completionPercentage: number;
    byFramework: Array<{
      code: string;
      name: string;
      total: number;
      completed: number;
      percentage: number;
    }>;
  };
}

export interface CrossReferenceResult {
  sourceDisclosure: {
    id: string;
    code: string;
    name: string;
    frameworkCode: string;
  };
  crossReferences: Array<{
    frameworkCode: string;
    disclosureCode: string;
    disclosureName: string;
    mappingType: string;
    notes?: string;
  }>;
}

// ============================================================
// Priority Scoring
// ============================================================

const FRAMEWORK_TYPE_PRIORITY: Record<string, number> = {
  mandatory: 100,
  voluntary: 50,
  rating: 30,
  taxonomy: 20,
};

// ============================================================
// Framework Queries
// ============================================================

export async function listFrameworks(filters?: {
  type?: string;
  region?: string;
}): Promise<FrameworkSummary[]> {
  const query: Record<string, unknown> = {};

  if (filters?.type) {
    query['type'] = filters.type;
  }
  if (filters?.region) {
    // Support 'gcc' as shorthand for GCC countries
    if (filters.region.toLowerCase() === 'gcc') {
      query['region'] = {
        $in: [
          'Saudi Arabia',
          'UAE',
          'Qatar',
          'Bahrain',
          'Kuwait',
          'Oman',
          'global',
        ],
      };
    } else {
      query['region'] = { $regex: new RegExp(filters.region, 'i') };
    }
  }

  const frameworks = await Framework.find(query).lean();

  return frameworks.map((fw) => ({
    id: fw.id,
    code: fw.code,
    name: fw.name,
    version: fw.version,
    issuingBody: fw.issuingBody,
    region: fw.region,
    type: fw.type,
    topicCount: fw.structure.topics.length,
    disclosureCount: fw.structure.topics.reduce(
      (sum, t) => sum + t.disclosures.length,
      0
    ),
  }));
}

export async function getFrameworkByCode(code: string) {
  const framework = await Framework.findOne({ code }).lean();
  if (!framework) {
    throw new AppError(`Framework not found: ${code}`, 404);
  }
  return framework;
}

export async function getDisclosuresForFramework(
  frameworkCode: string,
  filters?: { topic?: string; dataType?: string }
): Promise<IDisclosure[]> {
  const query: Record<string, unknown> = { frameworkCode };

  if (filters?.topic) {
    query['topic'] = { $regex: new RegExp(filters.topic, 'i') };
  }
  if (filters?.dataType) {
    query['dataType'] = filters.dataType;
  }

  const disclosures = await Disclosure.find(query).lean();

  // Fallback: if standalone Disclosure collection is empty, extract from Framework doc
  if (disclosures.length === 0) {
    const fw = await Framework.findOne({ code: frameworkCode }).lean();
    if (!fw) {
      throw new AppError(`Framework not found: ${frameworkCode}`, 404);
    }

    let results = fw.structure.topics.flatMap((t) =>
      t.disclosures.map((d) => ({ ...d, frameworkCode: fw.code }))
    );

    if (filters?.topic) {
      const re = new RegExp(filters.topic, 'i');
      results = results.filter((d) => re.test(d.topic));
    }
    if (filters?.dataType) {
      results = results.filter((d) => d.dataType === filters.dataType);
    }

    return results as unknown as IDisclosure[];
  }

  return disclosures as unknown as IDisclosure[];
}

// ============================================================
// Disclosure Queries
// ============================================================

export async function getDisclosureById(
  disclosureId: string
): Promise<IDisclosure> {
  // Try standalone collection first
  const disclosure = await Disclosure.findOne({ id: disclosureId }).lean();
  if (disclosure) {
    return disclosure as unknown as IDisclosure;
  }

  // Fallback: search within framework documents
  const frameworks = await Framework.find({}).lean();
  for (const fw of frameworks) {
    for (const topic of fw.structure.topics) {
      const found = topic.disclosures.find((d) => d.id === disclosureId);
      if (found) {
        return {
          ...found,
          frameworkCode: fw.code,
        } as unknown as IDisclosure;
      }
    }
  }

  throw new AppError(`Disclosure not found: ${disclosureId}`, 404);
}

export async function getCrossReferences(
  disclosureId: string
): Promise<CrossReferenceResult> {
  const disclosure = await getDisclosureById(disclosureId);

  const crossRefs: CrossReferenceResult['crossReferences'] = [];

  for (const ref of disclosure.crossReferences) {
    // Look up the target disclosure name
    let disclosureName = ref.disclosureCode;

    // Try standalone collection
    const targetDisc = await Disclosure.findOne({
      code: ref.disclosureCode,
    }).lean();
    if (targetDisc) {
      disclosureName = targetDisc.name;
    } else {
      // Fallback: search frameworks
      const targetFw = await Framework.findOne({
        code: ref.frameworkCode,
      }).lean();
      if (targetFw) {
        for (const t of targetFw.structure.topics) {
          const d = t.disclosures.find((d) => d.code === ref.disclosureCode);
          if (d) {
            disclosureName = d.name;
            break;
          }
        }
      }
    }

    crossRefs.push({
      frameworkCode: ref.frameworkCode,
      disclosureCode: ref.disclosureCode,
      disclosureName,
      mappingType: ref.mappingType,
      notes: ref.notes,
    });
  }

  // Also check cross-map documents for reverse mappings
  const frameworkCode =
    (disclosure as unknown as { frameworkCode?: string }).frameworkCode ||
    disclosure.frameworkId?.replace(/^fw-/, '').replace(/-\d+$/, '');

  const crossMaps = await CrossFrameworkMap.find({
    $or: [
      { sourceFramework: frameworkCode },
      { targetFramework: frameworkCode },
    ],
  }).lean();

  for (const cm of crossMaps) {
    for (const mapping of cm.mappings) {
      const discCode = disclosure.code;

      if (
        cm.sourceFramework === frameworkCode &&
        mapping.gri_code === discCode
      ) {
        // Already covered by disclosure.crossReferences — check for duplicates
        const exists = crossRefs.some(
          (r) =>
            r.frameworkCode === cm.targetFramework &&
            r.disclosureCode === mapping.target_code
        );
        if (!exists) {
          crossRefs.push({
            frameworkCode: cm.targetFramework,
            disclosureCode: mapping.target_code,
            disclosureName: mapping.target_name,
            mappingType: mapping.mapping,
            notes: mapping.notes,
          });
        }
      } else if (
        cm.targetFramework === frameworkCode &&
        mapping.target_code === discCode
      ) {
        // Reverse mapping
        const exists = crossRefs.some(
          (r) =>
            r.frameworkCode === cm.sourceFramework &&
            r.disclosureCode === mapping.gri_code
        );
        if (!exists) {
          crossRefs.push({
            frameworkCode: cm.sourceFramework,
            disclosureCode: mapping.gri_code,
            disclosureName: mapping.gri_name,
            mappingType: mapping.mapping,
            notes: mapping.notes,
          });
        }
      }
    }
  }

  return {
    sourceDisclosure: {
      id: disclosure.id,
      code: disclosure.code,
      name: disclosure.name,
      frameworkCode:
        (disclosure as unknown as { frameworkCode?: string }).frameworkCode ||
        frameworkCode || '',
    },
    crossReferences: crossRefs,
  };
}

// ============================================================
// Data Agenda (The Key Endpoint)
// ============================================================

export async function buildDataAgenda(
  frameworkCodes: string[],
  satisfiedMetrics: string[] = []
): Promise<DataAgenda> {
  // Load all requested frameworks
  const frameworks = await Framework.find({
    code: { $in: frameworkCodes },
  }).lean();

  if (frameworks.length === 0) {
    throw new AppError('No frameworks found for the given codes', 404);
  }

  // Collect all metrics from all frameworks
  const metricMap = new Map<
    string,
    {
      metricName: string;
      unit: string;
      frameworks: Set<string>;
      disclosureCodes: Set<string>;
      topic: string;
      dataType: string;
      priority: number;
    }
  >();

  // Build cross-reference map for deduplication
  const crossRefMap = new Map<string, Set<string>>(); // disclosureCode -> set of equivalent disclosureCodes

  for (const fw of frameworks) {
    for (const topic of fw.structure.topics) {
      for (const disc of topic.disclosures) {
        // Map cross-references to find equivalents
        for (const ref of disc.crossReferences) {
          if (
            ref.mappingType === 'equivalent' &&
            frameworkCodes.includes(ref.frameworkCode)
          ) {
            const key = disc.code;
            if (!crossRefMap.has(key)) {
              crossRefMap.set(key, new Set());
            }
            crossRefMap.get(key)!.add(ref.disclosureCode);

            // Bidirectional
            if (!crossRefMap.has(ref.disclosureCode)) {
              crossRefMap.set(ref.disclosureCode, new Set());
            }
            crossRefMap.get(ref.disclosureCode)!.add(key);
          }
        }
      }
    }
  }

  // Build union-find groups from cross-references
  const disclosureGroups = buildDisclosureGroups(crossRefMap);

  // Now iterate and create deduplicated metric list
  const processedGroups = new Set<string>();

  for (const fw of frameworks) {
    const fwPriority = FRAMEWORK_TYPE_PRIORITY[fw.type] || 10;

    for (const topic of fw.structure.topics) {
      for (const disc of topic.disclosures) {
        // Find group representative
        const groupKey = disclosureGroups.get(disc.code) || disc.code;

        if (disc.requiredMetrics.length === 0) {
          // Narrative disclosures get one entry
          const metricKey = `${groupKey}::${disc.name}`;

          if (!metricMap.has(metricKey)) {
            metricMap.set(metricKey, {
              metricName: disc.name,
              unit: disc.dataType,
              frameworks: new Set([fw.code]),
              disclosureCodes: new Set([disc.code]),
              topic: disc.topic,
              dataType: disc.dataType,
              priority: fwPriority,
            });
          } else {
            const existing = metricMap.get(metricKey)!;
            existing.frameworks.add(fw.code);
            existing.disclosureCodes.add(disc.code);
            existing.priority = Math.max(existing.priority, fwPriority);
          }
        } else {
          for (const metric of disc.requiredMetrics) {
            const metricKey = `${groupKey}::${metric.name}`;

            if (!metricMap.has(metricKey)) {
              metricMap.set(metricKey, {
                metricName: metric.name,
                unit: metric.unit,
                frameworks: new Set([fw.code]),
                disclosureCodes: new Set([disc.code]),
                topic: disc.topic,
                dataType: disc.dataType,
                priority: fwPriority,
              });
            } else {
              const existing = metricMap.get(metricKey)!;
              existing.frameworks.add(fw.code);
              existing.disclosureCodes.add(disc.code);
              existing.priority = Math.max(existing.priority, fwPriority);
            }
          }
        }
      }
    }
  }

  // Convert to agenda items
  const satisfiedSet = new Set(
    satisfiedMetrics.map((m) => m.toLowerCase())
  );
  const required: DataAgendaItem[] = [];
  const optional: DataAgendaItem[] = [];
  const satisfied: DataAgendaItem[] = [];

  for (const [_key, entry] of metricMap) {
    const item: DataAgendaItem = {
      metricName: entry.metricName,
      unit: entry.unit,
      frameworks: Array.from(entry.frameworks),
      disclosureCodes: Array.from(entry.disclosureCodes),
      topic: entry.topic,
      dataType: entry.dataType,
      status: 'required',
      priority: entry.priority,
    };

    if (satisfiedSet.has(entry.metricName.toLowerCase())) {
      item.status = 'satisfied';
      satisfied.push(item);
    } else if (entry.priority >= FRAMEWORK_TYPE_PRIORITY['voluntary']!) {
      required.push(item);
    } else {
      item.status = 'optional';
      optional.push(item);
    }
  }

  // Sort by priority descending
  required.sort((a, b) => b.priority - a.priority);
  optional.sort((a, b) => b.priority - a.priority);

  // Compute total metrics (without dedup) for comparison
  let totalMetrics = 0;
  for (const fw of frameworks) {
    for (const topic of fw.structure.topics) {
      for (const disc of topic.disclosures) {
        totalMetrics += Math.max(disc.requiredMetrics.length, 1);
      }
    }
  }

  const uniqueMetrics = metricMap.size;

  // Compute per-framework completeness
  const byFramework = frameworks.map((fw) => {
    let total = 0;
    let completed = 0;

    for (const topic of fw.structure.topics) {
      for (const disc of topic.disclosures) {
        const metricsInDisc = Math.max(disc.requiredMetrics.length, 1);
        total += metricsInDisc;

        if (disc.requiredMetrics.length === 0) {
          if (satisfiedSet.has(disc.name.toLowerCase())) {
            completed += 1;
          }
        } else {
          for (const m of disc.requiredMetrics) {
            if (satisfiedSet.has(m.name.toLowerCase())) {
              completed += 1;
            }
          }
        }
      }
    }

    return {
      code: fw.code,
      name: fw.name,
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  const totalSatisfied = satisfied.length;
  const completionPercentage =
    uniqueMetrics > 0
      ? Math.round((totalSatisfied / uniqueMetrics) * 100)
      : 0;

  return {
    required,
    optional,
    satisfied,
    summary: {
      totalMetrics,
      uniqueMetrics,
      deduplicatedCount: totalMetrics - uniqueMetrics,
      completionPercentage,
      byFramework,
    },
  };
}

/**
 * Union-Find to group equivalent disclosures.
 * Returns a map of disclosureCode -> group representative.
 */
function buildDisclosureGroups(
  crossRefMap: Map<string, Set<string>>
): Map<string, string> {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x);
    }
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent.set(rb, ra);
    }
  }

  for (const [code, refs] of crossRefMap) {
    for (const ref of refs) {
      union(code, ref);
    }
  }

  // Build result
  const result = new Map<string, string>();
  for (const code of parent.keys()) {
    result.set(code, find(code));
  }
  return result;
}

// ============================================================
// Emission Factor Queries
// ============================================================

export async function queryEmissionFactors(filters?: {
  country?: string;
  source?: string;
  year?: number;
  scope?: number;
  category?: string;
  fuelType?: string;
}): Promise<IEmissionFactor[]> {
  const query: Record<string, unknown> = {};

  if (filters?.country) {
    query['country'] = { $regex: new RegExp(filters.country, 'i') };
  }
  if (filters?.source) {
    query['source'] = { $regex: new RegExp(filters.source, 'i') };
  }
  if (filters?.year) {
    query['year'] = filters.year;
  }
  if (filters?.scope) {
    query['scope'] = filters.scope;
  }
  if (filters?.category) {
    query['category'] = { $regex: new RegExp(filters.category, 'i') };
  }
  if (filters?.fuelType) {
    query['fuelType'] = { $regex: new RegExp(filters.fuelType, 'i') };
  }

  return EmissionFactor.find(query).sort({ year: -1 }).lean() as unknown as IEmissionFactor[];
}

export async function getGridEmissionFactor(
  country: string
): Promise<IEmissionFactor> {
  const factor = await EmissionFactor.findOne({
    country: { $regex: new RegExp(country, 'i') },
    category: 'grid-electricity',
  })
    .sort({ year: -1 })
    .lean();

  if (!factor) {
    throw new AppError(
      `Grid emission factor not found for country: ${country}`,
      404
    );
  }

  return factor as unknown as IEmissionFactor;
}
