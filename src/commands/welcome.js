import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import pkg from 'pg';
const { Client } = pkg;

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Manage the welcome system')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the welcome system interactively')
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

  if (subcommand === 'enable' || subcommand === 'disable') {
    try {
      await db.connect();
      const enabled = subcommand === 'enable';
      if (enabled) {
        const res = await db.query('SELECT channel_id FROM welcome_settings WHERE guild_id = $1', [interaction.guildId]);
        if (!res.rows[0]?.channel_id) {
          return await interaction.reply({ content: '❌ Please run `/welcome setup` first to set a channel.', ephemeral: true });
        }
      }
      await db.query('UPDATE welcome_settings SET enabled = $1 WHERE guild_id = $2', [enabled, interaction.guildId]);
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
  const collectorOptions = { filter, max: 1, time: 300000, errors: ['time'] };

  let channelId = null;
  let welcomeTitle = '👋 Welcome to Editors Club!';
  let welcomeMessage = 'Welcome {user} to the server!\n\nYou are our **{membercount}** member. We are glad to have you here!';
  let bannerUrl = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif';
  const WELCOME_COLOR = '#9b59b6';

  const replacePlaceholders = (text) => {
    return text
      .replace(/{user}/g, interaction.user.toString())
      .replace(/{membercount}/g, '100')
      .replace(/{server}/g, interaction.guild.name)
      .replace(/{joindate}/g, interaction.member.joinedAt?.toLocaleDateString() || 'N/A');
  };

  const buildPreview = () => {
    return new EmbedBuilder()
      .setTitle(replacePlaceholders(welcomeTitle))
      .setDescription(replacePlaceholders(welcomeMessage))
      .setColor(WELCOME_COLOR)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setImage(bannerUrl)
      .setFooter({ text: `Member #100 • ${interaction.guild.name}` })
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
      return await interaction.editReply({ content: '❌ Invalid channel. Please run `/welcome setup` again.' });
    }
    channelId = mentionedChannel.id;
    await msg.delete().catch(() => null);

    await interaction.editReply({ content: '📝 **Step 2: Enter Welcome Title** (e.g., Welcome to {server}! or type \'skip\')', embeds: [buildPreview()] });
    const titleMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (titleMsg.content.toLowerCase() === 'cancel') return await titleMsg.delete().catch(() => null);
    if (titleMsg.content.toLowerCase() !== 'skip') welcomeTitle = titleMsg.content;
    await titleMsg.delete().catch(() => null);

    await interaction.editReply({ content: '📝 **Step 3: Enter Welcome Message** (Placeholders: {user}, {server}, {membercount} or type \'skip\')', embeds: [buildPreview()] });
    const textMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (textMsg.content.toLowerCase() === 'cancel') return await textMsg.delete().catch(() => null);
    if (textMsg.content.toLowerCase() !== 'skip') welcomeMessage = textMsg.content;
    await textMsg.delete().catch(() => null);

    await interaction.editReply({ content: '📝 **Step 4: Enter Banner Image URL** (or type \'skip\')', embeds: [buildPreview()] });
    const bannerMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (bannerMsg.content.toLowerCase() === 'cancel') return await bannerMsg.delete().catch(() => null);
    if (bannerMsg.content.toLowerCase() !== 'skip') bannerUrl = bannerMsg.content;
    await bannerMsg.delete().catch(() => null);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('welcome_confirm').setLabel('Confirm Setup').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('welcome_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.editReply({
      content: `✅ **Setup Complete.** Confirm to save these settings:`,
      embeds: [buildPreview()],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
      if (i.customId === 'welcome_confirm') {
        const dbConnect = new Client({ connectionString: process.env.DATABASE_URL });
        try {
          await dbConnect.connect();
          await dbConnect.query(`
            INSERT INTO welcome_settings (guild_id, channel_id, enabled, title, message, banner_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (guild_id) DO UPDATE SET 
              channel_id = EXCLUDED.channel_id, 
              enabled = TRUE,
              title = EXCLUDED.title,
              message = EXCLUDED.message,
              banner_url = EXCLUDED.banner_url
          `, [interaction.guildId, channelId, true, welcomeTitle, welcomeMessage, bannerUrl]);
          await i.update({ content: '✅ Welcome system setup and enabled successfully!', embeds: [], components: [] });
        } catch (err) {
          console.error('Database Error:', err);
          await i.update({ content: `❌ Failed to save settings. Error: ${err.message}`, embeds: [], components: [] });
        } finally {
          await dbConnect.end().catch(() => null);
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
