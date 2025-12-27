import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Admin password from env
const ADMIN_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';

// Simple session tracking
const sessions = new Set();

// Load config
function loadConfig() {
  try {
    const data = fs.readFileSync('data/feature-config.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

// Save config
function saveConfig(config) {
  try {
    fs.writeFileSync('data/feature-config.json', JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Middleware: Check authentication
function requireAuth(req, res, next) {
  const sessionToken = req.headers['x-session-token'] || req.query.token;
  
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Routes
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15);
    sessions.add(token);
    
    // Auto-logout after 24 hours
    setTimeout(() => sessions.delete(token), 24 * 60 * 60 * 1000);
    
    return res.json({ success: true, token });
  }
  
  res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/config', requireAuth, (req, res) => {
  const config = loadConfig();
  if (!config) {
    return res.status(500).json({ error: 'Failed to load config' });
  }
  res.json(config);
});

app.post('/api/config', requireAuth, (req, res) => {
  const { features } = req.body;
  
  if (!features) {
    return res.status(400).json({ error: 'Missing features object' });
  }
  
  const config = loadConfig();
  if (!config) {
    return res.status(500).json({ error: 'Failed to load config' });
  }
  
  config.features = features;
  
  if (saveConfig(config)) {
    return res.json({ success: true, message: 'Config updated successfully' });
  }
  
  res.status(500).json({ error: 'Failed to save config' });
});

app.post('/api/logout', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  sessions.delete(sessionToken);
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard server running on http://0.0.0.0:${PORT}`);
});
