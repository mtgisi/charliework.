import Database from 'better-sqlite3';

const db = new Database('/app/data/charliework.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    additional_notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
    priority INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    assignee TEXT NOT NULL DEFAULT 'together',
    created_by_email TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    completed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
`);

const cols = db.prepare("PRAGMA table_info(tasks)").all().map(c => c.name);
if (!cols.includes('additional_notes')) db.exec("ALTER TABLE tasks ADD COLUMN additional_notes TEXT DEFAULT ''");
if (!cols.includes('pinned')) db.exec("ALTER TABLE tasks ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
if (!cols.includes('due_date')) db.exec("ALTER TABLE tasks ADD COLUMN due_date TEXT");
if (!cols.includes('category')) db.exec("ALTER TABLE tasks ADD COLUMN category TEXT");
if (!cols.includes('tier')) db.exec("ALTER TABLE tasks ADD COLUMN tier TEXT NOT NULL DEFAULT 'normal'");
if (!cols.includes('awaiting_review')) db.exec("ALTER TABLE tasks ADD COLUMN awaiting_review INTEGER NOT NULL DEFAULT 0");
if (!cols.includes('awaiting_subtask')) db.exec("ALTER TABLE tasks ADD COLUMN awaiting_subtask INTEGER NOT NULL DEFAULT 0");
if (!cols.includes('parent_id')) {
  db.exec("ALTER TABLE tasks ADD COLUMN parent_id TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)");
}
if (!cols.includes('assignee')) {
  db.exec("ALTER TABLE tasks ADD COLUMN assignee TEXT NOT NULL DEFAULT 'together'");
}
if (!cols.includes('assignee_member_id')) {
  db.exec("ALTER TABLE tasks ADD COLUMN assignee_member_id TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_member ON tasks(assignee_member_id)");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    role TEXT DEFAULT '',
    email TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_members_active ON members(active);

  CREATE TABLE IF NOT EXISTS member_questions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    task_id TEXT,
    body TEXT NOT NULL,
    options_json TEXT DEFAULT '',
    recommended_option INTEGER,
    answer TEXT DEFAULT '',
    selected_option INTEGER,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered')),
    asked_at INTEGER DEFAULT (unixepoch()),
    answered_at INTEGER,
    updated_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_mq_status ON member_questions(status);
  CREATE INDEX IF NOT EXISTS idx_mq_member ON member_questions(member_id);
  CREATE INDEX IF NOT EXISTS idx_mq_task ON member_questions(task_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS date_shortcuts (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    date TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Optional seed for date shortcuts.
// To preload your own dates on first run, set DATE_SHORTCUTS_SEED to JSON:
//   DATE_SHORTCUTS_SEED='[{"label":"First day of school","date":"2026-08-14"}]'
const shortcutCount = db.prepare('SELECT COUNT(*) AS n FROM date_shortcuts').get().n;
if (shortcutCount === 0 && process.env.DATE_SHORTCUTS_SEED) {
  try {
    const seed = JSON.parse(process.env.DATE_SHORTCUTS_SEED);
    if (Array.isArray(seed)) {
      const ins = db.prepare('INSERT INTO date_shortcuts (id, label, date, sort_order) VALUES (?, ?, ?, ?)');
      const tx = db.transaction(rows => {
        rows.forEach((row, i) => {
          if (row && row.label && row.date) {
            ins.run(`seed-${i}-${row.date}`, row.label, row.date, i);
          }
        });
      });
      tx(seed);
    }
  } catch (e) {
    console.error('[db] failed to parse DATE_SHORTCUTS_SEED:', e.message);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    context TEXT DEFAULT '',
    task_id TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered')),
    answer TEXT DEFAULT '',
    asked_by TEXT NOT NULL DEFAULT 'unknown',
    answered_by TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    answered_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
  CREATE INDEX IF NOT EXISTS idx_questions_task ON questions(task_id);
`);

export default db;
