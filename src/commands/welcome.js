import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;
let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  const isInternalRailway = process.env.DATABASE_URL.includes('.railway.internal');
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: isInternalRailway ? false : { rejectUnauthorized: false }
  });
  
  pool.query('SELECT 1').then(() => {
    dbAvailable = true;
    console.log('Welcome system: Database connected');
    pool.query(`
      CREATE TABLE IF NOT EXISTS welcome_config (
        guild_id VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE,
        channel_id VARCHAR(255),
        title TEXT DEFAULT 'Welcome to {server}!',
        description TEXT DEFAULT 'Hey {user}, welcome to **{server}**!\nYou are our **{memberCount}** member.',
        footer TEXT DEFAULT 'Member #{memberCount}',
        color VARCHAR(10) DEFAULT '#9b59b6',
        thumbnail_mode VARCHAR(20) DEFAULT 'user',
        image_url TEXT,
        ping_user BOOLEAN DEFAULT TRUE,
        dm_welcome BOOLEAN DEFAULT FALSE,
        auto_role_id VARCHAR(255)
      )
    `).catch(err => console.error('Welcome table creation error:', err.message));
  }).catch(err => {
    console.error('Welcome system: Database not available -', err.message);
    dbAvailable = false;
  });
} else {
  console.log('Welcome system: No DATABASE_URL configured');
}

const defaultConfig = {
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
};

async function getWelcomeConfig(guildId) {
  if (!pool) return { ...defaultConfig };
  try {
    const res = await pool.query('SELECT * FROM welcome_config WHERE guild_id = $1', [guildId]);
    if (res.rows[0]) {
      const row = res.rows[0];
      return {
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
      };
    }
    return { ...defaultConfig };
  } catch (err) {
    console.error('Error getting welcome config:', err.message);
    return { ...defaultConfig };
  }
}

async function setWelcomeConfig(guildId, updates) {
  if (!pool) {
    console.error('Welcome: Cannot save - pool is null');
    return;
  }
  try {
    console.log(`Welcome: Saving config for guild ${guildId}:`, JSON.stringify(updates));
    const current = await getWelcomeConfig(guildId);
    const merged = { ...current, ...updates };
    
    await pool.query(`
      INSERT INTO welcome_config (guild_id, enabled, channel_id, title, description, footer, color, thumbnail_mode, image_url, ping_user, dm_welcome, auto_role_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (guild_id) DO UPDATE SET
        enabled = $2, channel_id = $3, title = $4, description = $5, footer = $6,
        color = $7, thumbnail_mode = $8, image_url = $9, ping_user = $10, dm_welcome = $11, auto_role_id = $12
    `, [guildId, merged.enabled, merged.channelId, merged.title, merged.description, merged.footer, merged.color, merged.thumbnailMode, merged.imageUrl, merged.pingUser, merged.dmWelcome, merged.autoRoleId]);
    console.log(`Welcome: Config saved successfully for guild ${guildId}`);
  } catch (err) {
    console.error('Error setting welcome config:', err.message);
  }
}

async function resetWelcomeConfig(guildId) {
  if (!pool) return;
  try {
    await pool.query('DELETE FROM welcome_config WHERE guild_id = $1', [guildId]);
  } catch (err) {
    console.error('Error resetting welcome config:', err.message);
  }
}

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Welcome system management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName('setup').setDescription('Open the welcome setup wizard'))
  .addSubcommand(sub => sub.setName('test').setDescription('Send a test welcome message'))
  .addSubcommand(sub => sub.setName('toggle').setDescription('Enable or disable the welcome system'))
  .addSubcommand(sub => sub.setName('reset').setDescription('Reset welcome config to default'))
  .addSubcommand(sub => sub.setName('view').setDescription('View current welcome config'));

function replacePlaceholders(text, member) {
  if (!text) return '';
  return text
    .replace(/{user}/g, member?.toString() || '@User')
    .replace(/{username}/g, member?.user?.username || 'Username')
    .replace(/{server}/g, member?.guild?.name || 'Server')
    .replace(/{memberCount}/g, member?.guild?.memberCount?.toString() || '123');
}

function buildPreviewEmbed(config, member) {
  const embed = new EmbedBuilder()
    .setTitle(replacePlaceholders(config.title, member))
    .setDescription(replacePlaceholders(config.description, member))
    .setColor(config.color || '#9b59b6')
    .setTimestamp();

  if (config.footer) {
    embed.setFooter({ text: replacePlaceholders(config.footer, member) });
  }

  if (config.thumbnailMode === 'user' && member?.user) {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
  } else if (config.thumbnailMode === 'server' && member?.guild) {
    embed.setThumbnail(member.guild.iconURL({ dynamic: true }));
  }

  if (config.imageUrl) {
    embed.setImage(config.imageUrl);
  }

  return embed;
}

function buildWizardButtons(config) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('welcome_channel').setLabel('Set Channel').setStyle(ButtonStyle.Primary).setEmoji('📢'),
    new ButtonBuilder().setCustomId('welcome_message').setLabel('Set Message').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId('welcome_color').setLabel('Set Color').setStyle(ButtonStyle.Primary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId('welcome_image').setLabel('Set Banner').setStyle(ButtonStyle.Primary).setEmoji('🖼️')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('welcome_ping').setLabel(`Ping: ${config.pingUser ? 'ON' : 'OFF'}`).setStyle(config.pingUser ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🔔'),
    new ButtonBuilder().setCustomId('welcome_dm').setLabel(`DM: ${config.dmWelcome ? 'ON' : 'OFF'}`).setStyle(config.dmWelcome ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('📩'),
    new ButtonBuilder().setCustomId('welcome_role').setLabel('Auto Role').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
    new ButtonBuilder().setCustomId('welcome_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Primary).setEmoji('👤')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('welcome_finish').setLabel('Save & Finish').setStyle(ButtonStyle.Success).setEmoji('✅')
  );

  return [row1, row2, row3];
}

function buildConfigSummary(config) {
  const channel = config.channelId ? `<#${config.channelId}>` : 'Not set';
  const role = config.autoRoleId ? `<@&${config.autoRoleId}>` : 'None';
  return `**Current Settings:**
📢 Channel: ${channel}
🔔 Ping User: ${config.pingUser ? 'Yes' : 'No'}
📩 DM Welcome: ${config.dmWelcome ? 'Yes' : 'No'}
🎭 Auto Role: ${role}
👤 Thumbnail: ${config.thumbnailMode}
🎨 Color: ${config.color}
✅ Enabled: ${config.enabled ? 'Yes' : 'No'}`;
}

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  let config = await getWelcomeConfig(guildId);

  if (subcommand === 'setup') {
    const previewEmbed = buildPreviewEmbed(config, interaction.member);
    const buttons = buildWizardButtons(config);
    const summary = buildConfigSummary(config);

    await interaction.reply({
      content: `🎉 **Welcome System Setup Wizard**\n\n${summary}\n\n**Preview:**`,
      embeds: [previewEmbed],
      components: buttons,
      ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith('welcome_'),
      time: 300000
    });

    collector.on('collect', async (i) => {
      config = await getWelcomeConfig(guildId);

      if (i.customId === 'welcome_channel') {
        await i.reply({ content: '📢 Please mention the channel for welcome messages (e.g., #welcome):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          try {
            console.log(`Welcome: Channel input received: "${msg.content}"`);
            const channel = msg.mentions.channels.first() || interaction.guild.channels.cache.get(msg.content);
            console.log(`Welcome: Found channel: ${channel?.id} (type: ${channel?.type})`);
            
            if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
              console.log(`Welcome: Saving channel ${channel.id} for guild ${guildId}`);
              await setWelcomeConfig(guildId, { channelId: channel.id });
              config = await getWelcomeConfig(guildId);
              console.log(`Welcome: Config after save:`, JSON.stringify(config));
              
              if (config.channelId === channel.id) {
                await msg.reply({ content: `✅ Channel set to ${channel}!` }).then(m => setTimeout(() => m.delete().catch(() => null), 3000));
              } else {
                await msg.reply({ content: `⚠️ Channel save may have failed. DB returned: ${config.channelId}` }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
              }
              await msg.delete().catch(() => null);
              await updateWizard(interaction, config);
            } else {
              console.log(`Welcome: Channel validation failed - channel: ${channel?.id}, type: ${channel?.type}`);
              await msg.reply({ content: '❌ Invalid channel. Please mention a text channel like #welcome' }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
            }
          } catch (err) {
            console.error('Welcome channel error:', err);
            await msg.reply({ content: `❌ Error: ${err.message}` }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          }
        });
        msgCollector.on('end', (collected, reason) => {
          if (collected.size === 0) {
            console.log(`Welcome: Channel collector ended with no input (reason: ${reason})`);
          }
        });
      }

      if (i.customId === 'welcome_message') {
        const modal = new ModalBuilder().setCustomId('welcome_message_modal').setTitle('Set Welcome Message');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.title).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.description).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('footer').setLabel('Footer').setStyle(TextInputStyle.Short).setValue(config.footer || '').setRequired(false)
          )
        );
        await i.showModal(modal);
      }

      if (i.customId === 'welcome_color') {
        await i.reply({ content: '🎨 Enter a hex color code (e.g., #ff5733):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          const color = msg.content.trim();
          if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            await setWelcomeConfig(guildId, { color });
            config = await getWelcomeConfig(guildId);
            await msg.delete().catch(() => null);
            await updateWizard(interaction, config);
          }
        });
      }

      if (i.customId === 'welcome_image') {
        await i.reply({ content: '🖼️ Enter the banner image URL (or type "none" to remove):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          const url = msg.content.trim().toLowerCase() === 'none' ? null : msg.content.trim();
          await setWelcomeConfig(guildId, { imageUrl: url });
          config = await getWelcomeConfig(guildId);
          await msg.delete().catch(() => null);
          await updateWizard(interaction, config);
        });
      }

      if (i.customId === 'welcome_ping') {
        await setWelcomeConfig(guildId, { pingUser: !config.pingUser });
        config = await getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_dm') {
        await setWelcomeConfig(guildId, { dmWelcome: !config.dmWelcome });
        config = await getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_role') {
        await i.reply({ content: '🎭 Mention the role to auto-assign (or type "none" to remove):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          const role = msg.mentions.roles.first();
          await setWelcomeConfig(guildId, { autoRoleId: role?.id || null });
          config = await getWelcomeConfig(guildId);
          await msg.delete().catch(() => null);
          await updateWizard(interaction, config);
        });
      }

      if (i.customId === 'welcome_thumbnail') {
        const modes = ['user', 'server', 'none'];
        const currentIndex = modes.indexOf(config.thumbnailMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        await setWelcomeConfig(guildId, { thumbnailMode: nextMode });
        config = await getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_finish') {
        await setWelcomeConfig(guildId, { enabled: true });
        collector.stop();
        await i.update({
          content: '✅ **Welcome system saved and enabled!**\n\nUse `/welcome test` to preview, `/welcome toggle` to enable/disable.',
          embeds: [],
          components: []
        });
      }
    });

    async function updateWizard(originalInteraction, cfg) {
      const previewEmbed = buildPreviewEmbed(cfg, originalInteraction.member);
      const buttons = buildWizardButtons(cfg);
      const summary = buildConfigSummary(cfg);
      await originalInteraction.editReply({
        content: `🎉 **Welcome System Setup Wizard**\n\n${summary}\n\n**Preview:**`,
        embeds: [previewEmbed],
        components: buttons
      });
    }
  }

  if (subcommand === 'test') {
    if (!config.channelId) {
      return await interaction.reply({ content: '❌ No welcome channel configured. Use `/welcome setup` first.', ephemeral: true });
    }
    const channel = interaction.guild.channels.cache.get(config.channelId);
    if (!channel) {
      return await interaction.reply({ content: '❌ Welcome channel not found.', ephemeral: true });
    }
    const embed = buildPreviewEmbed(config, interaction.member);
    const content = config.pingUser ? `${interaction.member}` : null;
    await channel.send({ content, embeds: [embed] });
    await interaction.reply({ content: '✅ Test welcome message sent!', ephemeral: true });
  }

  if (subcommand === 'toggle') {
    const newState = !config.enabled;
    await setWelcomeConfig(guildId, { enabled: newState });
    await interaction.reply({ content: `✅ Welcome system is now **${newState ? 'ENABLED' : 'DISABLED'}**.`, ephemeral: true });
  }

  if (subcommand === 'reset') {
    await resetWelcomeConfig(guildId);
    await interaction.reply({ content: '✅ Welcome config reset to default.', ephemeral: true });
  }

  if (subcommand === 'view') {
    const summary = buildConfigSummary(config);
    const embed = buildPreviewEmbed(config, interaction.member);
    await interaction.reply({ content: `📋 **Current Welcome Configuration**\n\n${summary}`, embeds: [embed], ephemeral: true });
  }
}

export async function handleModal(interaction) {
  if (interaction.customId !== 'welcome_message_modal') return false;
  
  const guildId = interaction.guild.id;
  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');
  const footer = interaction.fields.getTextInputValue('footer');

  await setWelcomeConfig(guildId, { title, description, footer: footer || null });
  
  await interaction.deferUpdate();
  return true;
}
