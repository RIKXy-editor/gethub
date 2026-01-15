import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
  
  if (subcommand === 'enable' || subcommand === 'disable') {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await db.connect();
      const enabled = subcommand === 'enable';
      if (enabled) {
        const res = await db.query('SELECT channel_id FROM welcome_settings WHERE guild_id = $1', [interaction.guildId]);
        if (!res.rows[0]?.channel_id) {
          return await interaction.reply({ content: '❌ Please run `/welcome setup` first to set a channel.', ephemeral: true });
        }
      }
      await db.query('UPDATE welcome_settings SET enabled = $1 WHERE guild_id = $1', [enabled, interaction.guildId]);
      await interaction.reply({ content: `✅ Welcome system ${subcommand}d!`, ephemeral: true });
    } catch (error) {
      console.error('Welcome command error:', error);
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
    } finally {
      await db.end().catch(() => null);
    }
    return;
  }

  // Subcommand 'setup' - Interactive Flow
  await interaction.reply({
    content: '📝 **Welcome System Setup**\n\nWhich **Channel** should I send welcome messages in? (Mention the channel, e.g., #welcome or type \'cancel\')',
    ephemeral: true
  });

  const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
  const collectorOptions = { filter, max: 1, time: 60000, errors: ['time'] };

  let channelId = null;
  const WELCOME_COLOR = '#9b59b6';
  const THUMBNAIL_URL = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif';

  const buildPreview = () => {
    return new EmbedBuilder()
      .setTitle('👋 Welcome to Editors Club!')
      .setDescription(`Welcome ${interaction.user} to the server!\n\nYou are our **100** member. We are glad to have you here!`)
      .setColor(WELCOME_COLOR)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setImage(THUMBNAIL_URL)
      .setFooter({ text: `Member #100 • Editors Club` })
      .setTimestamp();
  };

  try {
    const msg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (msg.content.toLowerCase() === 'cancel') {
      await msg.delete().catch(() => null);
      return await interaction.editReply({ content: '❌ Setup cancelled.' });
    }

    const mentionedChannel = msg.mentions.channels.first();
    if (!mentionedChannel || mentionedChannel.type !== ChannelType.GuildText) {
      await msg.delete().catch(() => null);
      return await interaction.editReply({ content: '❌ Invalid channel. Please run `/welcome setup` again and mention a text channel.' });
    }

    channelId = mentionedChannel.id;
    await msg.delete().catch(() => null);

    // Show Preview and Confirm
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_confirm').setLabel('Confirm Setup').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('welcome_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.editReply({
      content: `✅ **Channel set to ${mentionedChannel}.**\nHere is a preview of the welcome message:`,
      embeds: [buildPreview()],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'welcome_confirm') {
        const db = new Client({ connectionString: process.env.DATABASE_URL });
        try {
          await db.connect();
          await db.query(`
            INSERT INTO welcome_settings (guild_id, channel_id, enabled)
            VALUES ($1, $2, $3)
            ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2, enabled = TRUE
          `, [interaction.guildId, channelId, true]);
          await i.update({ content: '✅ Welcome system setup and enabled successfully!', embeds: [], components: [] });
        } catch (err) {
          console.error(err);
          await i.update({ content: '❌ Failed to save settings.', embeds: [], components: [] });
        } finally {
          await db.end().catch(() => null);
        }
      } else {
        await i.update({ content: '❌ Setup cancelled.', embeds: [], components: [] });
      }
      collector.stop();
    });

  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: '⏱️ Timed out. Please try again.' });
  }
}
