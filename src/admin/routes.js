import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadData, saveData } from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

router.post('/login', express.json(), (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, error: 'Admin password not configured' });
  }
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

router.get('/tickets', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'tickets.html'));
});

router.get('/panels', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'panels.html'));
});

router.get('/settings', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'settings.html'));
});

router.get('/stats', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'stats.html'));
});

router.get('/api/tickets', requireAuth, (req, res) => {
  const tickets = loadData('tickets', {});
  const allTickets = [];
  for (const guildId in tickets) {
    for (const channelId in tickets[guildId]) {
      allTickets.push({ guildId, channelId, ...tickets[guildId][channelId] });
    }
  }
  res.json(allTickets);
});

router.get('/api/tickets/:guildId/:channelId', requireAuth, (req, res) => {
  const { guildId, channelId } = req.params;
  const tickets = loadData('tickets', {});
  const ticket = tickets[guildId]?.[channelId];
  if (ticket) {
    res.json({ guildId, channelId, ...ticket });
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

router.delete('/api/tickets/:guildId/:channelId', requireAuth, (req, res) => {
  const { guildId, channelId } = req.params;
  const tickets = loadData('tickets', {});
  if (tickets[guildId]?.[channelId]) {
    delete tickets[guildId][channelId];
    saveData('tickets', tickets);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

router.put('/api/tickets/:guildId/:channelId/close', requireAuth, (req, res) => {
  const { guildId, channelId } = req.params;
  const tickets = loadData('tickets', {});
  if (tickets[guildId]?.[channelId]) {
    tickets[guildId][channelId].status = 'closed';
    tickets[guildId][channelId].closedAt = Date.now();
    saveData('tickets', tickets);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

router.get('/api/config/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  res.json(configs[guildId] || {});
});

router.put('/api/config/:guildId', requireAuth, express.json(), (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  configs[guildId] = { ...configs[guildId], ...req.body };
  saveData('ticketConfig', configs);
  res.json({ success: true });
});

router.get('/api/stats/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const stats = loadData('ticketStats', {});
  res.json(stats[guildId] || { totalTickets: 0, staffStats: {} });
});

router.get('/api/guilds', requireAuth, (req, res) => {
  const configs = loadData('ticketConfig', {});
  const guilds = Object.keys(configs).map(id => ({ id, ...configs[id] }));
  res.json(guilds);
});

router.get('/api/plans/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  const config = configs[guildId] || {};
  res.json(config.subscriptionPlans || []);
});

router.put('/api/plans/:guildId', requireAuth, express.json(), (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  if (!configs[guildId]) configs[guildId] = {};
  configs[guildId].subscriptionPlans = req.body.plans;
  saveData('ticketConfig', configs);
  res.json({ success: true });
});

router.get('/api/payments/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  const config = configs[guildId] || {};
  res.json(config.paymentMethods || {});
});

router.put('/api/payments/:guildId', requireAuth, express.json(), (req, res) => {
  const { guildId } = req.params;
  const configs = loadData('ticketConfig', {});
  if (!configs[guildId]) configs[guildId] = {};
  configs[guildId].paymentMethods = req.body.methods;
  saveData('ticketConfig', configs);
  res.json({ success: true });
});

export default router;
