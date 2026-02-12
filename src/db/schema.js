import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('.railway.internal') ? false : { rejectUnauthorized: false }
});

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS guilds (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon_url TEXT,
        owner_id TEXT,
        ticket_category_id TEXT,
        logs_channel_id TEXT,
        staff_role_ids TEXT[] DEFAULT '{}',
        reminder_days INTEGER[] DEFAULT '{3,2,1}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ticket_panels (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(id),
        channel_id TEXT NOT NULL,
        message_id TEXT,
        title TEXT DEFAULT 'Support Tickets',
        description TEXT DEFAULT 'Click the button below to open a ticket.',
        color TEXT DEFAULT '#5865F2',
        thumbnail_url TEXT,
        image_url TEXT,
        footer_text TEXT,
        button_label TEXT DEFAULT 'Open Ticket',
        button_emoji TEXT DEFAULT '📩',
        button_color TEXT DEFAULT 'Primary',
        category_id TEXT,
        staff_role_id TEXT,
        logs_channel_id TEXT,
        max_tickets_per_user INTEGER DEFAULT 1,
        cooldown_seconds INTEGER DEFAULT 60,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(id),
        name TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        price DECIMAL(10,2),
        currency TEXT DEFAULT 'INR',
        discount_percent INTEGER DEFAULT 0,
        enabled BOOLEAN DEFAULT TRUE,
        recommended BOOLEAN DEFAULT FALSE,
        button_emoji TEXT,
        button_color TEXT DEFAULT 'Secondary',
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(id),
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        emoji TEXT,
        button_color TEXT DEFAULT 'Secondary',
        recommended BOOLEAN DEFAULT FALSE,
        enabled BOOLEAN DEFAULT TRUE,
        instructions TEXT,
        payment_link TEXT,
        qr_image_url TEXT,
        embed_color TEXT DEFAULT '#5865F2',
        embed_thumbnail TEXT,
        embed_image TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        discriminator TEXT,
        avatar_url TEXT,
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(id),
        user_id TEXT NOT NULL,
        channel_id TEXT UNIQUE,
        panel_id INTEGER REFERENCES ticket_panels(id),
        plan_id INTEGER REFERENCES plans(id),
        payment_method_id INTEGER REFERENCES payment_methods(id),
        status TEXT DEFAULT 'open',
        claimed_by TEXT,
        priority TEXT DEFAULT 'normal',
        payment_confirmed BOOLEAN DEFAULT FALSE,
        payment_confirmed_by TEXT,
        payment_confirmed_at TIMESTAMPTZ,
        email TEXT,
        closed_by TEXT,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL REFERENCES guilds(id),
        user_id TEXT NOT NULL,
        ticket_id INTEGER REFERENCES tickets(id),
        plan_id INTEGER REFERENCES plans(id),
        email TEXT,
        plan_name TEXT NOT NULL,
        price DECIMAL(10,2),
        currency TEXT DEFAULT 'INR',
        start_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        reminder_date DATE NOT NULL,
        days_before INTEGER NOT NULL,
        sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMPTZ,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        ticket_id INTEGER REFERENCES tickets(id),
        subscription_id INTEGER REFERENCES subscriptions(id),
        user_id TEXT NOT NULL,
        amount DECIMAL(10,2),
        currency TEXT DEFAULT 'INR',
        payment_method TEXT,
        status TEXT DEFAULT 'pending',
        confirmed_by TEXT,
        confirmed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        target_id TEXT,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subs_end ON subscriptions(end_date);
      CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date, sent);
      CREATE INDEX IF NOT EXISTS idx_reminders_sub ON reminders(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_logs_guild ON logs(guild_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_plans_guild ON plans(guild_id);
      CREATE INDEX IF NOT EXISTS idx_payment_methods_guild ON payment_methods(guild_id);
      CREATE INDEX IF NOT EXISTS idx_panels_guild ON ticket_panels(guild_id);

      CREATE TABLE IF NOT EXISTS welcome_config (
        guild_id VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE,
        channel_id VARCHAR(255),
        title TEXT DEFAULT 'Welcome to {server}!',
        description TEXT,
        footer TEXT,
        color VARCHAR(10) DEFAULT '#9b59b6',
        thumbnail_mode VARCHAR(20) DEFAULT 'user',
        image_url TEXT,
        ping_user BOOLEAN DEFAULT TRUE,
        dm_welcome BOOLEAN DEFAULT FALSE,
        auto_role_id VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS keyword_settings (
        guild_id VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255),
        keyword TEXT NOT NULL
      );
    `);

    console.log('[DB] Database schema initialized successfully.');
  } finally {
    client.release();
  }
}

export async function seedDefaultData(guildId) {
  const existing = await pool.query('SELECT id FROM guilds WHERE id = $1', [guildId]);
  if (existing.rows.length > 0) return;

  await pool.query(
    'INSERT INTO guilds (id) VALUES ($1) ON CONFLICT DO NOTHING',
    [guildId]
  );

  const plans = [
    { name: '1 Month', duration: 30, price: 199, order: 1 },
    { name: '3 Months', duration: 90, price: 499, order: 2, recommended: true },
    { name: '6 Months', duration: 180, price: 899, order: 3 },
    { name: '1 Year', duration: 365, price: 1499, order: 4 }
  ];

  for (const plan of plans) {
    await pool.query(
      `INSERT INTO plans (guild_id, name, duration_days, price, recommended, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [guildId, plan.name, plan.duration, plan.price, plan.recommended || false, plan.order]
    );
  }

  const methods = [
    { name: 'upi', label: 'UPI', emoji: '💳', recommended: true, order: 1, instructions: 'Send payment to the UPI ID provided and click "I Have Paid".' },
    { name: 'paypal', label: 'PayPal', emoji: '🅿️', order: 2, instructions: 'Send payment via PayPal and click "I Have Paid".' },
    { name: 'crypto', label: 'Bitcoin', emoji: '₿', order: 3, instructions: 'Send crypto to the wallet address provided and click "I Have Paid".' },
    { name: 'card', label: 'Card', emoji: '💳', order: 4, instructions: 'Complete the card payment and click "I Have Paid".' }
  ];

  for (const method of methods) {
    await pool.query(
      `INSERT INTO payment_methods (guild_id, name, label, emoji, recommended, display_order, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [guildId, method.name, method.label, method.emoji, method.recommended || false, method.order, method.instructions]
    );
  }

  console.log(`[DB] Default data seeded for guild ${guildId}`);
}

export { pool };
