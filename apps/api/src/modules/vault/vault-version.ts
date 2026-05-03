import mongoose from "mongoose";
import { logger } from "../../lib/logger.js";
import { VaultDocumentModel } from "./vault-document.model.js";

export interface VersionResult {
  version: number;
  supersededId?: string;
}

export async function resolveVersion(
  workspaceId: string,
  filename: string
): Promise<VersionResult> {
  const previous = await VaultDocumentModel.findOne({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    filename,
    status: { $ne: "failed" },
  })
    .sort({ version: -1 })
    .lean();

  if (!previous) {
    return { version: 1 };
  }

  const newVersion = (previous.version || 1) + 1;

  await VaultDocumentModel.updateMany(
    {
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      filename,
      status: { $ne: "failed" },
    },
    { $set: { status: "indexed" as const } }
  );

  logger.info(
    `Vault versioning: ${filename} v${newVersion} supersedes v${previous.version} (${previous._id})`
  );

  return {
    version: newVersion,
    supersededId: previous._id.toString(),
  };
}
