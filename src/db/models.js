import { pool } from './schema.js';

export const Guild = {
  async get(id) {
    const r = await pool.query('SELECT * FROM guilds WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async upsert(id, data = {}) {
    await pool.query(
      `INSERT INTO guilds (id, name, icon_url, owner_id, ticket_category_id, logs_channel_id, staff_role_ids, reminder_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = COALESCE($2, guilds.name),
         icon_url = COALESCE($3, guilds.icon_url),
         owner_id = COALESCE($4, guilds.owner_id),
         ticket_category_id = COALESCE($5, guilds.ticket_category_id),
         logs_channel_id = COALESCE($6, guilds.logs_channel_id),
         staff_role_ids = COALESCE($7, guilds.staff_role_ids),
         reminder_days = COALESCE($8, guilds.reminder_days),
         updated_at = NOW()`,
      [id, data.name || null, data.iconUrl || null, data.ownerId || null,
       data.ticketCategoryId || null, data.logsChannelId || null,
       data.staffRoleIds || null, data.reminderDays || null]
    );
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${col} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE guilds SET ${fields.join(', ')} WHERE id = $${i}`, values);
  }
};

export const Panel = {
  async getAll(guildId) {
    const r = await pool.query('SELECT * FROM ticket_panels WHERE guild_id = $1 ORDER BY id', [guildId]);
    return r.rows;
  },
  async getById(id) {
    const r = await pool.query('SELECT * FROM ticket_panels WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async create(data) {
    const r = await pool.query(
      `INSERT INTO ticket_panels (guild_id, channel_id, message_id, title, description, color, thumbnail_url, image_url, footer_text,
        button_label, button_emoji, button_color, category_id, staff_role_id, logs_channel_id, max_tickets_per_user, cooldown_seconds, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [data.guild_id, data.channel_id, data.message_id || null, data.title, data.description, data.color,
       data.thumbnail_url || null, data.image_url || null, data.footer_text || null,
       data.button_label || 'Open Ticket', data.button_emoji || '📩', data.button_color || 'Primary',
       data.category_id || null, data.staff_role_id || null, data.logs_channel_id || null,
       data.max_tickets_per_user || 1, data.cooldown_seconds || 60, data.enabled !== false]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE ticket_panels SET ${fields.join(', ')} WHERE id = $${i}`, values);
  },
  async delete(id) {
    await pool.query('DELETE FROM ticket_panels WHERE id = $1', [id]);
  }
};

export const Plan = {
  async getAll(guildId) {
    const r = await pool.query('SELECT * FROM plans WHERE guild_id = $1 ORDER BY display_order, id', [guildId]);
    return r.rows;
  },
  async getEnabled(guildId) {
    const r = await pool.query('SELECT * FROM plans WHERE guild_id = $1 AND enabled = TRUE ORDER BY display_order, id', [guildId]);
    return r.rows;
  },
  async getById(id) {
    const r = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async create(data) {
    const r = await pool.query(
      `INSERT INTO plans (guild_id, name, duration_days, price, currency, discount_percent, enabled, recommended, button_emoji, button_color, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.guild_id, data.name, data.duration_days, data.price || 0, data.currency || 'INR',
       data.discount_percent || 0, data.enabled !== false, data.recommended || false,
       data.button_emoji || null, data.button_color || 'Secondary', data.display_order || 0]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE plans SET ${fields.join(', ')} WHERE id = $${i}`, values);
  },
  async delete(id) {
    await pool.query('DELETE FROM plans WHERE id = $1', [id]);
  }
};

export const PaymentMethod = {
  async getAll(guildId) {
    const r = await pool.query('SELECT * FROM payment_methods WHERE guild_id = $1 ORDER BY display_order, id', [guildId]);
    return r.rows;
  },
  async getEnabled(guildId) {
    const r = await pool.query('SELECT * FROM payment_methods WHERE guild_id = $1 AND enabled = TRUE ORDER BY display_order, id', [guildId]);
    return r.rows;
  },
  async getById(id) {
    const r = await pool.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async create(data) {
    const r = await pool.query(
      `INSERT INTO payment_methods (guild_id, name, label, emoji, button_color, recommended, enabled, instructions, payment_link, qr_image_url, embed_color, embed_thumbnail, embed_image, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [data.guild_id, data.name, data.label, data.emoji || null, data.button_color || 'Secondary',
       data.recommended || false, data.enabled !== false, data.instructions || null,
       data.payment_link || null, data.qr_image_url || null, data.embed_color || '#5865F2',
       data.embed_thumbnail || null, data.embed_image || null, data.display_order || 0]
    );
    return r.rows[0];
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id = $${i}`, values);
  },
  async delete(id) {
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
  }
};

export const Ticket = {
  async create(data) {
    const r = await pool.query(
      `INSERT INTO tickets (guild_id, user_id, channel_id, panel_id, status)
       VALUES ($1,$2,$3,$4,'open') RETURNING *`,
      [data.guild_id, data.user_id, data.channel_id, data.panel_id || null]
    );
    return r.rows[0];
  },
  async getByChannel(channelId) {
    const r = await pool.query('SELECT * FROM tickets WHERE channel_id = $1', [channelId]);
    return r.rows[0] || null;
  },
  async getById(id) {
    const r = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async getOpenByUser(guildId, userId) {
    const r = await pool.query(
      "SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'",
      [guildId, userId]
    );
    return r.rows;
  },
  async getAllByGuild(guildId, status = null) {
    let q = 'SELECT * FROM tickets WHERE guild_id = $1';
    const params = [guildId];
    if (status) { q += ' AND status = $2'; params.push(status); }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    return r.rows;
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE tickets SET ${fields.join(', ')} WHERE id = $${i}`, values);
  },
  async close(id, closedBy) {
    await pool.query(
      "UPDATE tickets SET status = 'closed', closed_by = $1, closed_at = NOW(), updated_at = NOW() WHERE id = $2",
      [closedBy, id]
    );
  },
  async countByGuild(guildId) {
    const r = await pool.query(
      `SELECT status, COUNT(*) as count FROM tickets WHERE guild_id = $1 GROUP BY status`,
      [guildId]
    );
    return r.rows;
  }
};

export const Subscription = {
  async create(data) {
    const r = await pool.query(
      `INSERT INTO subscriptions (guild_id, user_id, ticket_id, plan_id, email, plan_name, price, currency, start_date, end_date, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.guild_id, data.user_id, data.ticket_id || null, data.plan_id || null,
       data.email || null, data.plan_name, data.price || 0, data.currency || 'INR',
       data.start_date, data.end_date, data.payment_method || null, data.status || 'active']
    );
    return r.rows[0];
  },
  async getById(id) {
    const r = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
  async getByUser(userId) {
    const r = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return r.rows;
  },
  async getAllByGuild(guildId, status = null) {
    let q = 'SELECT * FROM subscriptions WHERE guild_id = $1';
    const params = [guildId];
    if (status) { q += ' AND status = $2'; params.push(status); }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, params);
    return r.rows;
  },
  async getActive() {
    const r = await pool.query("SELECT * FROM subscriptions WHERE status = 'active'");
    return r.rows;
  },
  async getExpiringSoon(guildId, days = 7) {
    const r = await pool.query(
      `SELECT * FROM subscriptions WHERE guild_id = $1 AND status = 'active' AND end_date <= NOW() + interval '1 day' * $2 ORDER BY end_date`,
      [guildId, days]
    );
    return r.rows;
  },
  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    fields.push('updated_at = NOW()');
    values.push(id);
    await pool.query(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${i}`, values);
  },
  async expire(id) {
    await pool.query("UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE id = $1", [id]);
  },
  async getStats(guildId) {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) as total_count,
        COALESCE(SUM(price) FILTER (WHERE status IN ('active','expired')), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'active' AND end_date <= NOW() + interval '7 days') as expiring_soon
      FROM subscriptions WHERE guild_id = $1
    `, [guildId]);
    return r.rows[0];
  },
  async getPlanStats(guildId) {
    const r = await pool.query(`
      SELECT plan_name, COUNT(*) as count, SUM(price) as revenue
      FROM subscriptions WHERE guild_id = $1 AND status IN ('active','expired')
      GROUP BY plan_name ORDER BY count DESC
    `, [guildId]);
    return r.rows;
  },
  async getByTicket(ticketId) {
    const r = await pool.query('SELECT * FROM subscriptions WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1', [ticketId]);
    return r.rows[0] || null;
  }
};

export const Reminder = {
  async create(data) {
    await pool.query(
      `INSERT INTO reminders (subscription_id, user_id, guild_id, reminder_date, days_before)
       VALUES ($1,$2,$3,$4,$5)`,
      [data.subscription_id, data.user_id, data.guild_id, data.reminder_date, data.days_before]
    );
  },
  async createBulk(reminders) {
    for (const r of reminders) {
      await pool.query(
        `INSERT INTO reminders (subscription_id, user_id, guild_id, reminder_date, days_before)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [r.subscription_id, r.user_id, r.guild_id, r.reminder_date, r.days_before]
      );
    }
  },
  async getPending(date) {
    const r = await pool.query(`
      SELECT r.*, s.plan_name, s.end_date, s.start_date, s.price, s.currency
      FROM reminders r
      JOIN subscriptions s ON r.subscription_id = s.id
      WHERE r.reminder_date <= $1 AND r.sent = FALSE AND s.status = 'active'
      ORDER BY r.reminder_date
    `, [date]);
    return r.rows;
  },
  async markSent(id) {
    await pool.query('UPDATE reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1', [id]);
  },
  async markError(id, error) {
    await pool.query('UPDATE reminders SET error = $1 WHERE id = $2', [error, id]);
  },
  async getBySubscription(subscriptionId) {
    const r = await pool.query('SELECT * FROM reminders WHERE subscription_id = $1 ORDER BY reminder_date', [subscriptionId]);
    return r.rows;
  },
  async getHistory(guildId, limit = 50) {
    const r = await pool.query(
      'SELECT * FROM reminders WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2',
      [guildId, limit]
    );
    return r.rows;
  }
};

export const Payment = {
  async create(data) {
    const r = await pool.query(
      `INSERT INTO payments (guild_id, ticket_id, subscription_id, user_id, amount, currency, payment_method, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.guild_id, data.ticket_id || null, data.subscription_id || null, data.user_id,
       data.amount || 0, data.currency || 'INR', data.payment_method || null, data.status || 'pending']
    );
    return r.rows[0];
  },
  async confirm(id, confirmedBy) {
    await pool.query(
      "UPDATE payments SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW() WHERE id = $2",
      [confirmedBy, id]
    );
  }
};

export const Log = {
  async create(guildId, action, actorId, targetId = null, details = null) {
    await pool.query(
      'INSERT INTO logs (guild_id, action, actor_id, target_id, details) VALUES ($1,$2,$3,$4,$5)',
      [guildId, action, actorId, targetId, details ? JSON.stringify(details) : null]
    );
  },
  async getByGuild(guildId, limit = 100) {
    const r = await pool.query(
      'SELECT * FROM logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2',
      [guildId, limit]
    );
    return r.rows;
  }
};
