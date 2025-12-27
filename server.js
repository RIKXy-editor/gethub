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
    const data = fs.readFileSync('data/admin-config.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

// Save config
function saveConfig(config) {
  try {
    fs.writeFileSync('data/admin-config.json', JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Middleware: Check authentication
function requireAuth(req, res, next) {
  const sessionToken = req.headers['x-session-token'];
  
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Routes

// Login page
app.get('/', (req, res) => {
  if (sessions.size > 0) {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  }
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Bot Admin Login</title>
  <style>
    body { font-family: 'Monaco', monospace; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .login { background: #1a1a1a; border: 3px solid #cc0000; padding: 40px; width: 100%; max-width: 300px; text-align: center; }
    h1 { color: #ff3333; margin-top: 0; text-transform: uppercase; letter-spacing: 2px; }
    input { width: 100%; padding: 10px; background: #0a0a0a; border: 2px solid #333; color: #fff; margin: 15px 0; font-family: 'Monaco', monospace; }
    input:focus { outline: none; border-color: #cc0000; }
    button { width: 100%; padding: 10px; background: #cc0000; color: #fff; border: none; cursor: pointer; font-weight: bold; text-transform: uppercase; font-family: 'Monaco', monospace; }
    button:hover { background: #ff3333; }
    .error { color: #ff3333; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="login">
    <h1>⚙️ BOT ADMIN</h1>
    <form onsubmit="handleLogin(event)">
      <input type="password" id="password" placeholder="Admin Password" required>
      <button type="submit">LOGIN</button>
    </form>
    <div id="error" class="error"></div>
  </div>
  <script>
    async function handleLogin(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('sessionToken', data.token);
          window.location.href = '/admin.html';
        } else {
          document.getElementById('error').textContent = data.error || 'Login failed';
        }
      } catch (error) {
        document.getElementById('error').textContent = 'Error: ' + error.message;
      }
    }
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Login API
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessions.add(token);
    
    // Auto-logout after 24 hours
    setTimeout(() => sessions.delete(token), 24 * 60 * 60 * 1000);
    
    return res.json({ success: true, token });
  }
  
  res.status(401).json({ error: 'Invalid password' });
});

// Get config
app.get('/api/admin/config', requireAuth, (req, res) => {
  const config = loadConfig();
  if (!config) {
    return res.status(500).json({ error: 'Failed to load config' });
  }
  res.json(config);
});

// Update config
app.post('/api/admin/config', requireAuth, (req, res) => {
  const config = req.body;
  
  if (!config || !config.bot || !config.features || !config.commands) {
    return res.status(400).json({ error: 'Invalid config structure' });
  }
  
  if (saveConfig(config)) {
    return res.json({ success: true, message: 'Config saved' });
  }
  
  res.status(500).json({ error: 'Failed to save config' });
});

// Logout
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  sessions.delete(token);
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin Dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`Default password: ${ADMIN_PASSWORD}`);
});
