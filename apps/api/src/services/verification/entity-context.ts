// src/services/verification/entity-context.ts
//
// Determines which frameworks actually apply to a given entity
// based on ownership type, listing exchange, and country.

export interface EntityInfo {
  name: string;
  country: string;
  ownershipType: 'state_owned' | 'listed' | 'private' | 'subsidiary';
  listingExchange?: string;
  parentCompany?: string;
}

export function determineApplicableFrameworks(entity: EntityInfo): string[] {
  const frameworks: string[] = [];

  // GRI is always voluntary/applicable
  frameworks.push('gri');

  // Exchange-specific mandatory frameworks
  if (entity.ownershipType === 'listed' || entity.ownershipType === 'subsidiary') {
    const exchange = (entity.listingExchange || '').toLowerCase();

    if (exchange.includes('qse') || exchange.includes('qatar')) {
      frameworks.push('qse');
    }
    if (exchange.includes('adx') || exchange.includes('abu dhabi')) {
      frameworks.push('adx');
    }
    if (exchange.includes('tadawul') || exchange.includes('saudi')) {
      frameworks.push('saudi-exchange');
    }
    // EU listed
    if (exchange.includes('euronext') || exchange.includes('lse') || exchange.includes('ftse') || exchange.includes('dax')) {
      frameworks.push('esrs');
    }
  }

  // State-owned: typically NO exchange-specific requirements unless voluntarily adopted
  // Private: NO mandatory frameworks

  // TCFD and ISSB are increasingly expected for large entities
  if (entity.ownershipType === 'listed' || entity.ownershipType === 'state_owned') {
    frameworks.push('tcfd');
    frameworks.push('issb');
  }

  return frameworks;
}

export function getExcludedFrameworks(
  entity: EntityInfo,
  requestedFrameworks: string[]
): Array<{ framework: string; reason: string }> {
  const applicable = determineApplicableFrameworks(entity);
  const excluded: Array<{ framework: string; reason: string }> = [];

  for (const fw of requestedFrameworks) {
    if (!applicable.includes(fw)) {
      let reason = '';
      if (fw === 'qse' && entity.ownershipType !== 'listed') {
        reason = `${entity.name} is ${entity.ownershipType}, not listed on QSE`;
      } else if (fw === 'saudi-exchange' && !entity.country?.toLowerCase().includes('saudi')) {
        reason = `${entity.name} is not listed on Saudi Exchange`;
      } else if (fw === 'esrs' && entity.ownershipType !== 'listed') {
        reason = `CSRD/ESRS applies to EU-listed entities; ${entity.name} is ${entity.ownershipType}`;
      } else {
        reason = `Framework ${fw} does not apply to ${entity.ownershipType} entities in ${entity.country}`;
      }
      excluded.push({ framework: fw, reason });
    }
  }

  return excluded;
}
