import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import pkg from 'pg';
const { Client } = pkg;

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Manage the welcome system')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the welcome channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('The channel for welcome messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Enable the welcome system')
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the welcome system')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await db.connect();
    
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS welcome_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        enabled BOOLEAN DEFAULT FALSE
      )
    `);

    if (subcommand === 'setup') {
      const channel = interaction.options.getChannel('channel');
      await db.query(`
        INSERT INTO welcome_settings (guild_id, channel_id, enabled)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2, enabled = TRUE
      `, [interaction.guildId, channel.id, true]);
      
      await interaction.reply({ content: `✅ Welcome system setup in ${channel}! System is now enabled.`, ephemeral: true });
    } else if (subcommand === 'enable') {
      const res = await db.query('SELECT channel_id FROM welcome_settings WHERE guild_id = $1', [interaction.guildId]);
      if (!res.rows[0]?.channel_id) {
        return await interaction.reply({ content: '❌ Please run `/welcome setup` first to set a channel.', ephemeral: true });
      }
      
      await db.query('UPDATE welcome_settings SET enabled = TRUE WHERE guild_id = $1', [interaction.guildId]);
      await interaction.reply({ content: '✅ Welcome system enabled!', ephemeral: true });
    } else if (subcommand === 'disable') {
      await db.query('UPDATE welcome_settings SET enabled = FALSE WHERE guild_id = $1', [interaction.guildId]);
      await interaction.reply({ content: '✅ Welcome system disabled!', ephemeral: true });
    }
  } catch (error) {
    console.error('Welcome command error:', error);
    await interaction.reply({ content: '❌ An error occurred while managing the welcome system.', ephemeral: true });
  } finally {
    await db.end();
  }
}
