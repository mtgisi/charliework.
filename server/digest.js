import db from './db.js';
import { ASSIGNEE_OPTIONS } from './users.js';

function isoDateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const ASSIGNEE_LABEL = Object.fromEntries(ASSIGNEE_OPTIONS.map(a => [a.value, a.label]));

function tasksFor(iso) {
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'open' AND due_date = ?
    ORDER BY pinned DESC, priority ASC
  `).all(iso);
}

function overdueTasks(today) {
  return db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'open' AND due_date IS NOT NULL AND due_date < ?
    ORDER BY due_date ASC, priority ASC
  `).all(today);
}

function formatTask(t) {
  const who = ASSIGNEE_LABEL[t.assignee] || t.assignee;
  const pin = t.pinned ? '📌 ' : '';
  return `• ${pin}${t.title} (${who})`;
}

export function buildDigest() {
  const today = isoDateOffset(0);
  const d1 = isoDateOffset(1);
  const d2 = isoDateOffset(2);
  const d3 = isoDateOffset(3);

  const overdue = overdueTasks(today);
  const todayList = tasksFor(today);
  const d2List = tasksFor(d2);
  const d3List = tasksFor(d3);
  // Also include +1 in the "today" weighting? User said today, +2, +3.
  // Treat +1 as part of "today" section as imminent.
  const d1List = tasksFor(d1);

  const sections = [];

  if (overdue.length) {
    sections.push(
      `⚠️ OVERDUE (${overdue.length})\n` +
      overdue.map(t => `• ${t.title} — was due ${fmtDateLabel(t.due_date)} (${ASSIGNEE_LABEL[t.assignee] || t.assignee})`).join('\n')
    );
  }

  sections.push(
    `📅 DUE TODAY (${fmtDateLabel(today)}) — ${todayList.length}\n` +
    (todayList.length ? todayList.map(formatTask).join('\n') : '• nothing scheduled')
  );

  if (d1List.length) {
    sections.push(
      `↪ TOMORROW (${fmtDateLabel(d1)}) — ${d1List.length}\n` +
      d1List.map(formatTask).join('\n')
    );
  }

  sections.push(
    `⏭ IN 2 DAYS (${fmtDateLabel(d2)}) — ${d2List.length}\n` +
    (d2List.length ? d2List.map(formatTask).join('\n') : '• none')
  );

  sections.push(
    `⏭ IN 3 DAYS (${fmtDateLabel(d3)}) — ${d3List.length}\n` +
    (d3List.length ? d3List.map(formatTask).join('\n') : '• none')
  );

  const total = overdue.length + todayList.length + d1List.length + d2List.length + d3List.length;

  return {
    title: `Charlie Work - ${fmtDateLabel(today)}`,
    body: sections.join('\n\n'),
    total,
    counts: {
      overdue: overdue.length,
      today: todayList.length,
      tomorrow: d1List.length,
      d2: d2List.length,
      d3: d3List.length,
    },
  };
}

export async function sendDigest({ force = false } = {}) {
  const url = process.env.NTFY_URL;
  if (!url) {
    console.log('[digest] NTFY_URL not configured, skipping');
    return { skipped: true, reason: 'NTFY_URL not configured' };
  }
  const topic = process.env.NTFY_TOPIC || 'charliework';
  const token = process.env.NTFY_TOKEN;
  const digest = buildDigest();

  if (!force && digest.total === 0) {
    console.log('[digest] nothing to send');
    return { skipped: true, digest };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const payload = {
    topic,
    title: digest.title,
    message: digest.body,
    tags: digest.counts.overdue ? ['warning', 'clipboard'] : ['clipboard'],
    priority: digest.counts.overdue ? 4 : 3,
    click: process.env.BASE_URL || '',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const ok = res.ok;
  const respText = await res.text().catch(() => '');
  console.log(`[digest] ntfy ${res.status} ${ok ? 'OK' : 'FAIL'} ${respText.slice(0,200)}`);
  return { ok, status: res.status, digest };
}
