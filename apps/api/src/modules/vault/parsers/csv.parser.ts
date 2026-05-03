import { parseXlsx } from "./xlsx.parser.js";

export async function parseCsv(
  buffer: Buffer,
  docId: string,
  workspaceId: string
) {
  return parseXlsx(buffer, docId, workspaceId, "csv");
}
