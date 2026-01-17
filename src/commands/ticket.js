import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';
import { generateTranscript } from '../utils/transcript.js';

function getTicketConfig(guildId) {
  const configs = loadData('ticketConfig', {});
  return configs[guildId] || {
    categoryId: null,
    logsChannelId: null,
    supportRoleId: null,
    transcriptDm: true,
    maxTicketsPerUser: 1,
    cooldownSeconds: 60,
    buttonLabel: '📩 Open Ticket',
    panelEmbed: {
      title: '🎫 Support Tickets',
      description: 'Need help? Click the button below to open a support ticket.\n\nOur team will assist you as soon as possible.',
      color: '#5865F2',
      footer: null,
      thumbnail: null,
      image: null
    },
    panelMessageId: null,
    panelChannelId: null
  };
}

function setTicketConfig(guildId, config) {
  const configs = loadData('ticketConfig', {});
  configs[guildId] = { ...getTicketConfig(guildId), ...config };
  saveData('ticketConfig', configs);
}

function getTickets(guildId) {
  const tickets = loadData('tickets', {});
  return tickets[guildId] || {};
}

function getTicket(guildId, channelId) {
  const tickets = getTickets(guildId);
  return tickets[channelId] || null;
}

function saveTicket(guildId, channelId, ticketData) {
  const tickets = loadData('tickets', {});
  if (!tickets[guildId]) tickets[guildId] = {};
  tickets[guildId][channelId] = ticketData;
  saveData('tickets', tickets);
}

function deleteTicket(guildId, channelId) {
  const tickets = loadData('tickets', {});
  if (tickets[guildId]) delete tickets[guildId][channelId];
  saveData('tickets', tickets);
}

function getTicketStats(guildId) {
  const stats = loadData('ticketStats', {});
  return stats[guildId] || { staffStats: {}, ratings: [] };
}

function saveTicketStats(guildId, stats) {
  const allStats = loadData('ticketStats', {});
  allStats[guildId] = stats;
  saveData('ticketStats', allStats);
}

function getUserCooldown(guildId, userId) {
  const cooldowns = loadData('ticketCooldowns', {});
  return cooldowns[`${guildId}-${userId}`] || 0;
}

function setUserCooldown(guildId, userId) {
  const cooldowns = loadData('ticketCooldowns', {});
  cooldowns[`${guildId}-${userId}`] = Date.now();
  saveData('ticketCooldowns', cooldowns);
}

function getUserOpenTickets(guildId, userId) {
  const tickets = getTickets(guildId);
  return Object.values(tickets).filter(t => 
    t.openerId === userId && t.status !== 'closed'
  ).length;
}

function generateShortId() {
  return Math.random().toString(36).substring(2, 6);
}

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket system management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName('setup').setDescription('Configure the ticket system'))
  .addSubcommand(sub => sub.setName('panel').setDescription('Post the ticket panel in a channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post panel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand(sub => sub.setName('stats').setDescription('View staff ticket statistics'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const config = getTicketConfig(guildId);

  if (subcommand === 'setup') {
    const panelEmbed = config.panelEmbed || {};
    
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket System Setup')
      .setDescription('Configure your ticket system using the buttons below.')
      .addFields(
        { name: '📁 Ticket Category', value: config.categoryId ? `<#${config.categoryId}>` : '❌ Not set', inline: true },
        { name: '👥 Support Role', value: config.supportRoleId ? `<@&${config.supportRoleId}>` : '❌ Not set', inline: true },
        { name: '📋 Logs Channel', value: config.logsChannelId ? `<#${config.logsChannelId}>` : 'Not set', inline: true },
        { name: '📩 DM Transcripts', value: config.transcriptDm ? 'Enabled' : 'Disabled', inline: true },
        { name: '🎟️ Max Tickets/User', value: String(config.maxTicketsPerUser), inline: true },
        { name: '⏱️ Cooldown', value: `${config.cooldownSeconds}s`, inline: true },
        { name: '🔘 Button Label', value: config.buttonLabel || '📩 Open Ticket', inline: true }
      )
      .setColor('#5865F2');

    const buttons1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:setup_category').setLabel('Set Category').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:setup_role').setLabel('Set Support Role').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:setup_logs').setLabel('Set Logs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:setup_limits').setLabel('Set Limits').setStyle(ButtonStyle.Secondary)
    );

    const buttons2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:setup_toggle_dm').setLabel('Toggle DM Transcript').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:setup_button').setLabel('Edit Button Label').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:setup_embed').setLabel('Edit Panel Embed').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons1, buttons2], ephemeral: true });
  }

  if (subcommand === 'panel') {
    const channel = interaction.options.getChannel('channel');
    
    if (!config.supportRoleId) {
      return await interaction.reply({ content: '❌ Please set a support role first using `/ticket setup`', ephemeral: true });
    }
    
    if (!config.categoryId) {
      return await interaction.reply({ content: '❌ Please set a ticket category first using `/ticket setup`', ephemeral: true });
    }

    const panelEmbed = config.panelEmbed || {};
    const embed = new EmbedBuilder()
      .setTitle(panelEmbed.title || '🎫 Support Tickets')
      .setDescription(panelEmbed.description || 'Need help? Click the button below to open a support ticket.')
      .setColor(panelEmbed.color || '#5865F2');
    
    if (panelEmbed.footer) embed.setFooter({ text: panelEmbed.footer });
    if (panelEmbed.thumbnail) embed.setThumbnail(panelEmbed.thumbnail);
    if (panelEmbed.image) embed.setImage(panelEmbed.image);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel(config.buttonLabel || '📩 Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    const panelMsg = await channel.send({ embeds: [embed], components: [row] });
    setTicketConfig(guildId, { panelMessageId: panelMsg.id, panelChannelId: channel.id });
    await interaction.reply({ content: `✅ Ticket panel posted in ${channel}`, ephemeral: true });
  }

  if (subcommand === 'stats') {
    const stats = getTicketStats(guildId);
    
    if (Object.keys(stats.staffStats).length === 0) {
      return await interaction.reply({ content: '📊 No ticket statistics yet.', ephemeral: true });
    }
    
    const leaderboard = Object.entries(stats.staffStats)
      .map(([staffId, data]) => ({
        staffId,
        claimed: data.claimed || 0,
        avgRating: data.totalRating ? (data.totalRating / data.ratingCount).toFixed(1) : 'N/A'
      }))
      .sort((a, b) => b.claimed - a.claimed)
      .slice(0, 10);
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Ticket Staff Leaderboard')
      .setDescription(leaderboard.map((s, i) => 
        `${i + 1}. <@${s.staffId}> - ${s.claimed} tickets | ⭐ ${s.avgRating}`
      ).join('\n'))
      .setColor('#5865F2');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export async function handleTicketInteraction(interaction) {
  const customId = interaction.customId;
  const guildId = interaction.guild.id;
  const config = getTicketConfig(guildId);

  if (customId === 'ticket:open') {
    const cooldownExpiry = getUserCooldown(guildId, interaction.user.id);
    const timeLeft = Math.ceil((cooldownExpiry + (config.cooldownSeconds * 1000) - Date.now()) / 1000);
    
    if (timeLeft > 0) {
      return await interaction.reply({ content: `⏱️ Please wait ${timeLeft} seconds before creating another ticket.`, ephemeral: true });
    }

    const openTickets = getUserOpenTickets(guildId, interaction.user.id);
    if (openTickets >= config.maxTicketsPerUser) {
      return await interaction.reply({ content: `❌ You already have ${openTickets} open ticket(s). Please close existing tickets first.`, ephemeral: true });
    }

    if (!config.categoryId || !config.supportRoleId) {
      return await interaction.reply({ content: '❌ Ticket system not configured. Please contact an admin.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const shortId = generateShortId();
      const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${shortId}`;
      
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.categoryId,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: config.supportRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ]
      });

      const ticketData = {
        openerId: interaction.user.id,
        openerTag: interaction.user.tag,
        channelId: ticketChannel.id,
        createdAt: Date.now(),
        claimedBy: null,
        status: 'open'
      };

      saveTicket(guildId, ticketChannel.id, ticketData);
      setUserCooldown(guildId, interaction.user.id);

      const controlEmbed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket')
        .setDescription(`Welcome ${interaction.user}!\n\nPlease describe your issue and our support team will assist you shortly.`)
        .addFields(
          { name: 'Opened by', value: interaction.user.tag, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      const buttons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✋'),
        new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('ticket:add_user').setLabel('Add User').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('ticket:remove_user').setLabel('Remove User').setStyle(ButtonStyle.Primary).setEmoji('➖')
      );

      const buttons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📜')
      );

      await ticketChannel.send({ content: `${interaction.user} <@&${config.supportRoleId}>`, embeds: [controlEmbed], components: [buttons1, buttons2] });

      if (config.logsChannelId) {
        const logsChannel = await interaction.guild.channels.fetch(config.logsChannelId).catch(() => null);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Created')
            .addFields(
              { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
              { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
            )
            .setColor('#00ff00')
            .setTimestamp();
          await logsChannel.send({ embeds: [logEmbed] });
        }
      }

      await interaction.editReply({ content: `✅ Your ticket has been created: ${ticketChannel}` });
    } catch (err) {
      console.error('Ticket creation error:', err);
      await interaction.editReply({ content: '❌ Failed to create ticket. Please contact an admin.' });
    }
  }

  if (customId === 'ticket:claim') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    
    if (ticket.claimedBy) {
      return await interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>`, ephemeral: true });
    }

    ticket.claimedBy = interaction.user.id;
    saveTicket(guildId, interaction.channel.id, ticket);

    const stats = getTicketStats(guildId);
    if (!stats.staffStats[interaction.user.id]) {
      stats.staffStats[interaction.user.id] = { claimed: 0, totalRating: 0, ratingCount: 0 };
    }
    stats.staffStats[interaction.user.id].claimed++;
    saveTicketStats(guildId, stats);

    await interaction.reply({ content: `✅ ${interaction.user} has claimed this ticket.` });
    await logTicketAction(interaction.guild, config, 'Claimed', ticket, interaction.user);
  }

  if (customId === 'ticket:unclaim') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    
    if (ticket.claimedBy !== interaction.user.id) {
      return await interaction.reply({ content: '❌ You cannot unclaim a ticket you did not claim.', ephemeral: true });
    }

    const stats = getTicketStats(guildId);
    if (stats.staffStats[interaction.user.id] && stats.staffStats[interaction.user.id].claimed > 0) {
      stats.staffStats[interaction.user.id].claimed--;
      saveTicketStats(guildId, stats);
    }

    ticket.claimedBy = null;
    saveTicket(guildId, interaction.channel.id, ticket);

    await interaction.reply({ content: `✅ ${interaction.user} has unclaimed this ticket.` });
    await logTicketAction(interaction.guild, config, 'Unclaimed', ticket, interaction.user);
  }

  if (customId === 'ticket:add_user') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:add_user_modal')
      .setTitle('Add User to Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('User ID').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:remove_user') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:remove_user_modal')
      .setTitle('Remove User from Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('user_id').setLabel('User ID').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:close') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:close_modal')
      .setTitle('Close Ticket')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Reason for closing').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Optional: Enter reason for closing...')
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:transcript') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    try {
      const transcript = await generateTranscript(interaction.channel, ticket);
      
      if (config.logsChannelId) {
        const logsChannel = await interaction.guild.channels.fetch(config.logsChannelId).catch(() => null);
        if (logsChannel) {
          await logsChannel.send({ content: `📜 Transcript for ticket \`${interaction.channel.name}\``, files: [transcript] });
        }
      }

      await interaction.editReply({ content: '✅ Transcript generated and sent to logs channel.', files: [transcript] });
    } catch (err) {
      console.error('Transcript error:', err);
      await interaction.editReply({ content: '❌ Failed to generate transcript.' });
    }
  }

  if (customId === 'ticket:reopen') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    ticket.status = 'open';
    saveTicket(guildId, interaction.channel.id, ticket);

    await interaction.channel.permissionOverwrites.edit(ticket.openerId, { ViewChannel: true, SendMessages: true });
    await interaction.reply({ content: '✅ Ticket has been reopened.' });
    await logTicketAction(interaction.guild, config, 'Reopened', ticket, interaction.user);
  }

  if (customId === 'ticket:setup_category') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:setup_category_modal')
      .setTitle('Set Ticket Category')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('category_id').setLabel('Discord Category ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Right-click category > Copy ID')
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:setup_logs') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:setup_logs_modal')
      .setTitle('Set Logs Channel')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('channel_id').setLabel('Logs Channel ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Right-click channel > Copy ID')
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:setup_toggle_dm') {
    const newValue = !config.transcriptDm;
    setTicketConfig(guildId, { transcriptDm: newValue });
    await interaction.reply({ content: `✅ Transcript DM is now ${newValue ? 'enabled' : 'disabled'}.`, ephemeral: true });
  }

  if (customId === 'ticket:setup_limits') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:setup_limits_modal')
      .setTitle('Set Ticket Limits')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('max_tickets').setLabel('Max tickets per user').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.maxTicketsPerUser))
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cooldown').setLabel('Cooldown in seconds').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.cooldownSeconds))
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:setup_role') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:setup_role_modal')
      .setTitle('Set Support Role')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('role_id').setLabel('Support Role ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Right-click role > Copy ID')
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:setup_button') {
    const modal = new ModalBuilder()
      .setCustomId('ticket:setup_button_modal')
      .setTitle('Edit Button Label')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('label').setLabel('Button Label (max 80 chars)').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.buttonLabel || '📩 Open Ticket').setMaxLength(80)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:setup_embed') {
    const panelEmbed = config.panelEmbed || {};
    
    const previewEmbed = new EmbedBuilder()
      .setTitle(panelEmbed.title || '🎫 Support Tickets')
      .setDescription(panelEmbed.description || 'Need help? Click the button below...')
      .setColor(panelEmbed.color || '#5865F2');
    
    if (panelEmbed.footer) previewEmbed.setFooter({ text: panelEmbed.footer });
    if (panelEmbed.thumbnail) previewEmbed.setThumbnail(panelEmbed.thumbnail);
    if (panelEmbed.image) previewEmbed.setImage(panelEmbed.image);

    const buttons1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:panel_title').setLabel('Edit Title').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:panel_desc').setLabel('Edit Description').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:panel_color').setLabel('Edit Color').setStyle(ButtonStyle.Primary)
    );
    
    const buttons2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:panel_footer').setLabel('Edit Footer').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:panel_thumb').setLabel('Set Thumbnail').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:panel_image').setLabel('Set Image').setStyle(ButtonStyle.Secondary)
    );

    const buttons3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:panel_update').setLabel('Update Live Panel').setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ 
      content: '**Panel Embed Preview:**\nUse the buttons to customize, then click "Update Live Panel" to apply.',
      embeds: [previewEmbed], 
      components: [buttons1, buttons2, buttons3], 
      ephemeral: true 
    });
  }

  if (customId === 'ticket:panel_update') {
    if (!config.panelMessageId || !config.panelChannelId) {
      return await interaction.reply({ content: '❌ No panel found. Use `/ticket panel` to post one first.', ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.fetch(config.panelChannelId);
      const message = await channel.messages.fetch(config.panelMessageId);
      
      const panelEmbed = config.panelEmbed || {};
      const embed = new EmbedBuilder()
        .setTitle(panelEmbed.title || '🎫 Support Tickets')
        .setDescription(panelEmbed.description || 'Need help? Click the button below...')
        .setColor(panelEmbed.color || '#5865F2');
      
      if (panelEmbed.footer) embed.setFooter({ text: panelEmbed.footer });
      if (panelEmbed.thumbnail) embed.setThumbnail(panelEmbed.thumbnail);
      if (panelEmbed.image) embed.setImage(panelEmbed.image);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open')
          .setLabel(config.buttonLabel || '📩 Open Ticket')
          .setStyle(ButtonStyle.Primary)
      );

      await message.edit({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Panel updated successfully!', ephemeral: true });
    } catch (err) {
      await interaction.reply({ content: '❌ Failed to update panel. The message may have been deleted. Use `/ticket panel` to post a new one.', ephemeral: true });
    }
  }

  if (customId === 'ticket:panel_title') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_title_modal')
      .setTitle('Edit Panel Title')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Panel Title').setStyle(TextInputStyle.Short).setRequired(true).setValue(panelEmbed.title || '🎫 Support Tickets').setMaxLength(256)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:panel_desc') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_desc_modal')
      .setTitle('Edit Panel Description')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Panel Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(panelEmbed.description || 'Need help? Select a category below...').setMaxLength(4000)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:panel_color') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_color_modal')
      .setTitle('Edit Panel Color')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('color').setLabel('Hex Color (e.g. #5865F2)').setStyle(TextInputStyle.Short).setRequired(true).setValue(panelEmbed.color || '#5865F2').setMaxLength(7)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:panel_footer') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_footer_modal')
      .setTitle('Edit Panel Footer')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('footer').setLabel('Footer Text (leave empty to remove)').setStyle(TextInputStyle.Short).setRequired(false).setValue(panelEmbed.footer || '').setMaxLength(2048)
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:panel_thumb') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_thumb_modal')
      .setTitle('Set Panel Thumbnail')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail URL (leave empty to remove)').setStyle(TextInputStyle.Short).setRequired(false).setValue(panelEmbed.thumbnail || '')
        )
      );
    await interaction.showModal(modal);
  }

  if (customId === 'ticket:panel_image') {
    const panelEmbed = config.panelEmbed || {};
    const modal = new ModalBuilder()
      .setCustomId('ticket:panel_image_modal')
      .setTitle('Set Panel Image')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('image').setLabel('Image URL (leave empty to remove)').setStyle(TextInputStyle.Short).setRequired(false).setValue(panelEmbed.image || '')
        )
      );
    await interaction.showModal(modal);
  }
}

export async function handleTicketModal(interaction) {
  const customId = interaction.customId;
  const guildId = interaction.guild.id;
  const config = getTicketConfig(guildId);
  const ticket = getTicket(guildId, interaction.channel.id);

  if (customId === 'ticket:add_user_modal') {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    try {
      const user = await interaction.guild.members.fetch(userId);
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await interaction.reply({ content: `✅ Added ${user} to this ticket.` });
      await logTicketAction(interaction.guild, config, `User Added: ${user.user.tag}`, ticket, interaction.user);
    } catch {
      await interaction.reply({ content: '❌ User not found.', ephemeral: true });
    }
  }

  if (customId === 'ticket:remove_user_modal') {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    try {
      await interaction.channel.permissionOverwrites.delete(userId);
      await interaction.reply({ content: `✅ Removed user from this ticket.` });
      await logTicketAction(interaction.guild, config, `User Removed: ${userId}`, ticket, interaction.user);
    } catch {
      await interaction.reply({ content: '❌ Failed to remove user.', ephemeral: true });
    }
  }

  if (customId === 'ticket:close_modal') {
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
    
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closeReason = reason;
    saveTicket(guildId, interaction.channel.id, ticket);

    await interaction.channel.permissionOverwrites.edit(ticket.openerId, { ViewChannel: true, SendMessages: false });

    const closedEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by ${interaction.user}`)
      .addFields({ name: 'Reason', value: reason })
      .setColor('#ff0000')
      .setTimestamp();

    const reopenRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
      new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📜')
    );

    await interaction.reply({ embeds: [closedEmbed], components: [reopenRow] });
    await logTicketAction(interaction.guild, config, `Closed - ${reason}`, ticket, interaction.user);

    if (config.transcriptDm) {
      try {
        const transcript = await generateTranscript(interaction.channel, ticket);
        const opener = await interaction.client.users.fetch(ticket.openerId);
        await opener.send({ content: `📜 Here's the transcript from your ticket in **${interaction.guild.name}**:`, files: [transcript] }).catch(() => null);
      } catch {}
    }

    try {
      const opener = await interaction.client.users.fetch(ticket.openerId);
      const ratingEmbed = new EmbedBuilder()
        .setTitle('⭐ Rate Your Support')
        .setDescription('How was your support experience? Please rate us!')
        .setColor('#FFD700');

      const ratingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket:rate:1:${interaction.channel.id}`).setLabel('1').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`ticket:rate:2:${interaction.channel.id}`).setLabel('2').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`ticket:rate:3:${interaction.channel.id}`).setLabel('3').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`ticket:rate:4:${interaction.channel.id}`).setLabel('4').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        new ButtonBuilder().setCustomId(`ticket:rate:5:${interaction.channel.id}`).setLabel('5').setStyle(ButtonStyle.Secondary).setEmoji('⭐')
      );

      await opener.send({ embeds: [ratingEmbed], components: [ratingRow] }).catch(() => null);
    } catch {}
  }

  if (customId === 'ticket:setup_category_modal') {
    const categoryId = interaction.fields.getTextInputValue('category_id').trim();
    try {
      const category = await interaction.guild.channels.fetch(categoryId);
      if (category && category.type === 4) {
        setTicketConfig(guildId, { categoryId: categoryId });
        await interaction.reply({ content: `✅ Ticket category set to **${category.name}**`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Invalid category ID. Make sure it\'s a category channel.', ephemeral: true });
      }
    } catch {
      await interaction.reply({ content: '❌ Category not found.', ephemeral: true });
    }
  }

  if (customId === 'ticket:setup_logs_modal') {
    const channelId = interaction.fields.getTextInputValue('channel_id').trim();
    try {
      const channel = await interaction.guild.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        setTicketConfig(guildId, { logsChannelId: channelId });
        await interaction.reply({ content: `✅ Logs channel set to ${channel}`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Invalid channel ID. Make sure it\'s a text channel.', ephemeral: true });
      }
    } catch {
      await interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
    }
  }

  if (customId === 'ticket:setup_limits_modal') {
    let maxTickets = parseInt(interaction.fields.getTextInputValue('max_tickets').trim());
    let cooldown = parseInt(interaction.fields.getTextInputValue('cooldown').trim());
    
    if (isNaN(maxTickets) || maxTickets < 1) maxTickets = 1;
    if (maxTickets > 10) maxTickets = 10;
    if (isNaN(cooldown) || cooldown < 0) cooldown = 0;
    if (cooldown > 3600) cooldown = 3600;
    
    setTicketConfig(guildId, { maxTicketsPerUser: maxTickets, cooldownSeconds: cooldown });
    await interaction.reply({ content: `✅ Limits updated: Max ${maxTickets} ticket(s) per user, ${cooldown}s cooldown.`, ephemeral: true });
  }

  if (customId === 'ticket:setup_role_modal') {
    const roleId = interaction.fields.getTextInputValue('role_id').trim();
    try {
      const role = await interaction.guild.roles.fetch(roleId);
      if (role) {
        setTicketConfig(guildId, { supportRoleId: roleId });
        await interaction.reply({ content: `✅ Support role set to ${role}`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Role not found.', ephemeral: true });
      }
    } catch {
      await interaction.reply({ content: '❌ Invalid role ID.', ephemeral: true });
    }
  }

  if (customId === 'ticket:setup_button_modal') {
    const label = interaction.fields.getTextInputValue('label').trim();
    if (label.length > 80) {
      return await interaction.reply({ content: '❌ Button label must be 80 characters or less.', ephemeral: true });
    }
    setTicketConfig(guildId, { buttonLabel: label });
    await interaction.reply({ content: `✅ Button label updated to: **${label}**\n\nUse \`/ticket panel\` to post a new panel or click "Update Live Panel" to apply.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_title_modal') {
    const title = interaction.fields.getTextInputValue('title').trim();
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.title = title;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: `✅ Panel title updated to: **${title}**\n\nClick "Update Live Panel" to apply changes.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_desc_modal') {
    const description = interaction.fields.getTextInputValue('description').trim();
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.description = description;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: `✅ Panel description updated!\n\nClick "Update Live Panel" to apply changes.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_color_modal') {
    let color = interaction.fields.getTextInputValue('color').trim();
    if (!color.startsWith('#')) color = '#' + color;
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return await interaction.reply({ content: '❌ Invalid hex color. Use format like #5865F2', ephemeral: true });
    }
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.color = color;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: `✅ Panel color updated to: **${color}**\n\nClick "Update Live Panel" to apply changes.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_footer_modal') {
    const footer = interaction.fields.getTextInputValue('footer').trim();
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.footer = footer || null;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: footer ? `✅ Panel footer updated!` : `✅ Panel footer removed.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_thumb_modal') {
    const thumbnail = interaction.fields.getTextInputValue('thumbnail').trim();
    if (thumbnail && !thumbnail.startsWith('http')) {
      return await interaction.reply({ content: '❌ Invalid URL. Must start with http:// or https://', ephemeral: true });
    }
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.thumbnail = thumbnail || null;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: thumbnail ? `✅ Panel thumbnail set!` : `✅ Panel thumbnail removed.`, ephemeral: true });
  }

  if (customId === 'ticket:panel_image_modal') {
    const image = interaction.fields.getTextInputValue('image').trim();
    if (image && !image.startsWith('http')) {
      return await interaction.reply({ content: '❌ Invalid URL. Must start with http:// or https://', ephemeral: true });
    }
    const panelEmbed = config.panelEmbed || {};
    panelEmbed.image = image || null;
    setTicketConfig(guildId, { panelEmbed });
    await interaction.reply({ content: image ? `✅ Panel image set!` : `✅ Panel image removed.`, ephemeral: true });
  }
}

export async function handleRating(interaction) {
  if (!interaction.customId.startsWith('ticket:rate:')) return false;
  
  const parts = interaction.customId.split(':');
  const rating = parseInt(parts[2]);
  const ticketChannelId = parts[3];
  const guildId = interaction.message.embeds[0]?.footer?.text || null;

  const guilds = interaction.client.guilds.cache;
  for (const [gId, guild] of guilds) {
    const ticket = getTicket(gId, ticketChannelId);
    if (ticket && ticket.claimedBy) {
      const stats = getTicketStats(gId);
      if (!stats.staffStats[ticket.claimedBy]) {
        stats.staffStats[ticket.claimedBy] = { claimed: 0, totalRating: 0, ratingCount: 0 };
      }
      stats.staffStats[ticket.claimedBy].totalRating += rating;
      stats.staffStats[ticket.claimedBy].ratingCount++;
      saveTicketStats(gId, stats);

      await interaction.update({ content: `Thank you for your feedback! You rated: ${'⭐'.repeat(rating)}`, embeds: [], components: [] });
      return true;
    }
  }

  await interaction.update({ content: 'Thank you for your feedback!', embeds: [], components: [] });
  return true;
}

async function logTicketAction(guild, config, action, ticket, user) {
  if (!config.logsChannelId) return;
  
  try {
    const logsChannel = await guild.channels.fetch(config.logsChannelId);
    if (!logsChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket ${action}`)
      .addFields(
        { name: 'Ticket', value: `<#${ticket.channelId}>`, inline: true },
        { name: 'By', value: user.tag, inline: true },
        { name: 'Opener', value: ticket.openerTag, inline: true }
      )
      .setColor('#5865F2')
      .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Log error:', err);
  }
}
