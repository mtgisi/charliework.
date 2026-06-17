// User identity is driven by env vars so this code can ship without PII.
// Set USERS_JSON to a JSON object keyed by handle, each with { label, emails: [] }.
// Example:
//   USERS_JSON={"user_a":{"label":"Alice","emails":["alice@example.com"]},"user_b":{"label":"Bob","emails":["bob@example.com"]}}
// Or, for a simple two-person setup, set USER_A_LABEL / USER_A_EMAILS and USER_B_LABEL / USER_B_EMAILS.

function parseUsers() {
  if (process.env.USERS_JSON) {
    try {
      const parsed = JSON.parse(process.env.USERS_JSON);
      const out = {};
      for (const [handle, v] of Object.entries(parsed)) {
        out[handle] = {
          handle,
          label: v.label || handle,
          emails: (v.emails || []).map(e => e.toLowerCase()),
        };
      }
      return out;
    } catch (e) {
      console.error('[users] failed to parse USERS_JSON:', e.message);
    }
  }
  const out = {};
  const splitEmails = s => (s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (process.env.USER_A_EMAILS) {
    out.user_a = { handle: 'user_a', label: process.env.USER_A_LABEL || 'User A', emails: splitEmails(process.env.USER_A_EMAILS) };
  }
  if (process.env.USER_B_EMAILS) {
    out.user_b = { handle: 'user_b', label: process.env.USER_B_LABEL || 'User B', emails: splitEmails(process.env.USER_B_EMAILS) };
  }
  return out;
}

export const USERS = parseUsers();

export const ASSIGNEE_OPTIONS = [
  ...Object.values(USERS).map(u => ({ value: u.handle, label: u.label })),
  { value: 'together', label: 'Together' },
];

export const ASSIGNEE_HANDLES = ASSIGNEE_OPTIONS.map(a => a.value);
export const DEFAULT_ASSIGNEE = ASSIGNEE_HANDLES[0] || 'together';

export const ALLOWED_EMAILS = Object.values(USERS).flatMap(u => u.emails);

export function emailToHandle(email) {
  const e = (email || '').toLowerCase();
  for (const u of Object.values(USERS)) if (u.emails.includes(e)) return u.handle;
  return null;
}

export function isAllowedEmail(email) {
  return !!emailToHandle(email);
}
