// src/services/knowledge/regional.service.ts
//
// Maps regulatory entries to regional modules by searching K3 (regulatory)
// with region-specific jurisdiction keywords.

import { searchRegulatory, type KnowledgeSearchResult } from './knowledge.service.js';

// ============================================================
// GCC — Qatar, Saudi Arabia, UAE, Oman, Bahrain, Kuwait
// ============================================================

const GCC_JURISDICTIONS = ['QA', 'SA', 'AE', 'OM', 'BH', 'KW'];
const GCC_KEYWORDS = ['GCC', 'Qatar', 'Saudi Arabia', 'UAE', 'Oman', 'Bahrain', 'Kuwait', 'QSE', 'Tadawul', 'ADX', 'DFM'];

export async function getGCCRegulations(topic?: string): Promise<KnowledgeSearchResult> {
  const jurisdictionQuery = GCC_JURISDICTIONS.join(' ');
  const keywordQuery = GCC_KEYWORDS.join(' ');
  const topicQuery = topic ? ` ${topic}` : ' ESG sustainability';
  const query = `${jurisdictionQuery} ${keywordQuery}${topicQuery}`;

  return searchRegulatory('GCC', query, { limit: 20 });
}

// ============================================================
// EU — CSRD, ESRS, Taxonomy, CSDDD, SFDR
// ============================================================

const EU_KEYWORDS = ['EU', 'European Union', 'CSRD', 'ESRS', 'Taxonomy', 'CSDDD', 'SFDR', 'European Commission'];

export async function getEURegulations(topic?: string): Promise<KnowledgeSearchResult> {
  const keywordQuery = EU_KEYWORDS.join(' ');
  const topicQuery = topic ? ` ${topic}` : ' ESG sustainability reporting';
  const query = `${keywordQuery}${topicQuery}`;

  return searchRegulatory('EU', query, { limit: 20 });
}

// ============================================================
// US — SEC climate, California SB 253/261
// ============================================================

const US_KEYWORDS = ['US', 'United States', 'SEC', 'climate disclosure', 'California', 'SB 253', 'SB 261', 'EPA'];

export async function getUSRegulations(topic?: string): Promise<KnowledgeSearchResult> {
  const keywordQuery = US_KEYWORDS.join(' ');
  const topicQuery = topic ? ` ${topic}` : ' ESG climate disclosure';
  const query = `${keywordQuery}${topicQuery}`;

  return searchRegulatory('US', query, { limit: 20 });
}

// ============================================================
// APAC — SGX, HKEX, ASX
// ============================================================

const APAC_KEYWORDS = ['APAC', 'Asia Pacific', 'SGX', 'HKEX', 'ASX', 'Singapore', 'Hong Kong', 'Australia', 'ISSB'];

export async function getAPACRegulations(topic?: string): Promise<KnowledgeSearchResult> {
  const keywordQuery = APAC_KEYWORDS.join(' ');
  const topicQuery = topic ? ` ${topic}` : ' ESG sustainability reporting';
  const query = `${keywordQuery}${topicQuery}`;

  return searchRegulatory('APAC', query, { limit: 20 });
}
