import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createWebServer(client) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (!process.env.SESSION_SECRET) {
    console.warn('[WEB] SESSION_SECRET not set - using fallback (set this in production!)');
  }

  app.use(session({
    secret: process.env.SESSION_SECRET || 'editors-club-fallback-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: 'auto',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      httpOnly: true
    }
  }));

  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.use((req, res, next) => {
    req.discordClient = client;
    next();
  });

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);

  app.get('/dashboard{/*path}', (req, res) => {
    if (!req.session?.user) {
      return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });

  app.get('/', (req, res) => {
    if (req.session?.user) {
      return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}
