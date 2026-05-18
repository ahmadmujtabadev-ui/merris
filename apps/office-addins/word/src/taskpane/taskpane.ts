// @ts-nocheck
// Word add-in taskpane — Merris ESG Agent
// Entry point: Office.onReady → engagement selection → main app

import { ensureAuthenticated } from '../../../shared/auth';
import {
  api,
  listRecentExecutions,
  agentChat,
  judgeFullDocument,
  verifyDocument,
} from '../../../shared/api-client';
import { readFullDocument, insertAfterIndex, getCursorParagraphIndex, insertCommentOn } from './document-ops';

declare const Office: any;
declare const Word: any;

// ── State ──────────────────────────────────────────────────────

let engagementId = localStorage.getItem('merris_engagement_id') ?? '';
let engagementName = '';
let selectedRunContent = '';
let selectedRunName = '';

// ── Boot ───────────────────────────────────────────────────────

Office.onReady(async (info: { host: string }) => {
  if (info.host !== 'Word' && info.host !== 'Document') return;

  try { await ensureAuthenticated(); } catch { /* dev mode */ }

  await loadEngagementSelector();
});

// ── Engagement selector screen ─────────────────────────────────

async function loadEngagementSelector() {
  const select = document.getElementById('engagement-select') as HTMLSelectElement;

  try {
    const data = await api.get<{ engagements: Array<{ id: string; name: string }> }>('/engagements');
    const engagements = (data as any).engagements ?? [];
    select.innerHTML = '<option value="">— no engagement —</option>' +
      engagements.map((e: any) => `<option value="${e.id}">${e.name}</option>`).join('');

    // Pre-select if we have one stored
    if (engagementId) {
      select.value = engagementId;
      const match = engagements.find((e: any) => e.id === engagementId);
      if (match) engagementName = match.name;
    }
  } catch {
    select.innerHTML = '<option value="">Could not load engagements</option>';
  }

  document.getElementById('btn-select-engagement')!.addEventListener('click', () => {
    engagementId = select.value;
    engagementName = select.options[select.selectedIndex]?.text ?? '';
    if (engagementId) localStorage.setItem('merris_engagement_id', engagementId);
    launchApp();
  });

  document.getElementById('btn-skip-engagement')!.addEventListener('click', () => {
    launchApp();
  });

  // If we already have a stored engagement, skip straight to app
  if (engagementId) launchApp();
}

// ── Main app ───────────────────────────────────────────────────

function launchApp() {
  document.getElementById('screen-selector')!.style.display = 'none';
  const app = document.getElementById('screen-app')!;
  app.style.display = 'flex';

  // Header badge
  const pill = document.getElementById('header-engagement')!;
  pill.textContent = engagementName || 'No engagement';

  setupTabs();
  setupInsertTab();
  setupChatTab();
  setupReviewTab();
}

// ── Tab switching ──────────────────────────────────────────────

function setupTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.m-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll<HTMLElement>('.m-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      const panelId = 'panel-' + tab.dataset.tab;
      const panel = document.getElementById(panelId);
      if (panel) { panel.classList.add('active'); panel.style.display = ''; }
    });
  });
}

// ── INSERT TAB ────────────────────────────────────────────────

function setupInsertTab() {
  loadRecentRuns();
  document.getElementById('btn-refresh-runs')!.addEventListener('click', loadRecentRuns);
  document.getElementById('btn-close-preview')!.addEventListener('click', closePreview);
  document.getElementById('btn-insert-at-cursor')!.addEventListener('click', () => insertContent('cursor'));
  document.getElementById('btn-insert-at-end')!.addEventListener('click', () => insertContent('end'));
  document.getElementById('btn-insert-as-comment')!.addEventListener('click', () => insertContent('comment'));
}

async function loadRecentRuns() {
  const list = document.getElementById('runs-list')!;
  list.innerHTML = '<div class="m-empty" style="padding:14px 0;">Loading…</div>';

  try {
    const data = await listRecentExecutions();
    const runs = (data.executions ?? []).filter((e: any) => e.status === 'completed' && e.finalAnswer).slice(0, 8);

    if (runs.length === 0) {
      list.innerHTML = '<div class="m-empty" style="padding:14px 0;">No completed runs yet. Run a workflow agent first.</div>';
      return;
    }

    list.innerHTML = runs.map((run: any) => `
      <div class="m-exec-item" data-id="${run.id}" data-name="${escHtml(run.templateId ?? 'Agent run')}" data-content="${escAttr(run.finalAnswer ?? '')}">
        <div class="m-exec-dot" style="background:${run.status === 'completed' ? '#16a34a' : '#d97706'};"></div>
        <div style="flex:1;min-width:0;">
          <div class="m-exec-name">${escHtml(run.templateId ?? 'Agent run')}</div>
          <div class="m-exec-meta">${formatDate(run.completedAt ?? run.startedAt)} · ${wordCount(run.finalAnswer ?? '')} words</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c4cac4" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    `).join('');

    list.querySelectorAll<HTMLElement>('.m-exec-item').forEach(item => {
      item.addEventListener('click', () => {
        selectedRunContent = item.dataset.content ?? '';
        selectedRunName = item.dataset.name ?? 'Agent run';
        showPreview();
      });
    });
  } catch {
    list.innerHTML = '<div class="m-empty" style="padding:14px 0;">Could not load runs. Check connection.</div>';
  }
}

function showPreview() {
  document.getElementById('insert-empty')!.style.display = 'none';
  const preview = document.getElementById('insert-preview')!;
  preview.style.display = 'block';
  document.getElementById('preview-run-name')!.textContent = selectedRunName;
  document.getElementById('preview-content')!.textContent = selectedRunContent.slice(0, 1200) + (selectedRunContent.length > 1200 ? '\n\n[… truncated for preview]' : '');
}

function closePreview() {
  document.getElementById('insert-preview')!.style.display = 'none';
  document.getElementById('insert-empty')!.style.display = '';
  selectedRunContent = '';
}

async function insertContent(mode: 'cursor' | 'end' | 'comment') {
  if (!selectedRunContent) return;

  const btn = document.getElementById(
    mode === 'cursor' ? 'btn-insert-at-cursor' : mode === 'end' ? 'btn-insert-at-end' : 'btn-insert-as-comment'
  ) as HTMLButtonElement;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Inserting…';

  try {
    const content = selectedRunName + '\n\n' + selectedRunContent;
    if (mode === 'comment') {
      const docText = await readFullDocument();
      const firstLine = docText.trim().split('\n')[0] ?? '';
      await insertCommentOn(firstLine, `Merris: ${selectedRunContent.slice(0, 400)}`);
    } else if (mode === 'cursor') {
      const cursorIdx = await getCursorParagraphIndex();
      const idx = cursorIdx >= 0 ? cursorIdx : -1;
      await insertAfterIndex(idx, content);
    } else {
      await insertAfterIndex(-1, content);
    }
    showToast('✓ Inserted into document', true);
    closePreview();
  } catch (err: any) {
    showToast('Insert failed: ' + (err.message ?? 'unknown error'), false);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

// ── CHAT TAB ──────────────────────────────────────────────────

function setupChatTab() {
  const input = document.getElementById('chat-input') as HTMLTextAreaElement;
  const sendBtn = document.getElementById('btn-chat-send') as HTMLButtonElement;

  const send = async () => {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendChatBubble(msg, 'user');

    const thinking = appendChatBubble('…', 'assistant');
    sendBtn.disabled = true;

    try {
      const docText = await readFullDocument();
      const resp = await agentChat({ message: msg, engagementId, documentBody: docText });
      thinking.textContent = resp.reply ?? 'No response.';
    } catch (err: any) {
      thinking.textContent = 'Error: ' + (err.message ?? 'Could not connect.');
      thinking.style.color = '#dc2626';
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
}

function appendChatBubble(text: string, role: 'user' | 'assistant'): HTMLElement {
  const msgs = document.getElementById('chat-messages')!;
  const div = document.createElement('div');
  div.className = `m-chat-bubble ${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

// ── REVIEW TAB ────────────────────────────────────────────────

function setupReviewTab() {
  document.getElementById('btn-quick-review')?.addEventListener('click', () => runReview('quick'));
  document.getElementById('btn-full-review')?.addEventListener('click', () => runReview('thorough'));
  document.getElementById('btn-verify-doc')?.addEventListener('click', () => runVerify());
}

async function runReview(level: 'quick' | 'thorough') {
  const btn = document.getElementById(level === 'quick' ? 'btn-quick-review' : 'btn-full-review') as HTMLButtonElement;
  const findings = document.getElementById('review-findings')!;
  btn.disabled = true;
  btn.textContent = 'Analysing…';
  findings.innerHTML = '<div class="m-empty">Running review…</div>';

  try {
    const docText = await readFullDocument();
    const result = await judgeFullDocument(engagementId, docText, level);
    renderFindings(result);
  } catch (err: any) {
    findings.innerHTML = `<div class="m-empty" style="color:#dc2626;">Review failed: ${escHtml(err.message ?? '')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = level === 'quick' ? 'Quick Check' : 'Full Review';
  }
}

async function runVerify() {
  const btn = document.getElementById('btn-verify-doc') as HTMLButtonElement;
  const findings = document.getElementById('review-findings')!;
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  findings.innerHTML = '<div class="m-empty">Verifying…</div>';

  try {
    const docText = await readFullDocument();
    const result = await verifyDocument(engagementId, docText, []);
    if (result.findings && result.findings.length > 0) {
      findings.innerHTML = result.findings.slice(0, 12).map((f: any) => `
        <div class="m-insight ${f.type === 'compliance_gap' ? 'gap' : 'quality'}" style="margin:8px 10px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);border-left:3px solid ${f.type === 'compliance_gap' ? 'var(--red)' : 'var(--amber)'}">
          <div class="m-insight-title">${escHtml(String(f.description ?? f.message ?? '').slice(0, 80))}</div>
          ${f.recommendation ? `<div class="m-insight-detail">${escHtml(f.recommendation)}</div>` : ''}
        </div>
      `).join('');
    } else {
      findings.innerHTML = '<div class="m-empty" style="color:var(--green);">✓ No critical issues found.</div>';
    }
  } catch (err: any) {
    findings.innerHTML = `<div class="m-empty" style="color:#dc2626;">Verify failed: ${escHtml(err.message ?? '')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify vs Framework';
  }
}

function renderFindings(judgment: any) {
  const findings = document.getElementById('review-findings')!;
  const score = judgment.overallScore ?? 0;
  const issues = [...(judgment.criticalIssues ?? []), ...(judgment.improvements ?? [])];

  findings.innerHTML = `
    <div style="margin:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--primary-light);">
      <div style="font-size:9px;font-family:monospace;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-ter);margin-bottom:4px;">Overall Score</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:24px;font-weight:700;color:var(--primary);">${score}<span style="font-size:12px;opacity:.6;">/100</span></div>
        <div style="flex:1;height:6px;border-radius:3px;background:#e8eae8;overflow:hidden;">
          <div style="height:100%;background:var(--primary);border-radius:3px;width:${score}%;"></div>
        </div>
      </div>
      ${judgment.partnerWouldApprove != null ? `<div style="font-size:10px;color:var(--text-sec);margin-top:4px;">Partner: ${judgment.partnerWouldApprove ? '✓ Would approve' : '✗ Would not approve'}</div>` : ''}
    </div>
    ${issues.slice(0, 10).map((i: any) => `
      <div class="m-insight gap" style="margin:6px 10px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);border-left:3px solid var(--red);">
        <div class="m-insight-title">${escHtml(String(i.issue ?? i.recommendation ?? '').slice(0, 80))}</div>
        ${i.recommendation ? `<div class="m-insight-detail">${escHtml(i.recommendation)}</div>` : ''}
      </div>
    `).join('')}
  `;
}

// ── Helpers ────────────────────────────────────────────────────

function showToast(msg: string, ok: boolean) {
  const existing = document.getElementById('merris-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'merris-toast';
  el.className = 'm-toast';
  el.style.background = ok ? 'var(--green)' : 'var(--red)';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;').slice(0, 4000);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
