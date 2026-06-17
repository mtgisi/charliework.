import { Issuer, generators } from 'openid-client';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import { emailToHandle, isAllowedEmail, USERS } from './users.js';

let oidcClient;

export async function initAuth() {
  const issuer = await Issuer.discover('https://accounts.google.com');
  oidcClient = new issuer.Client({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [`${process.env.BASE_URL}/auth/callback`],
    response_types: ['code'],
  });
}

export function buildAuthUrl() {
  const state = generators.state();
  const nonce = generators.nonce();
  const url = oidcClient.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  });
  return { url, state, nonce };
}

export async function handleCallback(params, state, nonce) {
  const tokenSet = await oidcClient.callback(
    `${process.env.BASE_URL}/auth/callback`,
    params,
    { state, nonce }
  );
  const info = await oidcClient.userinfo(tokenSet.access_token);

  const handle = emailToHandle(info.email);
  if (!handle) {
    const err = new Error('Email not authorized');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const email = info.email.toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    user = { id: uuidv4(), email, name: info.name, avatar: info.picture };
    db.prepare('INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)')
      .run(user.id, user.email, user.name, user.avatar);
  } else {
    db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?')
      .run(info.name, info.picture, user.id);
  }

  return jwt.sign(
    { userId: user.id, email, name: info.name, avatar: info.picture, handle },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (!isAllowedEmail(req.user.email)) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export { USERS };
