export { vectorSearch } from "./vector-search.js";
export type { VaultSearchResult, VaultSearchOptions } from "./vector-search.js";

export async function vaultSearch(
  ...args: Parameters<typeof import("./vector-search.js").vectorSearch>
) {
  const { vectorSearch } = await import("./vector-search.js");
  return vectorSearch(...args);
}
