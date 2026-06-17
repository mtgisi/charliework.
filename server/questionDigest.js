import nodemailer from 'nodemailer';
import cron from 'node-cron';
import db from './db.js';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

function getOpenQuestions() {
  return db.prepare(`
    SELECT q.*, t.title AS task_title
    FROM questions q
    LEFT JOIN tasks t ON t.id = q.task_id
    WHERE q.status = 'open'
    ORDER BY q.task_id NULLS LAST, q.created_at ASC
  `).all();
}

function getOpenMemberQuestions() {
  return db.prepare(`
    SELECT mq.*, t.title AS task_title, m.label AS member_label
    FROM member_questions mq
    LEFT JOIN tasks t ON t.id = mq.task_id
    LEFT JOIN members m ON m.id = mq.member_id
    WHERE mq.status = 'open'
    ORDER BY mq.member_id, mq.asked_at ASC
  `).all();
}

function buildEmail(questions, memberQuestions = []) {
  const withTask = questions.filter(q => q.task_id);
  const standalone = questions.filter(q => !q.task_id);

  const grouped = {};
  for (const q of withTask) {
    const key = q.task_id;
    if (!grouped[key]) grouped[key] = { title: q.task_title || q.task_id, items: [] };
    grouped[key].items.push(q);
  }

  const byMember = {};
  for (const mq of memberQuestions) {
    const key = mq.member_id;
    if (!byMember[key]) byMember[key] = { label: mq.member_label || 'Unknown member', items: [] };
    byMember[key].items.push(mq);
  }

  let html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">`;
  html += `<h2 style="margin-bottom:4px">Charliework — Open Questions</h2>`;
  html += `<p style="color:#666;margin-top:0">${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>`;

  if (Object.keys(grouped).length > 0) {
    html += `<h3 style="border-bottom:1px solid #ddd;padding-bottom:4px">Linked to Tasks</h3>`;
    for (const { title, items } of Object.values(grouped)) {
      html += `<p style="font-weight:600;margin-bottom:4px">${escHtml(title)}</p><ul style="margin-top:0">`;
      for (const q of items) {
        html += `<li style="margin-bottom:4px">${escHtml(q.body)}`;
        if (q.context) html += `<br><span style="color:#666;font-size:0.9em">${escHtml(q.context)}</span>`;
        html += `</li>`;
      }
      html += `</ul>`;
    }
  }

  if (standalone.length > 0) {
    html += `<h3 style="border-bottom:1px solid #ddd;padding-bottom:4px">Standalone Questions</h3><ul>`;
    for (const q of standalone) {
      html += `<li style="margin-bottom:4px">${escHtml(q.body)}`;
      if (q.context) html += `<br><span style="color:#666;font-size:0.9em">${escHtml(q.context)}</span>`;
      html += `</li>`;
    }
    html += `</ul>`;
  }

  if (Object.keys(byMember).length > 0) {
    html += `<h3 style="border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:24px">From team members</h3>`;
    for (const { label, items } of Object.values(byMember)) {
      html += `<p style="font-weight:600;margin-bottom:4px">${escHtml(label)}</p><ul style="margin-top:0">`;
      for (const mq of items) {
        html += `<li style="margin-bottom:6px">${escHtml(mq.body)}`;
        if (mq.task_title) html += `<br><span style="color:#888;font-size:0.85em">re: ${escHtml(mq.task_title)}</span>`;
        if (mq.options_json) {
          try {
            const opts = JSON.parse(mq.options_json);
            if (Array.isArray(opts) && opts.length) {
              html += `<ul style="margin:4px 0 0 0;padding-left:18px">`;
              opts.forEach((o, i) => {
                const rec = mq.recommended_option === i ? ' <span style="color:#2563eb;font-weight:600">(recommended)</span>' : '';
                html += `<li>${escHtml(o)}${rec}</li>`;
              });
              html += `</ul>`;
            }
          } catch {}
        }
        html += `</li>`;
      }
      html += `</ul>`;
    }
  }

  const siteUrl = (process.env.BASE_URL || 'http://localhost:3000') + '/#questions';
  html += `<p style="margin-top:24px"><a href="${siteUrl}" style="color:#4a7cf6">View &amp; respond in Charliework →</a></p>`;
  html += `</div>`;

  let text = `Charliework — Open Questions\n`;
  text += `View & respond: ${siteUrl}\n\n`;
  text += `${new Date().toDateString()}\n\n`;

  if (Object.keys(grouped).length > 0) {
    text += `LINKED TO TASKS\n`;
    for (const { title, items } of Object.values(grouped)) {
      text += `\n[${title}]\n`;
      for (const q of items) {
        text += `  • ${q.body}`;
        if (q.context) text += `\n    (${q.context})`;
        text += `\n`;
      }
    }
  }

  if (standalone.length > 0) {
    text += `\nSTANDALONE\n`;
    for (const q of standalone) {
      text += `  • ${q.body}`;
      if (q.context) text += `\n    (${q.context})`;
      text += `\n`;
    }
  }

  if (Object.keys(byMember).length > 0) {
    text += `\nFROM TEAM MEMBERS\n`;
    for (const { label, items } of Object.values(byMember)) {
      text += `\n[${label}]\n`;
      for (const mq of items) {
        text += `  • ${mq.body}`;
        if (mq.task_title) text += `  (re: ${mq.task_title})`;
        text += `\n`;
        if (mq.options_json) {
          try {
            const opts = JSON.parse(mq.options_json);
            if (Array.isArray(opts) && opts.length) {
              opts.forEach((o, i) => {
                const rec = mq.recommended_option === i ? ' [recommended]' : '';
                text += `      - ${o}${rec}\n`;
              });
            }
          } catch {}
        }
      }
    }
  }

  return { html, text };
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function sendDigest() {
  const questions = getOpenQuestions();
  const memberQuestions = getOpenMemberQuestions();
  const total = questions.length + memberQuestions.length;
  if (total === 0) return { skipped: true, reason: 'no open questions' };

  const { html, text } = buildEmail(questions, memberQuestions);

  const from = process.env.QUESTION_DIGEST_FROM || 'Charliework <charliework@example.com>';
  const to = process.env.QUESTION_DIGEST_TO;
  if (!to) {
    return { skipped: true, reason: 'QUESTION_DIGEST_TO not configured' };
  }
  await transport.sendMail({
    from,
    to,
    subject: `Charliework: ${total} open question${total === 1 ? '' : 's'}`,
    text,
    html,
  });

  return { sent: true, count: total, supervisor: questions.length, members: memberQuestions.length };
}

export function startDigestCron() {
  if (process.env.QUESTION_DIGEST_ENABLED !== 'true') return;

  const schedule = process.env.QUESTION_DIGEST_CRON || '0 8 * * 1-5';
  cron.schedule(schedule, () => {
    sendDigest().catch(err => console.error('[digest] send failed:', err));
  }, { timezone: 'America/Chicago' });

  console.log(`[digest] scheduled: ${schedule}`);
}
