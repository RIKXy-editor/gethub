import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getWelcomeConfig, setWelcomeConfig, resetWelcomeConfig } from '../utils/storage.js';

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

function buildConfigSummary(config, guild) {
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
  let config = getWelcomeConfig(guildId);

  if (subcommand === 'setup') {
    const previewEmbed = buildPreviewEmbed(config, interaction.member);
    const buttons = buildWizardButtons(config);
    const summary = buildConfigSummary(config, interaction.guild);

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
      config = getWelcomeConfig(guildId);

      if (i.customId === 'welcome_channel') {
        await i.reply({ content: '📢 Please mention the channel for welcome messages (e.g., #welcome):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          const channel = msg.mentions.channels.first() || interaction.guild.channels.cache.get(msg.content);
          if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
            setWelcomeConfig(guildId, { channelId: channel.id });
            config = getWelcomeConfig(guildId);
            await msg.delete().catch(() => null);
            await updateWizard(interaction, config);
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
            setWelcomeConfig(guildId, { color });
            config = getWelcomeConfig(guildId);
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
          setWelcomeConfig(guildId, { imageUrl: url });
          config = getWelcomeConfig(guildId);
          await msg.delete().catch(() => null);
          await updateWizard(interaction, config);
        });
      }

      if (i.customId === 'welcome_ping') {
        setWelcomeConfig(guildId, { pingUser: !config.pingUser });
        config = getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_dm') {
        setWelcomeConfig(guildId, { dmWelcome: !config.dmWelcome });
        config = getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_role') {
        await i.reply({ content: '🎭 Mention the role to auto-assign (or type "none" to remove):', ephemeral: true });
        const msgCollector = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 60000 });
        msgCollector.on('collect', async (msg) => {
          const role = msg.mentions.roles.first();
          setWelcomeConfig(guildId, { autoRoleId: role?.id || null });
          config = getWelcomeConfig(guildId);
          await msg.delete().catch(() => null);
          await updateWizard(interaction, config);
        });
      }

      if (i.customId === 'welcome_thumbnail') {
        const modes = ['user', 'server', 'none'];
        const currentIndex = modes.indexOf(config.thumbnailMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setWelcomeConfig(guildId, { thumbnailMode: nextMode });
        config = getWelcomeConfig(guildId);
        await i.deferUpdate();
        await updateWizard(interaction, config);
      }

      if (i.customId === 'welcome_finish') {
        setWelcomeConfig(guildId, { enabled: true });
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
      const summary = buildConfigSummary(cfg, originalInteraction.guild);
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
    setWelcomeConfig(guildId, { enabled: newState });
    await interaction.reply({ content: `✅ Welcome system is now **${newState ? 'ENABLED' : 'DISABLED'}**.`, ephemeral: true });
  }

  if (subcommand === 'reset') {
    resetWelcomeConfig(guildId);
    await interaction.reply({ content: '✅ Welcome config reset to default.', ephemeral: true });
  }

  if (subcommand === 'view') {
    const summary = buildConfigSummary(config, interaction.guild);
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

  setWelcomeConfig(guildId, { title, description, footer: footer || null });
  
  await interaction.deferUpdate();
  return true;
}
