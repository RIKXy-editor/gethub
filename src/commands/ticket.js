import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

async function promptForInput(interaction, prompt, options = {}) {
  const { timeout = 60000, validator = null, deletePrompt = true } = options;
  
  const promptMsg = await interaction.reply({ 
    content: `${prompt}\n\n*Type your response below (or type \`cancel\` to cancel). You have 60 seconds.*`,
    ephemeral: false,
    fetchReply: true
  });

  const filter = m => m.author.id === interaction.user.id;
  
  try {
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: timeout, errors: ['time'] });
    const response = collected.first();
    
    if (deletePrompt) {
      await promptMsg.delete().catch(() => {});
      await response.delete().catch(() => {});
    }
    
    if (response.content.toLowerCase() === 'cancel') {
      return { cancelled: true, value: null };
    }
    
    if (validator) {
      const validationResult = await validator(response);
      if (!validationResult.valid) {
        await interaction.channel.send({ content: validationResult.error }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        return { cancelled: false, value: null, error: validationResult.error };
      }
      return { cancelled: false, value: validationResult.value };
    }
    
    return { cancelled: false, value: response.content.trim() };
  } catch (err) {
    await promptMsg.delete().catch(() => {});
    await interaction.channel.send({ content: '⏱️ Time ran out. Please click the button again to try.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    return { cancelled: true, value: null, timeout: true };
  }
}
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
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    const result = await promptForInput(interaction, '➕ **Add User to Ticket**\nMention the user or paste their user ID to add them to this ticket.\n\nExample: @username or paste user ID', {
      validator: async (msg) => {
        let userId = msg.content.trim();
        const mention = msg.mentions.users.first();
        if (mention) userId = mention.id;
        else userId = userId.replace(/[<@!>]/g, '');
        
        try {
          const member = await interaction.guild.members.fetch(userId);
          return { valid: true, value: member };
        } catch {
          return { valid: false, error: '❌ User not found. Please check and try again.' };
        }
      }
    });
    
    if (result.value) {
      await interaction.channel.permissionOverwrites.edit(result.value.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await interaction.channel.send({ content: `✅ Added ${result.value} to this ticket.` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      await logTicketAction(interaction.guild, config, `User Added: ${result.value.user.tag}`, ticket, interaction.user);
    }
  }

  if (customId === 'ticket:remove_user') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    const result = await promptForInput(interaction, '➖ **Remove User from Ticket**\nMention the user or paste their user ID to remove them from this ticket.\n\nExample: @username or paste user ID', {
      validator: async (msg) => {
        let userId = msg.content.trim();
        const mention = msg.mentions.users.first();
        if (mention) userId = mention.id;
        else userId = userId.replace(/[<@!>]/g, '');
        
        return { valid: true, value: userId };
      }
    });
    
    if (result.value) {
      try {
        await interaction.channel.permissionOverwrites.delete(result.value);
        await interaction.channel.send({ content: '✅ User removed from this ticket.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        await logTicketAction(interaction.guild, config, `User Removed: ${result.value}`, ticket, interaction.user);
      } catch {
        await interaction.channel.send({ content: '❌ Failed to remove user.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }
    }
  }

  if (customId === 'ticket:close') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    const result = await promptForInput(interaction, '🔒 **Close Ticket**\nType a reason for closing this ticket, or type `skip` to close without a reason.', {
      validator: async (msg) => {
        const reason = msg.content.trim();
        if (reason.toLowerCase() === 'skip') {
          return { valid: true, value: 'No reason provided' };
        }
        return { valid: true, value: reason };
      }
    });
    
    if (!result.cancelled && result.value) {
      ticket.status = 'closed';
      ticket.closedAt = Date.now();
      ticket.closeReason = result.value;
      saveTicket(guildId, interaction.channel.id, ticket);

      await interaction.channel.permissionOverwrites.edit(ticket.openerId, { ViewChannel: true, SendMessages: false });

      const closedEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by ${interaction.user}`)
        .addFields({ name: 'Reason', value: result.value })
        .setColor('#ff0000')
        .setTimestamp();

      const reopenRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📜')
      );

      await interaction.channel.send({ embeds: [closedEmbed], components: [reopenRow] });
      await logTicketAction(interaction.guild, config, `Closed - ${result.value}`, ticket, interaction.user);

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
    const result = await promptForInput(interaction, '📁 **Set Ticket Category**\nMention the category or paste the category ID where ticket channels should be created.\n\nExample: Type the category ID (right-click category > Copy ID)', {
      validator: async (msg) => {
        const input = msg.content.trim().replace(/[<#>]/g, '');
        try {
          const category = await interaction.guild.channels.fetch(input);
          if (category && category.type === 4) {
            return { valid: true, value: category };
          }
          return { valid: false, error: '❌ That\'s not a valid category. Make sure it\'s a category channel, not a text channel.' };
        } catch {
          return { valid: false, error: '❌ Category not found. Please check the ID and try again.' };
        }
      }
    });
    
    if (result.value) {
      setTicketConfig(guildId, { categoryId: result.value.id });
      await interaction.channel.send({ content: `✅ Ticket category set to **${result.value.name}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:setup_logs') {
    const result = await promptForInput(interaction, '📋 **Set Logs Channel**\nMention the channel or paste the channel ID where ticket logs should be sent.\n\nExample: #ticket-logs or paste the channel ID', {
      validator: async (msg) => {
        let channelId = msg.content.trim();
        const mention = msg.mentions.channels.first();
        if (mention) channelId = mention.id;
        else channelId = channelId.replace(/[<#>]/g, '');
        
        try {
          const channel = await interaction.guild.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            return { valid: true, value: channel };
          }
          return { valid: false, error: '❌ That\'s not a valid text channel.' };
        } catch {
          return { valid: false, error: '❌ Channel not found. Please check and try again.' };
        }
      }
    });
    
    if (result.value) {
      setTicketConfig(guildId, { logsChannelId: result.value.id });
      await interaction.channel.send({ content: `✅ Logs channel set to ${result.value}` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:setup_toggle_dm') {
    const newValue = !config.transcriptDm;
    setTicketConfig(guildId, { transcriptDm: newValue });
    await interaction.reply({ content: `✅ Transcript DM is now ${newValue ? 'enabled' : 'disabled'}.`, ephemeral: true });
  }

  if (customId === 'ticket:setup_limits') {
    const maxResult = await promptForInput(interaction, `🎟️ **Set Max Tickets Per User**\nHow many tickets can a user have open at once?\n\nCurrent: ${config.maxTicketsPerUser} (Enter a number 1-10)`, {
      validator: async (msg) => {
        const num = parseInt(msg.content.trim());
        if (isNaN(num) || num < 1 || num > 10) {
          return { valid: false, error: '❌ Please enter a number between 1 and 10.' };
        }
        return { valid: true, value: num };
      }
    });
    
    if (maxResult.cancelled) return;
    
    if (maxResult.value) {
      const cooldownResult = await promptForInput(interaction, `⏱️ **Set Cooldown**\nHow many seconds must a user wait between creating tickets?\n\nCurrent: ${config.cooldownSeconds}s (Enter 0-3600)`, {
        validator: async (msg) => {
          const num = parseInt(msg.content.trim());
          if (isNaN(num) || num < 0 || num > 3600) {
            return { valid: false, error: '❌ Please enter a number between 0 and 3600.' };
          }
          return { valid: true, value: num };
        }
      });
      
      if (cooldownResult.value !== null && cooldownResult.value !== undefined) {
        setTicketConfig(guildId, { maxTicketsPerUser: maxResult.value, cooldownSeconds: cooldownResult.value });
        await interaction.channel.send({ content: `✅ Limits updated: Max ${maxResult.value} ticket(s) per user, ${cooldownResult.value}s cooldown.` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }
    }
  }

  if (customId === 'ticket:setup_role') {
    const result = await promptForInput(interaction, '👥 **Set Support Role**\nMention the role or paste the role ID that should handle tickets.\n\nExample: @Support or paste the role ID', {
      validator: async (msg) => {
        let roleId = msg.content.trim();
        const mention = msg.mentions.roles.first();
        if (mention) roleId = mention.id;
        else roleId = roleId.replace(/[<@&>]/g, '');
        
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (role) {
            return { valid: true, value: role };
          }
          return { valid: false, error: '❌ Role not found.' };
        } catch {
          return { valid: false, error: '❌ Invalid role. Please check and try again.' };
        }
      }
    });
    
    if (result.value) {
      setTicketConfig(guildId, { supportRoleId: result.value.id });
      await interaction.channel.send({ content: `✅ Support role set to ${result.value}` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:setup_button') {
    const result = await promptForInput(interaction, `🔘 **Edit Button Label**\nWhat should the ticket button say?\n\nCurrent: ${config.buttonLabel || '📩 Open Ticket'}\n(Max 80 characters, you can use emojis)`, {
      validator: async (msg) => {
        const label = msg.content.trim();
        if (label.length > 80) {
          return { valid: false, error: '❌ Button label must be 80 characters or less.' };
        }
        if (label.length === 0) {
          return { valid: false, error: '❌ Button label cannot be empty.' };
        }
        return { valid: true, value: label };
      }
    });
    
    if (result.value) {
      setTicketConfig(guildId, { buttonLabel: result.value });
      await interaction.channel.send({ content: `✅ Button label updated to: **${result.value}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
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
    const result = await promptForInput(interaction, `📝 **Edit Panel Title**\nType the new title for your ticket panel.\n\nCurrent: ${panelEmbed.title || '🎫 Support Tickets'}\n(Max 256 characters)`, {
      validator: async (msg) => {
        const title = msg.content.trim();
        if (title.length > 256) {
          return { valid: false, error: '❌ Title must be 256 characters or less.' };
        }
        if (title.length === 0) {
          return { valid: false, error: '❌ Title cannot be empty.' };
        }
        return { valid: true, value: title };
      }
    });
    
    if (result.value) {
      panelEmbed.title = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: `✅ Panel title updated to: **${result.value}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:panel_desc') {
    const panelEmbed = config.panelEmbed || {};
    const result = await promptForInput(interaction, `📝 **Edit Panel Description**\nType the new description for your ticket panel.\n\nCurrent:\n${panelEmbed.description || 'Need help? Click the button below...'}\n\n(Max 4000 characters)`, {
      validator: async (msg) => {
        const desc = msg.content.trim();
        if (desc.length > 4000) {
          return { valid: false, error: '❌ Description must be 4000 characters or less.' };
        }
        if (desc.length === 0) {
          return { valid: false, error: '❌ Description cannot be empty.' };
        }
        return { valid: true, value: desc };
      }
    });
    
    if (result.value) {
      panelEmbed.description = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: '✅ Panel description updated!' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:panel_color') {
    const panelEmbed = config.panelEmbed || {};
    const result = await promptForInput(interaction, `🎨 **Edit Panel Color**\nType a hex color code for the panel.\n\nCurrent: ${panelEmbed.color || '#5865F2'}\nExample: #FF5733 or #5865F2`, {
      validator: async (msg) => {
        let color = msg.content.trim();
        if (!color.startsWith('#')) color = '#' + color;
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return { valid: false, error: '❌ Invalid hex color. Use format like #5865F2' };
        }
        return { valid: true, value: color };
      }
    });
    
    if (result.value) {
      panelEmbed.color = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: `✅ Panel color updated to: **${result.value}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:panel_footer') {
    const panelEmbed = config.panelEmbed || {};
    const result = await promptForInput(interaction, `📝 **Edit Panel Footer**\nType the footer text, or type \`none\` to remove it.\n\nCurrent: ${panelEmbed.footer || '(no footer)'}\n(Max 2048 characters)`, {
      validator: async (msg) => {
        const footer = msg.content.trim();
        if (footer.toLowerCase() === 'none') {
          return { valid: true, value: null };
        }
        if (footer.length > 2048) {
          return { valid: false, error: '❌ Footer must be 2048 characters or less.' };
        }
        return { valid: true, value: footer };
      }
    });
    
    if (!result.cancelled) {
      panelEmbed.footer = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: result.value ? '✅ Panel footer updated!' : '✅ Panel footer removed.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:panel_thumb') {
    const panelEmbed = config.panelEmbed || {};
    const result = await promptForInput(interaction, `🖼️ **Set Panel Thumbnail**\nPaste the URL of a small image for the thumbnail, or type \`none\` to remove it.\n\nCurrent: ${panelEmbed.thumbnail || '(no thumbnail)'}`, {
      validator: async (msg) => {
        const url = msg.content.trim();
        if (url.toLowerCase() === 'none') {
          return { valid: true, value: null };
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return { valid: false, error: '❌ Invalid URL. Must start with http:// or https://' };
        }
        return { valid: true, value: url };
      }
    });
    
    if (!result.cancelled) {
      panelEmbed.thumbnail = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: result.value ? '✅ Panel thumbnail set!' : '✅ Panel thumbnail removed.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:panel_image') {
    const panelEmbed = config.panelEmbed || {};
    const result = await promptForInput(interaction, `🖼️ **Set Panel Image**\nPaste the URL of a large image for the panel, or type \`none\` to remove it.\n\nCurrent: ${panelEmbed.image || '(no image)'}`, {
      validator: async (msg) => {
        const url = msg.content.trim();
        if (url.toLowerCase() === 'none') {
          return { valid: true, value: null };
        }
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return { valid: false, error: '❌ Invalid URL. Must start with http:// or https://' };
        }
        return { valid: true, value: url };
      }
    });
    
    if (!result.cancelled) {
      panelEmbed.image = result.value;
      setTicketConfig(guildId, { panelEmbed });
      await interaction.channel.send({ content: result.value ? '✅ Panel image set!' : '✅ Panel image removed.' }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
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
