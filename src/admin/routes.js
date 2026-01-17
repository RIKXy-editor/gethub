import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChannelType } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';

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

  return router;
}

export default createAdminRoutes;
