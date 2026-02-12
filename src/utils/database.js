import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'bot.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    category_id TEXT,
    staff_role_id TEXT,
    logs_channel_id TEXT,
    button_label TEXT DEFAULT '📩 Open Ticket',
    button_style TEXT DEFAULT 'Primary',
    panel_embed_json TEXT,
    ticket_embed_json TEXT,
    subscription_plans_json TEXT,
    payment_methods_json TEXT,
    max_tickets_per_user INTEGER DEFAULT 1,
    cooldown_seconds INTEGER DEFAULT 60,
    transcript_dm INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ticket_id TEXT,
    ticket_channel_id TEXT,
    email TEXT,
    plan_name TEXT NOT NULL,
    plan_price_inr TEXT,
    plan_price_usd TEXT,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    payment_method TEXT,
    status TEXT DEFAULT 'active',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS subscription_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    reminder_date TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    sent_at INTEGER,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
  );

  CREATE TABLE IF NOT EXISTS email_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    ticket_channel_id TEXT NOT NULL,
    email TEXT NOT NULL,
    plan_name TEXT,
    start_date INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_panels_guild_channel ON ticket_panels(guild_id, channel_id);
  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subs_end ON subscriptions(end_date);
  CREATE INDEX IF NOT EXISTS idx_reminders_date ON subscription_reminders(reminder_date, sent);
`);

export function savePanel(guildId, channelId, messageId, config) {
  const stmt = db.prepare(`
    INSERT INTO ticket_panels (guild_id, channel_id, message_id, category_id, staff_role_id, logs_channel_id,
      button_label, button_style, panel_embed_json, ticket_embed_json, subscription_plans_json,
      payment_methods_json, max_tickets_per_user, cooldown_seconds, transcript_dm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, channel_id) DO UPDATE SET
      message_id = excluded.message_id,
      category_id = excluded.category_id,
      staff_role_id = excluded.staff_role_id,
      logs_channel_id = excluded.logs_channel_id,
      button_label = excluded.button_label,
      button_style = excluded.button_style,
      panel_embed_json = excluded.panel_embed_json,
      ticket_embed_json = excluded.ticket_embed_json,
      subscription_plans_json = excluded.subscription_plans_json,
      payment_methods_json = excluded.payment_methods_json,
      max_tickets_per_user = excluded.max_tickets_per_user,
      cooldown_seconds = excluded.cooldown_seconds,
      transcript_dm = excluded.transcript_dm
  `);

  stmt.run(
    guildId, channelId, messageId,
    config.categoryId || null,
    config.supportRoleId || null,
    config.logsChannelId || null,
    config.buttonLabel || '📩 Open Ticket',
    config.buttonStyle || 'Primary',
    JSON.stringify(config.panelEmbed || {}),
    JSON.stringify(config.ticketEmbed || {}),
    JSON.stringify(config.subscriptionPlans || []),
    JSON.stringify(config.paymentMethods || {}),
    config.maxTicketsPerUser || 1,
    config.cooldownSeconds || 60,
    config.transcriptDm ? 1 : 0
  );
}

export function getAllPanels() {
  const rows = db.prepare('SELECT * FROM ticket_panels').all();
  return rows.map(row => ({
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    categoryId: row.category_id,
    staffRoleId: row.staff_role_id,
    logsChannelId: row.logs_channel_id,
    buttonLabel: row.button_label,
    buttonStyle: row.button_style,
    panelEmbed: JSON.parse(row.panel_embed_json || '{}'),
    ticketEmbed: JSON.parse(row.ticket_embed_json || '{}'),
    subscriptionPlans: JSON.parse(row.subscription_plans_json || '[]'),
    paymentMethods: JSON.parse(row.payment_methods_json || '{}'),
    maxTicketsPerUser: row.max_tickets_per_user,
    cooldownSeconds: row.cooldown_seconds,
    transcriptDm: !!row.transcript_dm
  }));
}

export function getPanelsByGuild(guildId) {
  const rows = db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ?').all(guildId);
  return rows.map(row => ({
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    categoryId: row.category_id,
    staffRoleId: row.staff_role_id,
    logsChannelId: row.logs_channel_id,
    buttonLabel: row.button_label,
    buttonStyle: row.button_style,
    panelEmbed: JSON.parse(row.panel_embed_json || '{}'),
    ticketEmbed: JSON.parse(row.ticket_embed_json || '{}'),
    subscriptionPlans: JSON.parse(row.subscription_plans_json || '[]'),
    paymentMethods: JSON.parse(row.payment_methods_json || '{}'),
    maxTicketsPerUser: row.max_tickets_per_user,
    cooldownSeconds: row.cooldown_seconds,
    transcriptDm: !!row.transcript_dm
  }));
}

export function deletePanel(guildId, channelId) {
  db.prepare('DELETE FROM ticket_panels WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
}

export function saveSubscription(data) {
  const stmt = db.prepare(`
    INSERT INTO subscriptions (guild_id, user_id, ticket_id, ticket_channel_id, email, plan_name,
      plan_price_inr, plan_price_usd, start_date, end_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.guildId, data.userId, data.ticketId || null, data.ticketChannelId || null,
    data.email || null, data.planName,
    data.planPriceINR || null, data.planPriceUSD || null,
    data.startDate, data.endDate,
    data.paymentMethod || null, data.status || 'active'
  );

  return result.lastInsertRowid;
}

export function updateSubscriptionEmail(subscriptionId, email) {
  db.prepare('UPDATE subscriptions SET email = ? WHERE id = ?').run(email, subscriptionId);
}

export function getActiveSubscriptions() {
  return db.prepare("SELECT * FROM subscriptions WHERE status = 'active'").all();
}

export function getSubscriptionsByUser(userId) {
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

export function getSubscriptionByTicket(ticketChannelId) {
  return db.prepare('SELECT * FROM subscriptions WHERE ticket_channel_id = ? ORDER BY created_at DESC LIMIT 1').get(ticketChannelId);
}

export function expireSubscription(id) {
  db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(id);
}

export function createReminders(subscriptionId, reminderDates) {
  const stmt = db.prepare('INSERT INTO subscription_reminders (subscription_id, reminder_date) VALUES (?, ?)');
  const insertMany = db.transaction((dates) => {
    for (const date of dates) {
      stmt.run(subscriptionId, date);
    }
  });
  insertMany(reminderDates);
}

export function getPendingReminders(dateStr) {
  return db.prepare(`
    SELECT sr.*, s.user_id, s.plan_name, s.end_date, s.guild_id
    FROM subscription_reminders sr
    JOIN subscriptions s ON sr.subscription_id = s.id
    WHERE sr.reminder_date = ? AND sr.sent = 0 AND s.status = 'active'
  `).all(dateStr);
}

export function markReminderSent(reminderId) {
  db.prepare('UPDATE subscription_reminders SET sent = 1, sent_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), reminderId);
}

export function saveEmailSubmission(data) {
  const stmt = db.prepare(`
    INSERT INTO email_submissions (guild_id, user_id, ticket_channel_id, email, plan_name, start_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(data.guildId, data.userId, data.ticketChannelId, data.email, data.planName || null, data.startDate || Math.floor(Date.now() / 1000));
}

export function getEmailSubmission(ticketChannelId) {
  return db.prepare('SELECT * FROM email_submissions WHERE ticket_channel_id = ? ORDER BY created_at DESC LIMIT 1').get(ticketChannelId);
}

export { db };
