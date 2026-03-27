/**
 * TF-IDF Engine — Pure Node.js Implementation
 *
 * Self-contained TF-IDF with cosine similarity for semantic search.
 * No external API dependencies. Runs entirely in-process.
 */

// ============================================================
// Stopwords (common English words to filter out)
// ============================================================

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'my', 'our', 'your', 'his', 'her', 'their',
  'them', 'us', 'if', 'then', 'than', 'so', 'no', 'not', 'only', 'very',
  'also', 'just', 'about', 'above', 'after', 'again', 'all', 'am', 'any',
  'as', 'because', 'before', 'between', 'both', 'each', 'few', 'get',
  'got', 'here', 'how', 'into', 'more', 'most', 'much', 'new', 'now',
  'off', 'once', 'one', 'other', 'out', 'over', 'own', 'per', 'same',
  'some', 'still', 'such', 'there', 'through', 'too', 'under', 'up',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'down', 'during', 'every', 'first', 'last', 'less', 'let', 'like',
  'long', 'make', 'many', 'next', 'nor', 'part', 'put', 'right',
  'since', 'take', 'two', 'until', 'way', 'well', 'work', 'even',
  'etc', 'e', 'g', 'eg', 'ie', 'vs', 'including', 'included',
  'however', 'therefore', 'thus', 'although', 'whether', 'within',
  'without', 'according', 'across', 'along', 'already', 'among',
  'another', 'around', 'available', 'back', 'based', 'become',
  'set', 'type', 'use', 'used', 'using', 'number', 'data', 'value',
]);

// ESG-specific terms to always keep (never filter as stopwords)
const ESG_TERMS = new Set([
  'tco2e', 'co2', 'co2e', 'ghg', 'gri', 'esrs', 'sfdr', 'csrd', 'issb',
  'tcfd', 'tnfd', 'sasb', 'cdp', 'sbti', 'ipcc', 'iea', 'ngfs', 'wri',
  'pcaf', 'eu', 'esg', 'scope1', 'scope2', 'scope3', 'ndc', 'cop',
  'mwh', 'kwh', 'gwh', 'twh', 'gwp', 'rcp', 'ssp', 'ar6', 'ar5',
  'dnsh', 'pai', 'mifid', 'ucits', 'aifmd', 'nfrd',
  'csddd', 'cbam', 'ets', 'lulucf', 'ccus', 'ccs',
  'ltifr', 'trir', 'dei', 'sdg', 'sdgs',
]);

// Common ESG bigrams to detect
const BIGRAM_PATTERNS = [
  'scope 1', 'scope 2', 'scope 3', 'carbon footprint', 'water stress',
  'carbon intensity', 'energy intensity', 'emission factor', 'emission factors',
  'climate risk', 'climate change', 'global warming', 'greenhouse gas',
  'renewable energy', 'circular economy', 'supply chain', 'due diligence',
  'human rights', 'forced labour', 'forced labor', 'child labor', 'child labour',
  'conflict minerals', 'green bond', 'green bonds', 'social bond', 'social bonds',
  'sustainability linked', 'transition plan', 'net zero', 'carbon neutral',
  'science based', 'science based targets', 'paris agreement', 'paris aligned',
  'double materiality', 'financial materiality', 'impact materiality',
  'physical risk', 'transition risk', 'stranded assets', 'just transition',
  'biodiversity loss', 'water scarcity', 'air quality', 'waste management',
  'hazardous waste', 'water withdrawal', 'water consumption', 'water discharge',
  'board diversity', 'gender pay', 'living wage', 'modern slavery',
  'eu taxonomy', 'green taxonomy', 'saudi arabia', 'united arab emirates',
  'gcc countries', 'middle east', 'north africa', 'mena region',
  'qatar national', 'saudi vision', 'abu dhabi', 'carbon capture',
  'carbon credit', 'carbon credits', 'carbon market', 'carbon tax',
  'carbon pricing', 'internal carbon', 'carbon offset', 'carbon offsets',
  'climate scenario', 'scenario analysis', 'stress test', 'stress testing',
  'environmental impact', 'social impact', 'governance structure',
  'risk management', 'risk assessment', 'materiality assessment',
  'stakeholder engagement', 'value chain', 'life cycle', 'life cycle assessment',
];

// ============================================================
// Exported Types
// ============================================================

export interface SparseVector {
  terms: string[];
  weights: number[];
  magnitude: number;
}

// ============================================================
// TF-IDF Engine
// ============================================================

export class TFIDFEngine {
  private idf: Map<string, number> = new Map();
  private docCount: number = 0;
  private termDocFreq: Map<string, number> = new Map();
  private bigramSet: Set<string>;
  private built: boolean = false;

  constructor() {
    this.bigramSet = new Set(BIGRAM_PATTERNS);
  }

  // ----------------------------------------------------------
  // Text Preprocessing
  // ----------------------------------------------------------

  tokenize(text: string): string[] {
    // Lowercase
    let normalized = text.toLowerCase();

    // Replace bigrams with underscore-joined tokens before splitting
    for (const bigram of this.bigramSet) {
      const regex = new RegExp(bigram.replace(/\s+/g, '\\s+'), 'gi');
      normalized = normalized.replace(regex, bigram.replace(/\s+/g, '_'));
    }

    // Remove punctuation except underscores and hyphens within words
    normalized = normalized.replace(/[^\w\s_-]/g, ' ');

    // Split on whitespace
    const rawTokens = normalized.split(/\s+/).filter(Boolean);

    const tokens: string[] = [];
    for (const token of rawTokens) {
      // Clean leading/trailing hyphens
      const cleaned = token.replace(/^[-_]+|[-_]+$/g, '');
      if (!cleaned || cleaned.length < 2) continue;

      // Keep ESG terms intact
      if (ESG_TERMS.has(cleaned)) {
        tokens.push(cleaned);
        continue;
      }

      // Filter stopwords
      if (STOPWORDS.has(cleaned)) continue;

      // Keep numbers that look like years or measurements
      if (/^\d+$/.test(cleaned)) {
        const num = parseInt(cleaned, 10);
        if (num >= 1990 && num <= 2100) {
          tokens.push(cleaned); // Keep year-like numbers
        }
        continue; // Skip other pure numbers
      }

      tokens.push(cleaned);
    }

    return tokens;
  }

  // ----------------------------------------------------------
  // Build IDF from all documents
  // ----------------------------------------------------------

  buildIDF(documents: string[]): void {
    this.docCount = documents.length;
    this.termDocFreq.clear();
    this.idf.clear();

    // Count document frequency for each term
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);
      }
    }

    // Compute IDF: log(N / df) with smoothing
    for (const [term, df] of this.termDocFreq) {
      // IDF with +1 smoothing to avoid division by zero and reduce impact of very rare terms
      this.idf.set(term, Math.log((this.docCount + 1) / (df + 1)) + 1);
    }

    this.built = true;
  }

  // ----------------------------------------------------------
  // Compute TF-IDF vector for a single document
  // ----------------------------------------------------------

  computeVector(text: string, maxTerms = 500): SparseVector {
    const tokens = this.tokenize(text);

    if (tokens.length === 0) {
      return { terms: [], weights: [], magnitude: 0 };
    }

    // Compute term frequency (normalized by doc length)
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Normalize TF by document length
    const docLen = tokens.length;
    const tfidfEntries: Array<[string, number]> = [];

    for (const [term, count] of tf) {
      const normalizedTF = count / docLen;
      const idfVal = this.idf.get(term);
      // If term not in IDF (query term not in corpus), give it a moderate weight
      const weight = normalizedTF * (idfVal ?? Math.log(this.docCount + 1));
      if (weight > 0) {
        tfidfEntries.push([term, weight]);
      }
    }

    // Sort by weight descending, keep top N
    tfidfEntries.sort((a, b) => b[1] - a[1]);
    const topEntries = tfidfEntries.slice(0, maxTerms);

    const terms = topEntries.map(([t]) => t);
    const weights = topEntries.map(([, w]) => w);

    // Pre-compute magnitude
    let mag = 0;
    for (const w of weights) {
      mag += w * w;
    }
    const magnitude = Math.sqrt(mag);

    return { terms, weights, magnitude };
  }

  // ----------------------------------------------------------
  // Cosine similarity between two sparse vectors
  // ----------------------------------------------------------

  cosineSimilarity(a: SparseVector, b: SparseVector): number {
    if (a.magnitude === 0 || b.magnitude === 0) return 0;

    // Build lookup from the smaller vector
    const smaller = a.terms.length <= b.terms.length ? a : b;
    const larger = a.terms.length <= b.terms.length ? b : a;

    const lookup = new Map<string, number>();
    for (let i = 0; i < smaller.terms.length; i++) {
      lookup.set(smaller.terms[i]!, smaller.weights[i]!);
    }

    let dotProduct = 0;
    for (let i = 0; i < larger.terms.length; i++) {
      const weight = lookup.get(larger.terms[i]!);
      if (weight !== undefined) {
        dotProduct += weight * larger.weights[i]!;
      }
    }

    return dotProduct / (a.magnitude * b.magnitude);
  }

  // ----------------------------------------------------------
  // Search: find top N most similar documents to a query
  // ----------------------------------------------------------

  search(
    query: string,
    candidates: Array<{ terms: string[]; weights: number[]; magnitude: number; id: string }>,
    limit: number = 10,
    minScore: number = 0.01
  ): Array<{ id: string; score: number }> {
    const queryVector = this.computeVector(query);

    if (queryVector.magnitude === 0) {
      return [];
    }

    const scored: Array<{ id: string; score: number }> = [];

    for (const candidate of candidates) {
      const score = this.cosineSimilarity(queryVector, candidate);
      if (score >= minScore) {
        scored.push({ id: candidate.id, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  // ----------------------------------------------------------
  // Utility: check if engine has been built
  // ----------------------------------------------------------

  isBuilt(): boolean {
    return this.built;
  }

  getDocCount(): number {
    return this.docCount;
  }

  getVocabSize(): number {
    return this.idf.size;
  }

  // ----------------------------------------------------------
  // Serialization for caching
  // ----------------------------------------------------------

  serialize(): { docCount: number; idf: Record<string, number>; termDocFreq: Record<string, number> } {
    return {
      docCount: this.docCount,
      idf: Object.fromEntries(this.idf),
      termDocFreq: Object.fromEntries(this.termDocFreq),
    };
  }

  deserialize(data: { docCount: number; idf: Record<string, number>; termDocFreq: Record<string, number> }): void {
    this.docCount = data.docCount;
    this.idf = new Map(Object.entries(data.idf));
    this.termDocFreq = new Map(Object.entries(data.termDocFreq));
    this.built = true;
  }
}
