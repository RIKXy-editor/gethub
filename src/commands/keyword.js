import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;
let pool = null;

if (process.env.DATABASE_URL) {
  const isInternalRailway = process.env.DATABASE_URL.includes('.railway.internal');
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: isInternalRailway ? false : { rejectUnauthorized: false }
  });
  
  pool.query(`
    CREATE TABLE IF NOT EXISTS keyword_settings (
      guild_id VARCHAR(255) PRIMARY KEY,
      enabled BOOLEAN DEFAULT FALSE
    )
  `).catch(err => console.error('Keyword settings table error:', err.message));
  
  pool.query(`
    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(255),
      keyword TEXT NOT NULL
    )
  `).catch(err => console.error('Keywords table error:', err.message));
}

export const data = new SlashCommandBuilder()
  .setName('keyword')
  .setDescription('Manage the keyword warning system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Add a keyword to the warning list')
      .addStringOption(opt => opt.setName('keyword').setDescription('The word or phrase to flag').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a keyword from the warning list')
      .addStringOption(opt => opt.setName('keyword').setDescription('The word or phrase to remove').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all saved keywords')
  )
  .addSubcommand(sub =>
    sub.setName('toggle')
      .setDescription('Toggle the keyword system on or off')
      .addStringOption(opt => opt.setName('state').setDescription('ON or OFF').setRequired(true).addChoices(
        { name: 'ON', value: 'on' },
        { name: 'OFF', value: 'off' }
      ))
  );

export async function execute(interaction) {
  if (!pool) {
    return await interaction.reply({ content: '❌ Database not available. Please check DATABASE_URL configuration.', ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    await pool.query('INSERT INTO keyword_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING', [guildId]);

    if (subcommand === 'add') {
      const keyword = interaction.options.getString('keyword').toLowerCase();
      await pool.query('INSERT INTO keywords (guild_id, keyword) VALUES ($1, $2)', [guildId, keyword]);
      await interaction.reply({ content: `✅ Keyword added: \`${keyword}\``, ephemeral: true });
    }

    if (subcommand === 'remove') {
      const keyword = interaction.options.getString('keyword').toLowerCase();
      const result = await pool.query('DELETE FROM keywords WHERE guild_id = $1 AND keyword = $2', [guildId, keyword]);
      if (result.rowCount === 0) {
        await interaction.reply({ content: `❌ Keyword \`${keyword}\` not found.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `✅ Keyword removed: \`${keyword}\``, ephemeral: true });
      }
    }

    if (subcommand === 'list') {
      const res = await pool.query('SELECT keyword FROM keywords WHERE guild_id = $1', [guildId]);
      if (res.rows.length === 0) {
        await interaction.reply({ content: '📌 No keywords saved yet.', ephemeral: true });
      } else {
        const list = res.rows.map((r, i) => `${i + 1}. ${r.keyword}`).join('\n');
        await interaction.reply({ content: `📌 **Saved keywords:**\n\n${list}`, ephemeral: true });
      }
    }

    if (subcommand === 'toggle') {
      const state = interaction.options.getString('state');
      const isEnabled = state === 'on';
      await pool.query('UPDATE keyword_settings SET enabled = $1 WHERE guild_id = $2', [isEnabled, guildId]);
      await interaction.reply({ content: `✅ Keyword warning system is now: **${state.toUpperCase()}**`, ephemeral: true });
    }
  } catch (err) {
    console.error('Keyword command error:', err.message);
    await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
  }
}
