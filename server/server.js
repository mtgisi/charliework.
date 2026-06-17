import express from 'express';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { initAuth, buildAuthUrl, handleCallback, requireAuth } from './auth.js';
import { ASSIGNEE_OPTIONS } from './users.js';
import tasksRouter from './routes/tasks.js';
import questionsRouter from './routes/questions.js';
import shortcutsRouter from './routes/shortcuts.js';
import membersRouter from './routes/members.js';
import memberQuestionsRouter from './routes/memberQuestions.js';
import { sendDigest, buildDigest } from './digest.js';
import { sendDigest as sendQuestionDigest, startDigestCron } from './questionDigest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(join(__dirname, 'public')));

await initAuth();

const pending = new Map();

app.get('/auth/login', (req, res) => {
  const { url, state, nonce } = buildAuthUrl();
  pending.set(state, { state, nonce });
  setTimeout(() => pending.delete(state), 5 * 60 * 1000);
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const p = pending.get(req.query.state);
  if (!p) return res.status(400).send('Invalid state');
  pending.delete(req.query.state);
  try {
    const token = await handleCallback(req.query, p.state, p.nonce);
    res.cookie('token', token, {
      httpOnly: true, secure: true, sameSite: 'lax',
      path: process.env.COOKIE_PATH || '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.redirect(process.env.COOKIE_PATH || '/');
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return res.status(403).send(
        '<h2>Not authorized</h2><p>This account is not on the allowlist.</p><p><a href="/auth/login">Try a different account</a></p>'
      );
    }
    console.error('OAuth callback error:', err);
    res.status(500).send('Auth failed');
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token', { path: process.env.COOKIE_PATH || '/' });
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    userId: req.user.userId,
    email: req.user.email,
    name: req.user.name,
    avatar: req.user.avatar,
    handle: req.user.handle,
    assignees: ASSIGNEE_OPTIONS,
  });
});

app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/questions', requireAuth, questionsRouter);
app.use('/api/shortcuts', requireAuth, shortcutsRouter);
app.use('/api/members', requireAuth, membersRouter);
app.use('/api/member-questions', requireAuth, memberQuestionsRouter);

app.get('/api/digest/preview', requireAuth, (req, res) => {
  res.json(buildDigest());
});

app.post('/api/questions/digest/send', requireAuth, async (req, res) => {
  try {
    const out = await sendQuestionDigest();
    res.json(out);
  } catch (e) {
    console.error('question digest send error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/digest/send', requireAuth, async (req, res) => {
  try {
    const out = await sendDigest({ force: true });
    res.json(out);
  } catch (e) {
    console.error('digest send error', e);
    res.status(500).json({ error: e.message });
  }
});

const cronExpr = process.env.DIGEST_CRON || '0 7 * * *';
const tz = process.env.TZ || 'America/Chicago';
if (cron.validate(cronExpr)) {
  cron.schedule(cronExpr, async () => {
    try { await sendDigest(); }
    catch (e) { console.error('[digest] cron error', e); }
  }, { timezone: tz });
  console.log(`[digest] scheduled "${cronExpr}" tz=${tz}`);
} else {
  console.warn(`[digest] invalid cron expression: ${cronExpr}`);
}

startDigestCron();

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('charliework listening on :3000'));
