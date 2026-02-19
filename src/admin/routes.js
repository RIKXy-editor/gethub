import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChannelType, EmbedBuilder } from 'discord.js';
import { 
  loadData, 
  saveData,
  getAppealsConfig,
  setAppealsConfig,
  getAppealsByGuild,
  getAppeal,
  updateAppeal,
  addAppealHistory,
  getAllBans
} from '../utils/storage.js';
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

const ADMIN_TOKEN = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN;

function requireApiAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || req.headers['x-admin-token'];
  
  if (token && token === ADMIN_TOKEN) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized', authenticated: false });
}

export function createAdminRoutes(discordClient) {
  const router = express.Router();

  router.post('/login', express.json(), (req, res) => {
    if (!ADMIN_TOKEN) {
      return res.status(500).json({ success: false, error: 'Admin token not configured' });
    }
    const { password } = req.body;
    if (password === ADMIN_TOKEN) {
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ success: false, error: 'Invalid token' });
    }
  });

  router.get('/check-auth', requireApiAuth, (req, res) => {
    res.json({ authenticated: true });
  });

  router.get('/', (req, res) => {
    res.json({ message: 'API running. Use the Next.js dashboard on port 3000.' });
  });

  router.get('/api/tickets', requireApiAuth, (req, res) => {
    const tickets = loadData('tickets', {});
    const allTickets = [];
    for (const guildId in tickets) {
      for (const channelId in tickets[guildId]) {
        allTickets.push({ guildId, channelId, ...tickets[guildId][channelId] });
      }
    }
    res.json(allTickets);
  });

  router.get('/api/tickets/:guildId/:channelId', requireApiAuth, (req, res) => {
    const { guildId, channelId } = req.params;
    const tickets = loadData('tickets', {});
    const ticket = tickets[guildId]?.[channelId];
    if (ticket) {
      res.json({ guildId, channelId, ...ticket });
    } else {
      res.status(404).json({ error: 'Ticket not found' });
    }
  });

  router.delete('/api/tickets/:guildId/:channelId', requireApiAuth, (req, res) => {
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

  router.put('/api/tickets/:guildId/:channelId/close', requireApiAuth, (req, res) => {
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

  router.get('/api/config/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    res.json(configs[guildId] || {});
  });

  router.put('/api/config/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    configs[guildId] = { ...configs[guildId], ...req.body };
    saveData('ticketConfig', configs);
    res.json({ success: true });
  });

  router.get('/api/stats/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const stats = loadData('ticketStats', {});
    res.json(stats[guildId] || { totalTickets: 0, staffStats: {} });
  });

  router.get('/api/guilds', requireApiAuth, (req, res) => {
    const configs = loadData('ticketConfig', {});
    const guilds = Object.keys(configs).map(id => ({ id, ...configs[id] }));
    res.json(guilds);
  });

  router.get('/api/plans/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    const config = configs[guildId] || {};
    res.json(config.subscriptionPlans || []);
  });

  router.put('/api/plans/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    if (!configs[guildId]) configs[guildId] = {};
    configs[guildId].subscriptionPlans = req.body.plans;
    saveData('ticketConfig', configs);
    res.json({ success: true });
  });

  router.get('/api/payments/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    const config = configs[guildId] || {};
    res.json(config.paymentMethods || {});
  });

  router.put('/api/payments/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    if (!configs[guildId]) configs[guildId] = {};
    configs[guildId].paymentMethods = req.body.methods;
    saveData('ticketConfig', configs);
    res.json({ success: true });
  });

  router.post('/api/panels/:guildId/post', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: 'Channel ID is required' });
      }
      const configs = loadData('ticketConfig', {});
      const config = configs[guildId] || {};
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(config.panelEmbed?.title || '🎫 Support Tickets')
        .setDescription(config.panelEmbed?.description || 'Click the button below to create a support ticket.')
        .setColor(config.panelEmbed?.color ? parseInt(config.panelEmbed.color.replace('#', ''), 16) : 0xdc2626);
      
      if (config.panelEmbed?.image) {
        embed.setImage(config.panelEmbed.image);
      }
      
      const buttonStyle = {
        'Primary': ButtonStyle.Primary,
        'Success': ButtonStyle.Success,
        'Danger': ButtonStyle.Danger,
        'Secondary': ButtonStyle.Secondary
      }[config.buttonColor] || ButtonStyle.Primary;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open')
          .setLabel(config.buttonLabel || 'Open Ticket')
          .setStyle(buttonStyle)
          .setEmoji('🎫')
      );
      await channel.send({ embeds: [embed], components: [row] });
      res.json({ success: true, message: 'Panel posted successfully' });
    } catch (error) {
      console.error('Error posting panel:', error);
      res.status(500).json({ error: error.message || 'Failed to post panel' });
    }
  });

  router.get('/api/discord/guilds', requireApiAuth, async (req, res) => {
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

  router.get('/api/discord/guilds/:guildId/channels', requireApiAuth, async (req, res) => {
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

  router.get('/api/discord/guilds/:guildId/roles', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id && !r.managed)
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position
        }))
        .sort((a, b) => b.position - a.position);
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  router.post('/api/discord/send-embed', requireApiAuth, express.json(), async (req, res) => {
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

  router.get('/api/embed-templates', requireApiAuth, (req, res) => {
    const templates = loadData('embedTemplates', []);
    res.json(templates);
  });

  router.post('/api/embed-templates', requireApiAuth, express.json(), (req, res) => {
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

  router.delete('/api/embed-templates/:id', requireApiAuth, (req, res) => {
    let templates = loadData('embedTemplates', []);
    templates = templates.filter(t => t.id !== req.params.id);
    saveData('embedTemplates', templates);
    res.json({ success: true });
  });

  router.get('/api/welcome/:guildId', requireApiAuth, async (req, res) => {
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

  router.put('/api/welcome/:guildId', requireApiAuth, express.json(), async (req, res) => {
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

  router.get('/api/keywords/:guildId', requireApiAuth, async (req, res) => {
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

  router.put('/api/keywords/:guildId/toggle', requireApiAuth, express.json(), async (req, res) => {
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

  router.post('/api/keywords/:guildId', requireApiAuth, express.json(), async (req, res) => {
    const db = getDbPool();
    if (!db) return res.status(500).json({ error: 'Database not available' });
    try {
      const keyword = req.body.keyword?.toLowerCase().trim();
      if (!keyword || keyword.length < 2) {
        return res.status(400).json({ error: 'Keyword must be at least 2 characters' });
      }
      const existing = await db.query('SELECT id FROM keywords WHERE guild_id = $1 AND keyword = $2', [req.params.guildId, keyword]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Keyword already exists' });
      }
      await db.query('INSERT INTO keyword_settings (guild_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.params.guildId]);
      await db.query('INSERT INTO keywords (guild_id, keyword) VALUES ($1, $2)', [req.params.guildId, keyword]);
      res.json({ success: true });
    } catch (err) {
      console.error('Error adding keyword:', err);
      res.status(500).json({ error: 'Failed to add keyword' });
    }
  });

  router.delete('/api/keywords/:guildId/:keywordId', requireApiAuth, async (req, res) => {
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

  router.get('/api/giveaways/:guildId', requireApiAuth, (req, res) => {
    const giveaways = loadData('giveaways', {});
    const guildGiveaways = giveaways[req.params.guildId] || {};
    const list = Object.values(guildGiveaways).map(g => ({
      ...g,
      isEnded: g.ended || Date.now() > g.endTime
    }));
    res.json(list);
  });

  router.post('/api/giveaways/:guildId/end/:messageId', requireApiAuth, async (req, res) => {
    try {
      const { guildId, messageId } = req.params;
      const giveaways = loadData('giveaways', {});
      const giveaway = giveaways[guildId]?.[messageId];
      if (!giveaway) {
        return res.status(404).json({ error: 'Giveaway not found' });
      }
      if (giveaway.ended) {
        return res.status(400).json({ error: 'Giveaway already ended' });
      }
      const { selectWinners } = await import('../utils/giveawayManager.js');
      const { getEntries } = await import('../utils/storage.js');
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        giveaways[guildId][messageId].ended = true;
        saveData('giveaways', giveaways);
        return res.json({ success: true, message: 'Giveaway ended (guild not accessible)', winners: [] });
      }
      const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
      const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
      let entries = getEntries(guildId, messageId);
      const validEntries = [];
      for (const entry of entries) {
        try {
          const member = await guild.members.fetch(entry.userId);
          if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) continue;
          validEntries.push(entry);
        } catch { continue; }
      }
      const winnerIds = selectWinners(validEntries, giveaway.winnerCount || 1, giveaway.multiplierRoles || {});
      if (message && message.embeds[0]) {
        const { EmbedBuilder } = await import('discord.js');
        const newEmbed = EmbedBuilder.from(message.embeds[0]);
        const winnerText = winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join(', ') : 'No valid entries';
        const detailsField = newEmbed.data.fields?.find(f => f.name === '🎯 Giveaway Details');
        if (detailsField) {
          const lines = detailsField.value.split('\n');
          lines[1] = `**Winner(s):** ${winnerText}`;
          detailsField.value = lines.join('\n');
        }
        newEmbed.setFooter({ text: '✅ Giveaway has ended.' });
        await message.edit({ embeds: [newEmbed] });
      }
      for (const winnerId of winnerIds) {
        try {
          const { EmbedBuilder } = await import('discord.js');
          const winner = await discordClient.users.fetch(winnerId);
          await winner.send({
            embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('🎉 You Won!').setDescription(`Congratulations! You've won: **${giveaway.prize}**`).setFooter({ text: 'Thank you for participating!' })]
          });
        } catch { }
      }
      giveaways[guildId][messageId].ended = true;
      giveaways[guildId][messageId].winners = winnerIds;
      saveData('giveaways', giveaways);
      res.json({ success: true, message: 'Giveaway ended', winners: winnerIds });
    } catch (err) {
      console.error('Error ending giveaway:', err);
      res.status(500).json({ error: 'Failed to end giveaway' });
    }
  });

  router.delete('/api/giveaways/:guildId/:messageId', requireApiAuth, (req, res) => {
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

  router.post('/api/giveaways/:guildId/create', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, prize, duration, winnerCount, requiredRoleId, multiplierRoles } = req.body;
      if (!channelId || !prize || !duration) {
        return res.status(400).json({ error: 'Channel, prize, and duration are required' });
      }
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const { addGiveaway } = await import('../utils/storage.js');
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const endTime = Date.now() + duration;
      const embed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(`**${prize}**`)
        .setColor(0x9b59b6)
        .addFields({
          name: '🎯 Giveaway Details',
          value: `**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n**Winner(s):** ${winnerCount || 1}\n**Hosted by:** Bot Admin`
        })
        .setFooter({ text: 'Click the button below to enter!' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setStyle(ButtonStyle.Primary).setEmoji('🎉')
      );
      const message = await channel.send({ embeds: [embed], components: [row] });
      const giveawayData = {
        messageId: message.id,
        channelId,
        prize,
        endTime,
        winnerCount: winnerCount || 1,
        requiredRoleId: requiredRoleId || null,
        multiplierRoles: multiplierRoles || {},
        hostId: 'admin',
        hostTag: 'Admin Dashboard',
        ended: false
      };
      addGiveaway(guildId, giveawayData);
      res.json({ success: true, messageId: message.id });
    } catch (err) {
      console.error('Error creating giveaway:', err);
      res.status(500).json({ error: 'Failed to create giveaway' });
    }
  });

  router.post('/api/announcements/send', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { channelId, message, useEmbed, title, color, mentionEveryone } = req.body;
      if (!channelId || !message) return res.status(400).json({ error: 'Channel and message required' });
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const content = mentionEveryone ? '@everyone' : undefined;
      if (useEmbed) {
        const { EmbedBuilder } = await import('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(title || 'Announcement')
          .setDescription(message)
          .setColor(color ? parseInt(color.replace('#', ''), 16) : 0x9b59b6)
          .setTimestamp();
        await channel.send({ content, embeds: [embed] });
      } else {
        await channel.send({ content: mentionEveryone ? `@everyone\n${message}` : message });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Error sending announcement:', err);
      res.status(500).json({ error: 'Failed to send announcement' });
    }
  });

  router.get('/api/scheduled/:guildId', requireApiAuth, (req, res) => {
    const schedules = loadData('scheduledMessages', {});
    const guildSchedules = schedules[req.params.guildId] || [];
    res.json(guildSchedules);
  });

  router.post('/api/scheduled/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const { channelId, message, time, frequency, dayOfWeek } = req.body;
    if (!channelId || !message || !time) return res.status(400).json({ error: 'Channel, message, and time required' });
    const schedules = loadData('scheduledMessages', {});
    if (!schedules[guildId]) schedules[guildId] = [];
    const newSchedule = {
      id: Date.now().toString(),
      channelId,
      message,
      time,
      frequency: frequency || 'once',
      dayOfWeek: dayOfWeek || null,
      createdAt: Date.now()
    };
    schedules[guildId].push(newSchedule);
    saveData('scheduledMessages', schedules);
    res.json({ success: true, schedule: newSchedule });
  });

  router.delete('/api/scheduled/:guildId/:scheduleId', requireApiAuth, (req, res) => {
    const { guildId, scheduleId } = req.params;
    const schedules = loadData('scheduledMessages', {});
    if (schedules[guildId]) {
      schedules[guildId] = schedules[guildId].filter(s => s.id !== scheduleId);
      saveData('scheduledMessages', schedules);
    }
    res.json({ success: true });
  });

  router.get('/api/sticky/:guildId', requireApiAuth, (req, res) => {
    const stickies = loadData('stickyMessages', {});
    const guildStickies = stickies[req.params.guildId] || {};
    res.json(Object.entries(guildStickies).map(([channelId, data]) => ({ channelId, ...data })));
  });

  router.post('/api/sticky/:guildId', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, content } = req.body;
      if (!channelId || !content) return res.status(400).json({ error: 'Channel and content required' });
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const stickies = loadData('stickyMessages', {});
      if (!stickies[guildId]) stickies[guildId] = {};
      if (stickies[guildId][channelId]?.messageId) {
        try {
          const oldMsg = await channel.messages.fetch(stickies[guildId][channelId].messageId);
          await oldMsg.delete();
        } catch {}
      }
      const msg = await channel.send({ content: `📌 **Sticky Message**\n\n${content}` });
      stickies[guildId][channelId] = { content, messageId: msg.id, channelName: channel.name };
      saveData('stickyMessages', stickies);
      res.json({ success: true });
    } catch (err) {
      console.error('Error creating sticky:', err);
      res.status(500).json({ error: 'Failed to create sticky' });
    }
  });

  router.delete('/api/sticky/:guildId/:channelId', requireApiAuth, async (req, res) => {
    try {
      const { guildId, channelId } = req.params;
      const stickies = loadData('stickyMessages', {});
      if (stickies[guildId]?.[channelId]) {
        try {
          const channel = await discordClient.channels.fetch(channelId);
          const msg = await channel.messages.fetch(stickies[guildId][channelId].messageId);
          await msg.delete();
        } catch {}
        delete stickies[guildId][channelId];
        saveData('stickyMessages', stickies);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete sticky' });
    }
  });

  router.post('/api/dm/send', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId, roleId, message, useEmbed, title, color } = req.body;
      if (!guildId || !roleId || !message) return res.status(400).json({ error: 'Guild, role, and message required' });
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });
      const members = await guild.members.fetch();
      const targetMembers = members.filter(m => m.roles.cache.has(roleId));
      let sent = 0, failed = 0;
      for (const [, member] of targetMembers) {
        try {
          if (useEmbed) {
            const { EmbedBuilder } = await import('discord.js');
            const embed = new EmbedBuilder().setTitle(title || 'Message').setDescription(message).setColor(color ? parseInt(color.replace('#', ''), 16) : 0x9b59b6);
            await member.send({ embeds: [embed] });
          } else {
            await member.send(message);
          }
          sent++;
        } catch { failed++; }
      }
      res.json({ success: true, sent, failed, total: targetMembers.size });
    } catch (err) {
      console.error('Error sending DMs:', err);
      res.status(500).json({ error: 'Failed to send DMs' });
    }
  });

  router.get('/api/job-config/:guildId', requireApiAuth, (req, res) => {
    const configs = loadData('jobConfig', {});
    res.json(configs[req.params.guildId] || { enabled: false, channelId: null, roleId: null, cooldown: 86400000, bannerText: '' });
  });

  router.put('/api/job-config/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('jobConfig', {});
    configs[guildId] = { ...configs[guildId], ...req.body };
    saveData('jobConfig', configs);
    res.json({ success: true });
  });

  router.get('/api/bot-settings', requireApiAuth, (req, res) => {
    const settings = loadData('botSettings', { statusMessages: [], activityType: 'Playing' });
    res.json(settings);
  });

  router.put('/api/bot-settings', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { statusMessages, activityType } = req.body;
      const settings = loadData('botSettings', {});
      if (statusMessages) settings.statusMessages = statusMessages;
      if (activityType) settings.activityType = activityType;
      saveData('botSettings', settings);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // Sticky Clients API endpoints
  router.get('/api/sticky-clients/:guildId', requireApiAuth, (req, res) => {
    const configs = loadData('sticky-clients', {});
    res.json(configs[req.params.guildId] || {
      enabled: false,
      channelId: null,
      stickyMessageId: null,
      cooldownUntil: 0,
      embedTitle: 'Looking for Clients?',
      embedDescription: '**Rules:**\n- No spam\n- No fake portfolio\n- No agencies\n\nClick the button below to share your work!',
      embedColor: '#9b59b6',
      buttonLabel: 'Share your work'
    });
  });

  router.put('/api/sticky-clients/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('sticky-clients', {});
    configs[guildId] = { ...configs[guildId], ...req.body };
    saveData('sticky-clients', configs);
    res.json({ success: true });
  });

  router.post('/api/sticky-clients/:guildId/post', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId } = req.params;
      const configs = loadData('sticky-clients', {});
      const config = configs[guildId] || {};
      
      if (!config.channelId) {
        return res.status(400).json({ error: 'No channel configured' });
      }

      const channel = await discordClient.channels.fetch(config.channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // Delete old sticky message if exists
      if (config.stickyMessageId) {
        try {
          const oldMsg = await channel.messages.fetch(config.stickyMessageId);
          await oldMsg.delete();
        } catch {}
      }

      // Create the sticky embed
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      
      const embed = new EmbedBuilder()
        .setTitle(config.embedTitle || 'Looking for Clients?')
        .setDescription(config.embedDescription || '**Rules:**\n- No spam\n- No fake portfolio\n- No agencies')
        .setColor(config.embedColor ? parseInt(config.embedColor.replace('#', ''), 16) : 0x9b59b6)
        .setFooter({ text: 'Share your portfolio to find clients!' });

      const button = new ButtonBuilder()
        .setCustomId('stickyclients_share')
        .setLabel(config.buttonLabel || 'Share your work')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      const msg = await channel.send({ embeds: [embed], components: [row] });

      // Update config with new message ID and enable
      configs[guildId] = {
        ...config,
        stickyMessageId: msg.id,
        enabled: true
      };
      saveData('sticky-clients', configs);

      res.json({ success: true, messageId: msg.id });
    } catch (err) {
      console.error('Error posting sticky clients:', err);
      res.status(500).json({ error: 'Failed to post sticky message' });
    }
  });

  router.post('/api/sticky-clients/:guildId/disable', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const configs = loadData('sticky-clients', {});
      const config = configs[guildId];

      if (config?.stickyMessageId && config?.channelId) {
        try {
          const channel = await discordClient.channels.fetch(config.channelId);
          const msg = await channel.messages.fetch(config.stickyMessageId);
          await msg.delete();
        } catch {}
      }

      configs[guildId] = { ...config, enabled: false, stickyMessageId: null };
      saveData('sticky-clients', configs);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to disable sticky' });
    }
  });

  router.get('/check-auth', (req, res) => {
    res.json({ authenticated: req.session?.authenticated || false });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
  });

  router.get('/api/stats/:guildId', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const pool = getDbPool();
      
      let stats = {
        total: 0,
        open: 0,
        closed: 0,
        avgRating: 0,
        ticketsPerDay: [],
        topCategories: [],
        staffLeaderboard: []
      };

      if (pool) {
        const totalRes = await pool.query('SELECT COUNT(*) FROM tickets WHERE guild_id = $1', [guildId]);
        stats.total = parseInt(totalRes.rows[0]?.count || 0);

        const openRes = await pool.query("SELECT COUNT(*) FROM tickets WHERE guild_id = $1 AND status = 'open'", [guildId]);
        stats.open = parseInt(openRes.rows[0]?.count || 0);

        stats.closed = stats.total - stats.open;

        const ratingRes = await pool.query('SELECT AVG(rating) FROM ticket_ratings WHERE guild_id = $1', [guildId]);
        stats.avgRating = parseFloat(ratingRes.rows[0]?.avg || 0);

        const perDayRes = await pool.query(`
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM tickets WHERE guild_id = $1 AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY DATE(created_at) ORDER BY date
        `, [guildId]);
        stats.ticketsPerDay = perDayRes.rows.map(r => ({ date: r.date, count: parseInt(r.count) }));

        const staffRes = await pool.query(`
          SELECT claimed_by as userId, COUNT(*) as claimed 
          FROM tickets WHERE guild_id = $1 AND claimed_by IS NOT NULL
          GROUP BY claimed_by ORDER BY claimed DESC LIMIT 10
        `, [guildId]);
        stats.staffLeaderboard = staffRes.rows.map(r => ({
          userId: r.userid,
          username: 'Staff Member',
          claimed: parseInt(r.claimed),
          avgRating: 0
        }));
      }

      res.json(stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      res.json({
        total: 0, open: 0, closed: 0, avgRating: 0,
        ticketsPerDay: [], topCategories: [], staffLeaderboard: []
      });
    }
  });

  router.get('/api/categories/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    res.json(configs[guildId]?.categories || []);
  });

  router.put('/api/categories/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    const configs = loadData('ticketConfig', {});
    if (!configs[guildId]) configs[guildId] = {};
    configs[guildId].categories = req.body.categories;
    saveData('ticketConfig', configs);
    res.json({ success: true });
  });

  router.get('/api/logs/:guildId', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const pool = getDbPool();
      let logs = [];

      if (pool) {
        const result = await pool.query(`
          SELECT id, action, user_id, username, details, created_at as timestamp
          FROM audit_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 100
        `, [guildId]);
        logs = result.rows.map(r => ({
          id: r.id,
          action: r.action,
          userId: r.user_id,
          username: r.username || 'Unknown',
          details: r.details || '',
          timestamp: r.timestamp
        }));
      }

      res.json(logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      res.json([]);
    }
  });

  router.get('/api/staff/:guildId', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const pool = getDbPool();
      let staff = [];

      if (pool) {
        const result = await pool.query(`
          SELECT claimed_by as id, COUNT(*) as tickets_claimed
          FROM tickets WHERE guild_id = $1 AND claimed_by IS NOT NULL
          GROUP BY claimed_by
        `, [guildId]);
        staff = result.rows.map(r => ({
          id: r.id,
          username: 'Staff Member',
          avatar: null,
          ticketsClaimed: parseInt(r.tickets_claimed),
          avgRating: 0,
          blacklisted: false
        }));
      }

      res.json(staff);
    } catch (err) {
      console.error('Error fetching staff:', err);
      res.json([]);
    }
  });

  router.put('/api/staff/:guildId/:staffId', requireApiAuth, express.json(), (req, res) => {
    const { guildId, staffId } = req.params;
    const configs = loadData('staffConfig', {});
    if (!configs[guildId]) configs[guildId] = {};
    if (!configs[guildId][staffId]) configs[guildId][staffId] = {};
    Object.assign(configs[guildId][staffId], req.body);
    saveData('staffConfig', configs);
    res.json({ success: true });
  });

  router.get('/api/discord/guilds/:guildId/roles', requireApiAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color
        }))
        .sort((a, b) => b.position - a.position);
      res.json(roles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  // ========== BAN APPEALS API ==========
  
  router.get('/api/appeals/config/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const config = getAppealsConfig(guildId);
    res.json(config);
  });

  router.put('/api/appeals/config/:guildId', requireApiAuth, express.json(), (req, res) => {
    const { guildId } = req.params;
    setAppealsConfig(guildId, req.body);
    res.json({ success: true });
  });

  router.get('/api/appeals/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const { status, search } = req.query;
    
    let appeals = getAppealsByGuild(guildId);
    
    if (status && status !== 'ALL') {
      appeals = appeals.filter(a => a.status === status);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      appeals = appeals.filter(a => 
        a.userTag?.toLowerCase().includes(searchLower) ||
        a.userId?.includes(search) ||
        a.appealId?.toLowerCase().includes(searchLower) ||
        a.caseId?.toLowerCase().includes(searchLower)
      );
    }
    
    appeals.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json(appeals);
  });

  router.get('/api/appeals/:guildId/:appealId', requireApiAuth, (req, res) => {
    const { appealId } = req.params;
    const appeal = getAppeal(appealId);
    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    res.json(appeal);
  });

  router.post('/api/appeals/:guildId/:appealId/approve', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId, appealId } = req.params;
      
      const appeal = getAppeal(appealId);
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      if (appeal.status !== 'PENDING') {
        return res.status(400).json({ error: 'Appeal already processed' });
      }
      
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      try {
        await guild.members.unban(appeal.userId, 'Appeal approved via dashboard');
      } catch (unbanError) {
        return res.status(400).json({ error: `Failed to unban: ${unbanError.message}` });
      }
      
      updateAppeal(appealId, { status: 'APPROVED' });
      addAppealHistory(appealId, 'approved', 'Appeal approved via dashboard', null);
      
      try {
        const user = await discordClient.users.fetch(appeal.userId);
        const { EmbedBuilder } = await import('discord.js');
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Ban Appeal Approved!')
          .setDescription(`Great news! Your ban appeal for **${guild.name}** has been approved.\n\nYou have been unbanned and can rejoin the server.`)
          .setColor(0x2ecc71)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch {}
      
      const logs = loadData('auditLogs', {});
      if (!logs[guildId]) logs[guildId] = [];
      logs[guildId].unshift({
        action: 'APPEAL_APPROVED_DASHBOARD',
        target: appeal.userTag,
        targetId: appeal.userId,
        appealId,
        caseId: appeal.caseId,
        timestamp: Date.now()
      });
      saveData('auditLogs', logs);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error approving appeal:', err);
      res.status(500).json({ error: 'Failed to approve appeal' });
    }
  });

  router.post('/api/appeals/:guildId/:appealId/deny', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { guildId, appealId } = req.params;
      const { reason } = req.body;
      
      const appeal = getAppeal(appealId);
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      if (appeal.status !== 'PENDING') {
        return res.status(400).json({ error: 'Appeal already processed' });
      }
      
      updateAppeal(appealId, { status: 'DENIED', denyReason: reason || 'No reason provided' });
      addAppealHistory(appealId, 'denied', `Appeal denied via dashboard: ${reason || 'No reason provided'}`, null);
      
      try {
        const user = await discordClient.users.fetch(appeal.userId);
        const guild = discordClient.guilds.cache.get(guildId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('❌ Ban Appeal Denied')
          .setDescription(`Unfortunately, your ban appeal for **${guild?.name || 'the server'}** has been denied.`)
          .addFields({ name: 'Reason', value: reason || 'No reason provided' })
          .setColor(0xe74c3c)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch {}
      
      const logs = loadData('auditLogs', {});
      if (!logs[guildId]) logs[guildId] = [];
      logs[guildId].unshift({
        action: 'APPEAL_DENIED_DASHBOARD',
        target: appeal.userTag,
        targetId: appeal.userId,
        appealId,
        caseId: appeal.caseId,
        reason: reason || 'No reason provided',
        timestamp: Date.now()
      });
      saveData('auditLogs', logs);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Error denying appeal:', err);
      res.status(500).json({ error: 'Failed to deny appeal' });
    }
  });

  router.post('/api/appeals/:guildId/:appealId/message', requireApiAuth, express.json(), async (req, res) => {
    try {
      const { appealId } = req.params;
      const { message } = req.body;
      
      const appeal = getAppeal(appealId);
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      addAppealHistory(appealId, 'message_sent', `Dashboard message: ${message}`, null);
      
      try {
        const user = await discordClient.users.fetch(appeal.userId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('💬 Message from Staff')
          .setDescription(message)
          .addFields({ name: 'Appeal ID', value: appealId })
          .setColor(0x3498db)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
        res.json({ success: true });
      } catch (dmError) {
        res.status(400).json({ error: 'Could not DM user. They may have DMs disabled.' });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  router.get('/api/bans/:guildId', requireApiAuth, (req, res) => {
    const { guildId } = req.params;
    const bans = getAllBans(guildId);
    const bansArray = Object.entries(bans).map(([userId, data]) => ({
      userId,
      ...data
    }));
    res.json(bansArray);
  });

  return router;
}

export default createAdminRoutes;
