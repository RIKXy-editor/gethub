import { Router } from 'express';
import { Guild, Panel, Plan, PaymentMethod, PlanPricing, Ticket, Subscription, Reminder, Log } from '../../db/models.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const apiRouter = Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

apiRouter.use(requireAuth);

const getGuildId = (req) => req.session.user.guildId;

apiRouter.get('/guild', async (req, res) => {
  try {
    const guild = await Guild.get(getGuildId(req));
    res.json(guild || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/guild', async (req, res) => {
  try {
    await Guild.update(getGuildId(req), req.body);
    await Log.create(getGuildId(req), 'guild_settings_updated', req.session.user.id, null, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/channels', async (req, res) => {
  try {
    const guild = req.discordClient.guilds.cache.get(getGuildId(req));
    if (!guild) return res.json([]);
    const channels = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 4)
      .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(channels);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/roles', async (req, res) => {
  try {
    const guild = req.discordClient.guilds.cache.get(getGuildId(req));
    if (!guild) return res.json([]);
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(roles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/panels', async (req, res) => {
  try {
    const panels = await Panel.getAll(getGuildId(req));
    res.json(panels);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/panels', async (req, res) => {
  try {
    const data = { ...req.body, guild_id: getGuildId(req) };
    const panel = await Panel.create(data);
    await Log.create(getGuildId(req), 'panel_created', req.session.user.id, null, { panel_id: panel.id });
    res.json(panel);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/panels/:id', async (req, res) => {
  try {
    await Panel.update(req.params.id, req.body);
    await Log.create(getGuildId(req), 'panel_updated', req.session.user.id, null, { panel_id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/panels/:id', async (req, res) => {
  try {
    await Panel.delete(req.params.id);
    await Log.create(getGuildId(req), 'panel_deleted', req.session.user.id, null, { panel_id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/panels/:id/post', async (req, res) => {
  try {
    const panel = await Panel.getById(req.params.id);
    if (!panel) return res.status(404).json({ error: 'Panel not found' });

    const guild = req.discordClient.guilds.cache.get(getGuildId(req));
    if (!guild) return res.status(500).json({ error: 'Guild not found' });

    const channel = guild.channels.cache.get(panel.channel_id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const embed = new EmbedBuilder()
      .setTitle(panel.title || 'Support Tickets')
      .setDescription(panel.description || 'Click the button below to open a ticket.')
      .setColor(panel.color || '#5865F2');

    if (panel.thumbnail_url) embed.setThumbnail(panel.thumbnail_url);
    if (panel.image_url) embed.setImage(panel.image_url);
    if (panel.footer_text) embed.setFooter({ text: panel.footer_text });

    const btn = new ButtonBuilder()
      .setCustomId(`ticket:open:${panel.id}`)
      .setLabel(panel.button_label || 'Open Ticket')
      .setStyle(ButtonStyle[panel.button_color] || ButtonStyle.Primary);

    if (panel.button_emoji) btn.setEmoji(panel.button_emoji);

    const row = new ActionRowBuilder().addComponents(btn);

    if (panel.message_id) {
      try {
        const msg = await channel.messages.fetch(panel.message_id);
        await msg.edit({ embeds: [embed], components: [row] });
        res.json({ success: true, message_id: panel.message_id });
        return;
      } catch (e) {}
    }

    const msg = await channel.send({ embeds: [embed], components: [row] });
    await Panel.update(panel.id, { message_id: msg.id });
    await Log.create(getGuildId(req), 'panel_posted', req.session.user.id, null, { panel_id: panel.id, channel_id: panel.channel_id });
    res.json({ success: true, message_id: msg.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/plans', async (req, res) => {
  try { res.json(await Plan.getAll(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/plans', async (req, res) => {
  try {
    const plan = await Plan.create({ ...req.body, guild_id: getGuildId(req) });
    await Log.create(getGuildId(req), 'plan_created', req.session.user.id, null, { plan_id: plan.id });
    res.json(plan);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/plans/:id', async (req, res) => {
  try {
    await Plan.update(req.params.id, req.body);
    await Log.create(getGuildId(req), 'plan_updated', req.session.user.id, null, { plan_id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/plans/:id', async (req, res) => {
  try {
    await Plan.delete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/plan-pricing', async (req, res) => {
  try { res.json(await PlanPricing.getAllForGuild(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/plan-pricing/:planId', async (req, res) => {
  try { res.json(await PlanPricing.getByPlan(req.params.planId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/plan-pricing', async (req, res) => {
  try {
    const { plan_id, payment_method_id, price, currency } = req.body;
    if (!plan_id || !payment_method_id || price === undefined) {
      return res.status(400).json({ error: 'plan_id, payment_method_id, and price are required' });
    }
    const guildId = getGuildId(req);
    const plan = await Plan.getById(plan_id);
    const method = await PaymentMethod.getById(payment_method_id);
    if (!plan || plan.guild_id !== guildId || !method || method.guild_id !== guildId) {
      return res.status(403).json({ error: 'Plan or payment method not found in your server' });
    }
    const result = await PlanPricing.upsert(plan_id, payment_method_id, price, currency || 'INR');
    await Log.create(guildId, 'plan_pricing_updated', req.session.user.id, null, { plan_id, payment_method_id, price });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/plan-pricing/:planId/:methodId', async (req, res) => {
  try {
    const guildId = getGuildId(req);
    const plan = await Plan.getById(req.params.planId);
    if (!plan || plan.guild_id !== guildId) {
      return res.status(403).json({ error: 'Plan not found in your server' });
    }
    await PlanPricing.delete(req.params.planId, req.params.methodId);
    await Log.create(guildId, 'plan_pricing_deleted', req.session.user.id, null, { plan_id: req.params.planId, method_id: req.params.methodId });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/payment-methods', async (req, res) => {
  try { res.json(await PaymentMethod.getAll(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/payment-methods', async (req, res) => {
  try {
    const m = await PaymentMethod.create({ ...req.body, guild_id: getGuildId(req) });
    await Log.create(getGuildId(req), 'payment_method_created', req.session.user.id, null, { id: m.id });
    res.json(m);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/payment-methods/:id', async (req, res) => {
  try {
    await PaymentMethod.update(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.delete('/payment-methods/:id', async (req, res) => {
  try {
    await PaymentMethod.delete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/tickets', async (req, res) => {
  try {
    const status = req.query.status || null;
    res.json(await Ticket.getAllByGuild(getGuildId(req), status));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/tickets/stats', async (req, res) => {
  try { res.json(await Ticket.countByGuild(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions', async (req, res) => {
  try {
    const status = req.query.status || null;
    res.json(await Subscription.getAllByGuild(getGuildId(req), status));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions/stats', async (req, res) => {
  try { res.json(await Subscription.getStats(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions/plan-stats', async (req, res) => {
  try { res.json(await Subscription.getPlanStats(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions/expiring', async (req, res) => {
  try { res.json(await Subscription.getExpiringSoon(getGuildId(req), parseInt(req.query.days) || 7)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.put('/subscriptions/:id', async (req, res) => {
  try {
    await Subscription.update(req.params.id, req.body);
    await Log.create(getGuildId(req), 'subscription_updated', req.session.user.id, null, { sub_id: req.params.id, changes: req.body });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/subscriptions/:id/extend', async (req, res) => {
  try {
    const sub = await Subscription.getById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Not found' });
    const newEnd = new Date(sub.end_date);
    newEnd.setDate(newEnd.getDate() + (parseInt(req.body.days) || 30));
    await Subscription.update(req.params.id, { end_date: newEnd.toISOString(), status: 'active' });

    const guild = await Guild.get(getGuildId(req));
    const reminderDays = guild?.reminder_days || [3, 2, 1];
    const reminders = [];
    for (const d of reminderDays) {
      const rd = new Date(newEnd);
      rd.setDate(rd.getDate() - d);
      if (rd > new Date()) {
        reminders.push({ subscription_id: sub.id, user_id: sub.user_id, guild_id: sub.guild_id, reminder_date: rd.toISOString().split('T')[0], days_before: d });
      }
    }
    if (reminders.length > 0) await Reminder.createBulk(reminders);
    await Log.create(getGuildId(req), 'subscription_extended', req.session.user.id, sub.user_id, { sub_id: sub.id, new_end: newEnd.toISOString() });
    res.json({ success: true, new_end_date: newEnd.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    await Subscription.update(req.params.id, { status: 'cancelled' });
    await Log.create(getGuildId(req), 'subscription_cancelled', req.session.user.id, null, { sub_id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions/:id/reminders', async (req, res) => {
  try { res.json(await Reminder.getBySubscription(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.post('/reminders/trigger/:subId', async (req, res) => {
  try {
    const sub = await Subscription.getById(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'Not found' });

    const user = await req.discordClient.users.fetch(sub.user_id).catch(() => null);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const endDate = new Date(sub.end_date);
    const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

    const { EmbedBuilder: EB, ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = await import('discord.js');
    const embed = new EB()
      .setTitle('⏰ Subscription Ending Soon')
      .setDescription(`Your subscription (**${sub.plan_name}**) is ending soon.\n\n**Expiry Date:** ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n**Days Left:** ${daysLeft}`)
      .setColor('#FFA500')
      .setTimestamp();

    const row = new AR().addComponents(
      new BB().setLabel('Resubscribe Now').setStyle(BS.Link).setURL(`https://discord.com/channels/1153309880644554804/1415963231108861952`)
    );

    await user.send({ embeds: [embed], components: [row] });
    await Log.create(getGuildId(req), 'manual_reminder_sent', req.session.user.id, sub.user_id, { sub_id: sub.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/reminders/history', async (req, res) => {
  try { res.json(await Reminder.getHistory(getGuildId(req))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/logs', async (req, res) => {
  try { res.json(await Log.getByGuild(getGuildId(req), parseInt(req.query.limit) || 100)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/analytics', async (req, res) => {
  try {
    const guildId = getGuildId(req);
    const [subStats, planStats, ticketStats] = await Promise.all([
      Subscription.getStats(guildId),
      Subscription.getPlanStats(guildId),
      Ticket.countByGuild(guildId)
    ]);
    res.json({ subscriptions: subStats, planBreakdown: planStats, tickets: ticketStats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

apiRouter.get('/subscriptions/export', async (req, res) => {
  try {
    const subs = await Subscription.getAllByGuild(getGuildId(req));
    let csv = 'ID,User ID,Email,Plan,Price,Currency,Start Date,End Date,Payment Method,Status\n';
    for (const s of subs) {
      csv += `${s.id},"${s.user_id}","${s.email || ''}","${s.plan_name}",${s.price},${s.currency},${s.start_date},${s.end_date},"${s.payment_method || ''}",${s.status}\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
