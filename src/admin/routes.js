import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChannelType } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';
import pg from 'pg';

const { Pool } = pg;
let dbPool = null;

function getDbPool() {
  if (!dbPool && process.env.DATABASE_URL) {
    const isInternalRailway = process.env.DATABASE_URL.includes('.railway.internal');
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isInternalRailway ? false : { rejectUnauthorized: false }
    });
  }
  return dbPool;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/admin/login');
}

export function createAdminRoutes(discordClient) {
  const router = express.Router();

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

  router.get('/embed-builder', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'embed-builder.html'));
  });

  router.get('/welcome', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'welcome.html'));
  });

  router.get('/keywords', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'keywords.html'));
  });

  router.get('/giveaways', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'giveaways.html'));
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

  router.get('/api/discord/guilds', requireAuth, async (req, res) => {
    try {
      const guilds = discordClient.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 64 })
      }));
      res.json(guilds);
    } catch (error) {
      console.error('Error fetching guilds:', error);
      res.status(500).json({ error: 'Failed to fetch guilds' });
    }
  });

  router.get('/api/discord/guilds/:guildId/channels', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      const textChannels = guild.channels.cache
        .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          parent: ch.parent?.name || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json(textChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  router.post('/api/discord/send-embed', requireAuth, express.json(), async (req, res) => {
    try {
      const { channelId, embed } = req.body;
      
      if (!channelId || !embed) {
        return res.status(400).json({ error: 'Channel ID and embed are required' });
      }

      if (embed.title && embed.title.length > 256) {
        return res.status(400).json({ error: 'Title must be 256 characters or less' });
      }
      if (embed.description && embed.description.length > 4096) {
        return res.status(400).json({ error: 'Description must be 4096 characters or less' });
      }
      if (embed.fields && embed.fields.length > 25) {
        return res.status(400).json({ error: 'Maximum 25 fields allowed' });
      }

      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      const discordEmbed = {};
      if (embed.title) discordEmbed.title = embed.title;
      if (embed.description) discordEmbed.description = embed.description;
      if (embed.color) discordEmbed.color = parseInt(embed.color.replace('#', ''), 16);
      if (embed.url) discordEmbed.url = embed.url;
      if (embed.thumbnail) discordEmbed.thumbnail = { url: embed.thumbnail };
      if (embed.image) discordEmbed.image = { url: embed.image };
      if (embed.footer) {
        discordEmbed.footer = { text: embed.footer };
        if (embed.footerIcon) discordEmbed.footer.icon_url = embed.footerIcon;
      }
      if (embed.author) {
        discordEmbed.author = { name: embed.author };
        if (embed.authorIcon) discordEmbed.author.icon_url = embed.authorIcon;
        if (embed.authorUrl) discordEmbed.author.url = embed.authorUrl;
      }
      if (embed.fields && embed.fields.length > 0) {
        discordEmbed.fields = embed.fields.filter(f => f.name && f.value).map(f => ({
          name: f.name.substring(0, 256),
          value: f.value.substring(0, 1024),
          inline: f.inline || false
        }));
      }
      if (embed.timestamp) discordEmbed.timestamp = new Date().toISOString();

      await channel.send({ embeds: [discordEmbed] });
      res.json({ success: true, message: 'Embed sent successfully' });
    } catch (error) {
      console.error('Error sending embed:', error);
      res.status(500).json({ error: error.message || 'Failed to send embed' });
    }
  });

  router.get('/api/embed-templates', requireAuth, (req, res) => {
    const templates = loadData('embedTemplates', []);
    res.json(templates);
  });

  router.post('/api/embed-templates', requireAuth, express.json(), (req, res) => {
    const templates = loadData('embedTemplates', []);
    const newTemplate = {
      id: Date.now().toString(),
      name: req.body.name,
      embed: req.body.embed,
      createdAt: Date.now()
    };
    templates.push(newTemplate);
    saveData('embedTemplates', templates);
    res.json({ success: true, template: newTemplate });
  });

  router.delete('/api/embed-templates/:id', requireAuth, (req, res) => {
    let templates = loadData('embedTemplates', []);
    templates = templates.filter(t => t.id !== req.params.id);
    saveData('embedTemplates', templates);
    res.json({ success: true });
  });

  router.get('/api/welcome/:guildId', requireAuth, async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      const result = await db.query('SELECT * FROM welcome_config WHERE guild_id = $1', [req.params.guildId]);
      if (result.rows[0]) {
        const row = result.rows[0];
        res.json({
          enabled: row.enabled,
          channelId: row.channel_id,
          title: row.title,
          description: row.description,
          footer: row.footer,
          color: row.color,
          thumbnailMode: row.thumbnail_mode,
          imageUrl: row.image_url,
          pingUser: row.ping_user,
          dmWelcome: row.dm_welcome,
          autoRoleId: row.auto_role_id
        });
      } else {
        res.json({
          enabled: false,
          channelId: null,
          title: 'Welcome to {server}!',
          description: 'Hey {user}, welcome to **{server}**!\nYou are our **{memberCount}** member.',
          footer: 'Member #{memberCount}',
          color: '#9b59b6',
          thumbnailMode: 'user',
          imageUrl: null,
          pingUser: true,
          dmWelcome: false,
          autoRoleId: null
        });
      }
    } catch (err) {
      console.error('Error fetching welcome config:', err);
      res.status(500).json({ error: 'Failed to fetch config' });
    }
  });

  router.put('/api/welcome/:guildId', requireAuth, express.json(), async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      const { guildId } = req.params;
      const config = req.body;
      await db.query(`
        INSERT INTO welcome_config (guild_id, enabled, channel_id, title, description, footer, color, thumbnail_mode, image_url, ping_user, dm_welcome, auto_role_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (guild_id) DO UPDATE SET
          enabled = $2, channel_id = $3, title = $4, description = $5, footer = $6,
          color = $7, thumbnail_mode = $8, image_url = $9, ping_user = $10, dm_welcome = $11, auto_role_id = $12
      `, [guildId, config.enabled, config.channelId, config.title, config.description, config.footer, config.color, config.thumbnailMode, config.imageUrl, config.pingUser, config.dmWelcome, config.autoRoleId]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error saving welcome config:', err);
      res.status(500).json({ error: 'Failed to save config' });
    }
  });

  router.get('/api/keywords/:guildId', requireAuth, async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      const settingsRes = await db.query('SELECT enabled FROM keyword_settings WHERE guild_id = $1', [req.params.guildId]);
      const keywordsRes = await db.query('SELECT id, keyword FROM keywords WHERE guild_id = $1', [req.params.guildId]);
      res.json({
        enabled: settingsRes.rows[0]?.enabled || false,
        keywords: keywordsRes.rows
      });
    } catch (err) {
      console.error('Error fetching keywords:', err);
      res.status(500).json({ error: 'Failed to fetch keywords' });
    }
  });

  router.put('/api/keywords/:guildId/toggle', requireAuth, express.json(), async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      await db.query('INSERT INTO keyword_settings (guild_id, enabled) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET enabled = $2', [req.params.guildId, req.body.enabled]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error toggling keywords:', err);
      res.status(500).json({ error: 'Failed to toggle' });
    }
  });

  router.post('/api/keywords/:guildId', requireAuth, express.json(), async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      await db.query('INSERT INTO keyword_settings (guild_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.params.guildId]);
      await db.query('INSERT INTO keywords (guild_id, keyword) VALUES ($1, $2)', [req.params.guildId, req.body.keyword.toLowerCase()]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error adding keyword:', err);
      res.status(500).json({ error: 'Failed to add keyword' });
    }
  });

  router.delete('/api/keywords/:guildId/:keywordId', requireAuth, async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      await db.query('DELETE FROM keywords WHERE guild_id = $1 AND id = $2', [req.params.guildId, req.params.keywordId]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting keyword:', err);
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  });

  router.get('/api/giveaways/:guildId', requireAuth, (req, res) => {
    const giveaways = loadData('giveaways', {});
    const guildGiveaways = giveaways[req.params.guildId] || {};
    const list = Object.values(guildGiveaways).map(g => ({
      ...g,
      isEnded: g.ended || Date.now() > g.endTime
    }));
    res.json(list);
  });

  router.post('/api/giveaways/:guildId/end/:messageId', requireAuth, async (req, res) => {
    try {
      const { guildId, messageId } = req.params;
      const giveaways = loadData('giveaways', {});
      const giveaway = giveaways[guildId]?.[messageId];
      if (!giveaway) {
        return res.status(404).json({ error: 'Giveaway not found' });
      }
      giveaways[guildId][messageId].ended = true;
      saveData('giveaways', giveaways);
      res.json({ success: true, message: 'Giveaway marked as ended' });
    } catch (err) {
      console.error('Error ending giveaway:', err);
      res.status(500).json({ error: 'Failed to end giveaway' });
    }
  });

  router.delete('/api/giveaways/:guildId/:messageId', requireAuth, (req, res) => {
    const { guildId, messageId } = req.params;
    const giveaways = loadData('giveaways', {});
    if (giveaways[guildId]?.[messageId]) {
      delete giveaways[guildId][messageId];
      saveData('giveaways', giveaways);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Giveaway not found' });
    }
  });

  return router;
}

export default createAdminRoutes;
