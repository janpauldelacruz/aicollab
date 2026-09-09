'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { MOCK_MESSAGES, LIVE_AGENTS } from '@/app/live-chatroom/components/LiveChatroomClient';

interface ExportModalProps {
  onClose: () => void;
  sessionName?: string;
}

type ExportFormat = 'json' | 'markdown' | 'pdf';

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: string; description: string; ext: string }[] = [
  { id: 'json', label: 'JSON', icon: 'CodeBracketIcon', description: 'Structured data with full metadata', ext: '.json' },
  { id: 'markdown', label: 'Markdown', icon: 'DocumentTextIcon', description: 'Readable transcript with formatting', ext: '.md' },
  { id: 'pdf', label: 'PDF', icon: 'DocumentArrowDownIcon', description: 'Print-ready formatted document', ext: '.pdf' },
];

function buildJsonExport(sessionName: string) {
  const messages = MOCK_MESSAGES || [];
  return {
    session: {
      name: sessionName,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      agents: LIVE_AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role, model: a.model })),
    },
    transcript: messages.map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      agent: { id: m.agentId, name: m.agentName, role: m.agentRole, color: m.agentColor },
      type: m.type,
      content: m.content,
      ...(m.codeLanguage ? { codeLanguage: m.codeLanguage } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    })),
  };
}

function buildMarkdownExport(sessionName: string) {
  const messages = MOCK_MESSAGES || [];
  const agentList = LIVE_AGENTS.map((a) => `- **${a.name}** (${a.role}) — \`${a.model}\``).join('\n');
  const lines: string[] = [
    `# Session Transcript: ${sessionName}`,
    '',
    `**Exported:** ${new Date().toLocaleString()}  `,
    `**Messages:** ${messages.length}  `,
    `**Agents:** ${LIVE_AGENTS.length}`,
    '',
    '## Agent Roster',
    '',
    agentList,
    '',
    '---',
    '',
    '## Conversation Transcript',
    '',
  ];

  messages.forEach((m) => {
    lines.push(`### [${m.timestamp}] ${m.agentName} *(${m.agentRole})*`);
    if (m.type === 'decision') lines.push('> 🟢 **Decision**');
    if (m.type === 'code') {
      lines.push(`\`\`\`${m.codeLanguage || ''}`);
      lines.push(m.content);
      lines.push('```');
    } else {
      lines.push('');
      lines.push(m.content);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildPdfHtml(sessionName: string): string {
  const messages = MOCK_MESSAGES || [];
  const agentRows = LIVE_AGENTS.map(
    (a) => `<tr><td>${a.name}</td><td>${a.role}</td><td>${a.model}</td></tr>`
  ).join('');

  const msgRows = messages
    .map(
      (m) => `
    <div class="msg">
      <div class="msg-header">
        <span class="agent-name">${m.agentName}</span>
        <span class="agent-role">${m.agentRole}</span>
        ${m.type === 'decision' ? '<span class="badge decision">Decision</span>' : ''}
        ${m.type === 'code' ? '<span class="badge code">Code</span>' : ''}
        <span class="ts">${m.timestamp}</span>
      </div>
      <div class="msg-body">${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${sessionName} — Session Transcript</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a2e; margin: 40px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f0f0f8; text-align: left; padding: 6px 10px; font-size: 11px; }
  td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  .msg { border-left: 3px solid #6366f1; padding: 8px 12px; margin-bottom: 10px; background: #fafafa; }
  .msg-header { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
  .agent-name { font-weight: 700; font-size: 12px; }
  .agent-role { color: #888; font-size: 10px; }
  .ts { margin-left: auto; color: #aaa; font-size: 10px; font-family: monospace; }
  .badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .badge.decision { background: #d1fae5; color: #065f46; }
  .badge.code { background: #ede9fe; color: #4c1d95; }
  .msg-body { font-size: 11px; line-height: 1.6; white-space: pre-wrap; }
  h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
</style>
</head>
<body>
<h1>${sessionName}</h1>
<div class="meta">Exported: ${new Date().toLocaleString()} &nbsp;|&nbsp; ${messages.length} messages &nbsp;|&nbsp; ${LIVE_AGENTS.length} agents</div>
<h2>Agent Roster</h2>
<table><thead><tr><th>Name</th><th>Role</th><th>Model</th></tr></thead><tbody>${agentRows}</tbody></table>
<h2>Conversation Transcript</h2>
${msgRows}
</body>
</html>`;
}

export default function ExportModal({ onClose, sessionName = 'SaaS MVP Architecture' }: ExportModalProps) {
  const [selected, setSelected] = useState<ExportFormat>('markdown');
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    const slug = sessionName.toLowerCase().replace(/\s+/g, '-');

    setTimeout(() => {
      try {
        if (selected === 'json') {
          const data = buildJsonExport(sessionName);
          downloadBlob(JSON.stringify(data, null, 2), `${slug}-transcript.json`, 'application/json');
        } else if (selected === 'markdown') {
          const md = buildMarkdownExport(sessionName);
          downloadBlob(md, `${slug}-transcript.md`, 'text/markdown');
        } else if (selected === 'pdf') {
          const html = buildPdfHtml(sessionName);
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => {
              win.print();
            }, 500);
          }
        }
        onClose();
      } catch {
        // silently handle
      } finally {
        setExporting(false);
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Export Transcript</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Download the full conversation with agent contributions</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 -mt-1 -mr-1">
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>

        {/* Format selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Choose format</p>
          <div className="space-y-2">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelected(fmt.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-150 text-left ${
                  selected === fmt.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                <Icon name={fmt.icon as any} size={18} className={selected === fmt.id ? 'text-primary' : ''} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{fmt.label}</span>
                    <span className="text-xs font-mono text-muted-foreground">{fmt.ext}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt.description}</p>
                </div>
                {selected === fmt.id && (
                  <Icon name="CheckCircleIcon" size={16} className="text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="bg-muted/40 rounded-lg px-4 py-3 flex items-start gap-2.5">
          <Icon name="InformationCircleIcon" size={15} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {selected === 'pdf' ?'PDF export opens a print dialog — use "Save as PDF" in your browser\'s print settings.'
              : `Includes all ${(MOCK_MESSAGES || []).length} messages, agent metadata, timestamps, and message types.`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary flex-1 text-sm gap-2"
          >
            {exporting ? (
              <>
                <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Icon name="ArrowDownTrayIcon" size={14} />
                Export {FORMAT_OPTIONS.find((f) => f.id === selected)?.label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
