export { vectorSearch } from "./vector-search.js";
export { bm25Search } from "./bm25-search.js";
export { hybridSearch } from "./hybrid-search.js";
export { rerank } from "./reranker.js";
export type { VaultSearchResult, VaultSearchOptions } from "./vector-search.js";
export type { HybridSearchOptions } from "./hybrid-search.js";

import { hybridSearch, type HybridSearchOptions } from "./hybrid-search.js";

export async function vaultSearch(opts: HybridSearchOptions) {
  return hybridSearch(opts);
}
