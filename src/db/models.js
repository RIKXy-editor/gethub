import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('.railway.internal') ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

export const Guild = {
  async get(guildId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM guilds WHERE id = $1', [guildId]);
    return rows[0] || null;
  },
  async create(guildId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('INSERT INTO guilds (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING *', [guildId]);
    return rows[0] || await this.get(guildId);
  },
  async update(guildId, data) {
    const db = getPool();
    if (!db) return null;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
    vals.push(guildId);
    const { rows } = await db.query(`UPDATE guilds SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, vals);
    return rows[0];
  }
};

export const Panel = {
  async getAll(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM ticket_panels WHERE guild_id = $1 ORDER BY created_at DESC', [guildId]);
    return rows;
  },
  async get(panelId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM ticket_panels WHERE id = $1', [panelId]);
    return rows[0] || null;
  },
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO ticket_panels (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  },
  async update(panelId, data) {
    const db = getPool();
    if (!db) return null;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
    vals.push(panelId);
    const { rows } = await db.query(`UPDATE ticket_panels SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, vals);
    return rows[0];
  },
  async delete(panelId) {
    const db = getPool();
    if (!db) return;
    await db.query('DELETE FROM ticket_panels WHERE id = $1', [panelId]);
  }
};

export const Plan = {
  async getAll(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM plans WHERE guild_id = $1 ORDER BY display_order ASC, id ASC', [guildId]);
    return rows;
  },
  async getEnabled(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM plans WHERE guild_id = $1 AND enabled = true ORDER BY display_order ASC, id ASC', [guildId]);
    return rows;
  },
  async get(planId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM plans WHERE id = $1', [planId]);
    return rows[0] || null;
  },
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO plans (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  },
  async update(planId, data) {
    const db = getPool();
    if (!db) return null;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
    vals.push(planId);
    const { rows } = await db.query(`UPDATE plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, vals);
    return rows[0];
  },
  async delete(planId) {
    const db = getPool();
    if (!db) return;
    await db.query('DELETE FROM plans WHERE id = $1', [planId]);
  }
};

export const PaymentMethod = {
  async getAll(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM payment_methods WHERE guild_id = $1 ORDER BY display_order ASC, id ASC', [guildId]);
    return rows;
  },
  async getEnabled(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM payment_methods WHERE guild_id = $1 AND enabled = true ORDER BY display_order ASC, id ASC', [guildId]);
    return rows;
  },
  async get(methodId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM payment_methods WHERE id = $1', [methodId]);
    return rows[0] || null;
  },
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO payment_methods (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  }
};

export const PlanPricing = {
  async getPrice(planId, methodId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query(
      'SELECT * FROM plan_pricing WHERE plan_id = $1 AND payment_method_id = $2',
      [planId, methodId]
    );
    if (rows[0]) return rows[0];
    const plan = await Plan.get(planId);
    return plan ? { price: plan.price, currency: plan.currency } : null;
  },
  async getAllForPlan(planId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT pp.*, pm.label, pm.name as method_name FROM plan_pricing pp JOIN payment_methods pm ON pp.payment_method_id = pm.id WHERE pp.plan_id = $1', [planId]);
    return rows;
  }
};

export const Ticket = {
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO tickets (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  },
  async get(ticketId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    return rows[0] || null;
  },
  async getByChannel(channelId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query("SELECT * FROM tickets WHERE channel_id = $1 AND status != 'closed' ORDER BY created_at DESC LIMIT 1", [channelId]);
    return rows[0] || null;
  },
  async getOpenByUser(guildId, userId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query("SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status != 'closed'", [guildId, userId]);
    return rows;
  },
  async update(ticketId, data) {
    const db = getPool();
    if (!db) return null;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
    vals.push(ticketId);
    const { rows } = await db.query(`UPDATE tickets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, vals);
    return rows[0];
  },
  async countByGuild(guildId) {
    const db = getPool();
    if (!db) return { total: 0, open: 0, closed: 0 };
    const total = await db.query('SELECT COUNT(*) FROM tickets WHERE guild_id = $1', [guildId]);
    const open = await db.query("SELECT COUNT(*) FROM tickets WHERE guild_id = $1 AND status = 'open'", [guildId]);
    const closed = await db.query("SELECT COUNT(*) FROM tickets WHERE guild_id = $1 AND status = 'closed'", [guildId]);
    return {
      total: parseInt(total.rows[0].count),
      open: parseInt(open.rows[0].count),
      closed: parseInt(closed.rows[0].count)
    };
  }
};

export const Subscription = {
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO subscriptions (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  },
  async get(subId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [subId]);
    return rows[0] || null;
  },
  async getByUser(guildId, userId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query('SELECT * FROM subscriptions WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC', [guildId, userId]);
    return rows;
  },
  async getActive(guildId) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query("SELECT * FROM subscriptions WHERE guild_id = $1 AND status = 'active' AND end_date > NOW()", [guildId]);
    return rows;
  },
  async getExpiringSoon(guildId, days) {
    const db = getPool();
    if (!db) return [];
    const { rows } = await db.query(
      "SELECT * FROM subscriptions WHERE guild_id = $1 AND status = 'active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '1 day' * $2",
      [guildId, days]
    );
    return rows;
  },
  async update(subId, data) {
    const db = getPool();
    if (!db) return null;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
    vals.push(subId);
    const { rows } = await db.query(`UPDATE subscriptions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, vals);
    return rows[0];
  },
  async getStats(guildId) {
    const db = getPool();
    if (!db) return { active: 0, total_revenue: 0, expiring_soon: 0 };
    const active = await db.query("SELECT COUNT(*) FROM subscriptions WHERE guild_id = $1 AND status = 'active' AND end_date > NOW()", [guildId]);
    const revenue = await db.query("SELECT COALESCE(SUM(price), 0) as total FROM subscriptions WHERE guild_id = $1", [guildId]);
    const expiring = await db.query("SELECT COUNT(*) FROM subscriptions WHERE guild_id = $1 AND status = 'active' AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'", [guildId]);
    return {
      active: parseInt(active.rows[0].count),
      total_revenue: parseFloat(revenue.rows[0].total),
      expiring_soon: parseInt(expiring.rows[0].count)
    };
  }
};

export const Payment = {
  async create(data) {
    const db = getPool();
    if (!db) return null;
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    const { rows } = await db.query(
      `INSERT INTO payments (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      vals
    );
    return rows[0];
  },
  async getByTicket(ticketId) {
    const db = getPool();
    if (!db) return null;
    const { rows } = await db.query('SELECT * FROM payments WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1', [ticketId]);
    return rows[0] || null;
  }
};
