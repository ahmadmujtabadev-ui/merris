/**
 * Merris Outlook Add-in Taskpane
 *
 * Compose mode: Generate structured data request emails from gap register.
 * Read mode: Detect attachments and offer to ingest them.
 */

import { api } from "../../../shared/api-client";
import { ensureAuthenticated } from "../../../shared/auth";
import { AgentPanel } from "../../../shared/agent-panel";

// ----- Types -----

interface GapItem {
  id: string;
  metric_name: string;
  framework: string;
  disclosure_id: string;
  required_format: string;
  responsible_party: string;
  status: string;
}

interface Engagement {
  id: string;
  name: string;
  client_name: string;
}

// ----- State -----

let engagements: Engagement[] = [];
let gapItems: GapItem[] = [];
let currentMode: "compose" | "read" = "compose";

// ----- Initialization -----

Office.onReady(async (info) => {
  if (info.host !== Office.HostType.Outlook) return;

  await ensureAuthenticated();

  // Determine compose vs read mode
  const item = Office.context.mailbox.item;
  if (item) {
    currentMode = (item as any).itemType === Office.MailboxEnums.ItemType.Message
      && (item as any).getComposeTypeAsync
      ? "compose"
      : "read";
  }

  // Detect mode from item type
  if ((item as any).body?.setAsync) {
    currentMode = "compose";
  } else {
    currentMode = "read";
  }

  await loadEngagements();

  if (currentMode === "compose") {
    showComposePanel();
  } else {
    showReadPanel();
  }

  // Initialize agent panel
  const agentContainer = document.getElementById("agent-container")!;
  new AgentPanel({
    parentElement: agentContainer,
    context: { addin: "outlook", mode: currentMode },
  });
});

// ----- Data Loading -----

async function loadEngagements(): Promise<void> {
  try {
    const result = await api.get<{ engagements: Engagement[] }>("/engagements");
    engagements = result.engagements;

    const selects = document.querySelectorAll<HTMLSelectElement>(
      "#engagement-select, #ingest-engagement"
    );
    selects.forEach((sel) => {
      engagements.forEach((eng) => {
        const opt = document.createElement("option");
        opt.value = eng.id;
        opt.textContent = `${eng.client_name} - ${eng.name}`;
        sel.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("Failed to load engagements:", err);
  }
}

async function loadGapRegister(engagementId: string): Promise<void> {
  try {
    const result = await api.get<{ gaps: GapItem[] }>(
      `/engagements/${engagementId}/gaps`
    );
    gapItems = result.gaps.filter((g) => g.status !== "complete");
    renderGapSummary();
  } catch (err) {
    console.error("Failed to load gap register:", err);
  }
}

// ----- Compose Mode -----

function showComposePanel(): void {
  document.getElementById("compose-panel")!.style.display = "block";
  document.getElementById("read-panel")!.style.display = "none";

  const engSelect = document.getElementById("engagement-select") as HTMLSelectElement;
  const generateBtn = document.getElementById("generate-btn") as HTMLButtonElement;

  engSelect.addEventListener("change", async () => {
    if (engSelect.value) {
      await loadGapRegister(engSelect.value);
      generateBtn.disabled = false;
    } else {
      generateBtn.disabled = true;
    }
  });

  generateBtn.addEventListener("click", generateDataRequestEmail);
}

function renderGapSummary(): void {
  const summaryEl = document.getElementById("gap-summary")!;
  const countEl = document.getElementById("gap-count")!;
  const groupsEl = document.getElementById("gap-groups")!;

  if (gapItems.length === 0) {
    summaryEl.style.display = "none";
    return;
  }

  summaryEl.style.display = "block";
  countEl.textContent = `${gapItems.length} outstanding data gaps`;

  // Group by responsible party
  const groups: Record<string, GapItem[]> = {};
  for (const gap of gapItems) {
    const party = gap.responsible_party || "Unassigned";
    if (!groups[party]) groups[party] = [];
    groups[party].push(gap);
  }

  groupsEl.innerHTML = "";
  for (const [party, items] of Object.entries(groups)) {
    const div = document.createElement("div");
    div.style.marginTop = "8px";
    div.innerHTML = `
      <strong>${party}</strong>
      <span class="merris-badge merris-badge-warning">${items.length} items</span>
    `;
    groupsEl.appendChild(div);
  }
}

async function generateDataRequestEmail(): Promise<void> {
  const statusEl = document.getElementById("compose-status")!;
  const deadline = (document.getElementById("deadline-input") as HTMLInputElement).value;
  const sharePointLink = (document.getElementById("sharepoint-link") as HTMLInputElement).value;

  statusEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Generating...</div>';

  // Group gaps by responsible party
  const groups: Record<string, GapItem[]> = {};
  for (const gap of gapItems) {
    const party = gap.responsible_party || "Unassigned";
    if (!groups[party]) groups[party] = [];
    groups[party].push(gap);
  }

  // Build structured email body
  let body = `<div style="font-family: Segoe UI, sans-serif; color: #333;">`;
  body += `<p>Dear Colleagues,</p>`;
  body += `<p>We are writing to request outstanding ESG data for the current reporting period. `;
  body += `Please review the items below and submit the required information by the deadline indicated.</p>`;

  if (deadline) {
    body += `<p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>`;
  }

  for (const [party, items] of Object.entries(groups)) {
    body += `<h3 style="color: #1a7a4c; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">`;
    body += `${party} (${items.length} items)</h3>`;
    body += `<table style="width:100%; border-collapse:collapse; margin-bottom:16px;">`;
    body += `<tr style="background:#f5f5f5;">`;
    body += `<th style="text-align:left; padding:6px; border:1px solid #e0e0e0;">Data Item</th>`;
    body += `<th style="text-align:left; padding:6px; border:1px solid #e0e0e0;">Framework</th>`;
    body += `<th style="text-align:left; padding:6px; border:1px solid #e0e0e0;">Required Format</th>`;
    body += `</tr>`;

    for (const item of items) {
      body += `<tr>`;
      body += `<td style="padding:6px; border:1px solid #e0e0e0;">${item.metric_name}</td>`;
      body += `<td style="padding:6px; border:1px solid #e0e0e0;">${item.framework} ${item.disclosure_id}</td>`;
      body += `<td style="padding:6px; border:1px solid #e0e0e0;">${item.required_format}</td>`;
      body += `</tr>`;
    }

    body += `</table>`;
  }

  if (sharePointLink) {
    body += `<p><strong>Upload Location:</strong> <a href="${sharePointLink}">${sharePointLink}</a></p>`;
  }

  body += `<p>Please upload the requested data in the specified formats. `;
  body += `If you have questions, reply to this email or contact the ESG team.</p>`;
  body += `<p>Best regards,<br/>Merris ESG Platform</p>`;
  body += `</div>`;

  // Set the email body via Office.js
  Office.context.mailbox.item!.body.setAsync(
    body,
    { coercionType: Office.CoercionType.Html },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        statusEl.innerHTML = '<div class="merris-badge merris-badge-success">Email body generated</div>';
      } else {
        statusEl.innerHTML = `<div class="merris-error-msg">Failed: ${result.error?.message}</div>`;
      }
    }
  );
}

// ----- Read Mode -----

function showReadPanel(): void {
  document.getElementById("compose-panel")!.style.display = "none";
  document.getElementById("read-panel")!.style.display = "block";

  const item = Office.context.mailbox.item;
  if (!item) return;

  // Check for attachments
  const attachments = (item as any).attachments;
  if (attachments && attachments.length > 0) {
    document.getElementById("attachment-info")!.style.display = "block";
    document.getElementById("no-attachments")!.style.display = "none";

    const listEl = document.getElementById("attachment-list")!;
    for (const att of attachments) {
      const li = document.createElement("li");
      li.textContent = `${att.name} (${att.contentType || "unknown type"})`;
      listEl.appendChild(li);
    }

    const ingestBtn = document.getElementById("ingest-btn")!;
    ingestBtn.addEventListener("click", () => processAttachments(attachments));
  } else {
    document.getElementById("attachment-info")!.style.display = "none";
    document.getElementById("no-attachments")!.style.display = "block";
  }
}

async function processAttachments(attachments: any[]): Promise<void> {
  const statusEl = document.getElementById("ingest-status")!;
  const engSelect = document.getElementById("ingest-engagement") as HTMLSelectElement;

  if (!engSelect.value) {
    statusEl.innerHTML = '<div class="merris-error-msg">Please select an engagement first.</div>';
    return;
  }

  statusEl.innerHTML = '<div class="merris-loading"><span class="merris-spinner"></span> Processing attachments...</div>';

  try {
    for (const att of attachments) {
      // Get attachment content via Office.js
      const content = await new Promise<string>((resolve, reject) => {
        Office.context.mailbox.item!.getAttachmentContentAsync(
          att.id,
          (result: any) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              resolve(result.value.content);
            } else {
              reject(new Error(result.error?.message || "Failed to get attachment"));
            }
          }
        );
      });

      // Submit to ingestion pipeline
      await api.post(`/engagements/${engSelect.value}/ingest`, {
        filename: att.name,
        content_type: att.contentType,
        content_base64: content,
        source: "outlook-attachment",
      });
    }

    statusEl.innerHTML = `<div class="merris-badge merris-badge-success">${attachments.length} attachment(s) submitted for processing</div>`;
  } catch (err: any) {
    statusEl.innerHTML = `<div class="merris-error-msg">Error: ${err.message}</div>`;
  }
}
