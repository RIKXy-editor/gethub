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
    ticketEmbed: {
      title: '🎫 Support Ticket',
      description: 'Welcome {user}!\n\nPlease select your subscription plan below.'
    },
    subscriptionPlans: [
      { name: '1 Month', priceINR: '₹595', priceUSD: '$8' },
      { name: '3 Months', priceINR: '₹1785', priceUSD: '$25' },
      { name: '6 Months', priceINR: '₹2889', priceUSD: '$40' },
      { name: '1 Year', priceINR: '₹5499', priceUSD: '$70' }
    ],
    paymentMethods: {
      upi: { name: 'UPI (Recommended)', embed: { title: '💳 UPI Payment', description: 'Please pay using the UPI ID below and upload screenshot.', color: '#00ff00' } },
      card: { name: 'Card (Recommended)', embed: { title: '💳 Card Payment', description: 'Please use the payment link below.', color: '#0099ff' } },
      paypal: { name: 'PayPal', embed: { title: '💰 PayPal Payment', description: 'Please send payment to our PayPal.', color: '#003087' } },
      crypto: { name: 'Crypto', embed: { title: '🪙 Crypto Payment', description: 'Please send crypto to the wallet address below.', color: '#f7931a' } }
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
  const ticket = tickets[channelId] || null;
  console.log(`[TICKET] Getting ticket for channel ${channelId} in guild ${guildId}: ${ticket ? 'FOUND' : 'NOT FOUND'}`);
  return ticket;
}

function saveTicket(guildId, channelId, ticketData) {
  const tickets = loadData('tickets', {});
  if (!tickets[guildId]) tickets[guildId] = {};
  tickets[guildId][channelId] = ticketData;
  saveData('tickets', tickets);
  console.log(`[TICKET] Saved ticket for channel ${channelId} in guild ${guildId}`);
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
        { name: '🔘 Button Label', value: config.buttonLabel || '📩 Open Ticket', inline: true },
        { name: '🎨 Button Color', value: config.buttonColor || 'Primary (Blue)', inline: true }
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
      new ButtonBuilder().setCustomId('ticket:setup_button_color').setLabel('Edit Button Color').setStyle(ButtonStyle.Secondary)
    );

    const buttons3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:setup_embed').setLabel('Edit Panel Embed').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:setup_ticket_embed').setLabel('Edit Ticket Embed').setStyle(ButtonStyle.Primary)
    );

    const buttons4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:setup_plans').setLabel('Edit Subscription Plans').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:setup_payments').setLabel('Edit Payment Methods').setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [buttons1, buttons2, buttons3, buttons4], ephemeral: true });
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

    const buttonStyleMap = {
      'Primary': ButtonStyle.Primary,
      'Secondary': ButtonStyle.Secondary,
      'Success': ButtonStyle.Success,
      'Danger': ButtonStyle.Danger
    };
    const buttonStyle = buttonStyleMap[config.buttonStyle] || ButtonStyle.Primary;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel(config.buttonLabel || '📩 Open Ticket')
        .setStyle(buttonStyle)
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
    console.log(`[TICKET] ticket:open triggered by ${interaction.user.tag} in guild ${guildId}`);
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
      const existingTickets = getTickets(guildId);
      const usedNumbers = new Set(Object.values(existingTickets).map(t => t.ticketNumber).filter(n => n));
      let ticketNumber;
      let attempts = 0;
      do {
        ticketNumber = Math.floor(Math.random() * 1000) + 1;
        attempts++;
      } while (usedNumbers.has(ticketNumber) && attempts < 100);
      
      if (attempts >= 100) {
        ticketNumber = Date.now() % 10000;
      }
      
      const threadName = `ticket-${ticketNumber}`;
      
      const category = await interaction.guild.channels.fetch(config.categoryId);
      if (!category) {
        return await interaction.editReply({ content: '❌ Ticket category not found. Please contact an admin.' });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: threadName,
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
        ticketNumber: ticketNumber,
        createdAt: Date.now(),
        claimedBy: null,
        status: 'open',
        selectedPlan: null,
        selectedPayment: null
      };

      console.log(`[TICKET] About to save ticket for channel ${ticketChannel.id}`);
      saveTicket(guildId, ticketChannel.id, ticketData);
      console.log(`[TICKET] Ticket saved successfully`);
      setUserCooldown(guildId, interaction.user.id);

      const ticketEmbed = config.ticketEmbed || {};
      const ticketTitle = ticketEmbed.title || '🎫 Support Ticket';
      const ticketDesc = (ticketEmbed.description || 'Welcome {user}!\n\nPlease select your subscription plan below.')
        .replace(/{user}/g, interaction.user.toString());

      const controlEmbed = new EmbedBuilder()
        .setTitle(ticketTitle)
        .setDescription(ticketDesc)
        .addFields(
          { name: 'Ticket #', value: String(ticketNumber), inline: true },
          { name: 'Opened by', value: interaction.user.tag, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      const staffButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✋'),
        new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('ticket:add_user').setLabel('Add User').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('ticket:remove_user').setLabel('Remove User').setStyle(ButtonStyle.Primary).setEmoji('➖')
      );

      const staffButtons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📜')
      );

      await ticketChannel.send({ content: `<@&${config.supportRoleId}>`, embeds: [controlEmbed], components: [staffButtons, staffButtons2] });

      const plans = config.subscriptionPlans || [];
      const planEmbed = new EmbedBuilder()
        .setTitle('📦 Select Your Subscription Plan')
        .setDescription(`${interaction.user}, please choose your subscription plan:\n\n` + 
          plans.map((p, i) => `**${i + 1}.** ${p.name} – ${p.priceINR} / ${p.priceUSD} (PayPal)`).join('\n'))
        .setColor('#5865F2');

      const planRows = [];
      let currentRow = new ActionRowBuilder();
      plans.forEach((p, i) => {
        if (currentRow.components.length >= 5) {
          planRows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket:plan:${i}`)
            .setLabel(p.name)
            .setStyle(ButtonStyle.Primary)
        );
      });
      if (currentRow.components.length > 0) {
        planRows.push(currentRow);
      }

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [planEmbed], components: planRows });

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
        new ButtonBuilder().setCustomId('ticket:transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📜'),
        new ButtonBuilder().setCustomId('ticket:delete').setLabel('Delete Channel').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
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

  if (customId.startsWith('ticket:plan:')) {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    
    if (interaction.user.id !== ticket.openerId) {
      return await interaction.reply({ content: '❌ Only the ticket opener can select a plan.', ephemeral: true });
    }

    const planIndex = parseInt(customId.split(':')[2]);
    const plans = config.subscriptionPlans || [];
    const selectedPlan = plans[planIndex];
    
    if (!selectedPlan) {
      return await interaction.reply({ content: '❌ Invalid plan selection.', ephemeral: true });
    }

    ticket.selectedPlan = selectedPlan.name;
    saveTicket(guildId, interaction.channel.id, ticket);

    await interaction.message.edit({ components: [] });

    const paymentEmbed = new EmbedBuilder()
      .setTitle('💳 Select Payment Method')
      .setDescription(`${interaction.user}, you selected **${selectedPlan.name}** (${selectedPlan.priceINR} / ${selectedPlan.priceUSD})\n\nPlease choose your payment method:`)
      .setColor('#5865F2');

    const paymentButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:payment:upi').setLabel('UPI (Recommended)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:payment:card').setLabel('Card (Recommended)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:payment:paypal').setLabel('PayPal').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:payment:crypto').setLabel('Crypto').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ content: `${interaction.user}`, embeds: [paymentEmbed], components: [paymentButtons] });
  }

  if (customId.startsWith('ticket:payment:')) {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    
    if (interaction.user.id !== ticket.openerId) {
      return await interaction.reply({ content: '❌ Only the ticket opener can select a payment method.', ephemeral: true });
    }

    const paymentKey = customId.split(':')[2];
    const paymentMethods = config.paymentMethods || {};
    const paymentInfo = paymentMethods[paymentKey];
    
    if (!paymentInfo) {
      return await interaction.reply({ content: '❌ Invalid payment method.', ephemeral: true });
    }

    ticket.selectedPayment = paymentKey;
    saveTicket(guildId, interaction.channel.id, ticket);

    await interaction.message.edit({ components: [] });

    const paymentEmbed = new EmbedBuilder()
      .setTitle(paymentInfo.embed?.title || `💳 ${paymentInfo.name} Payment`)
      .setDescription(paymentInfo.embed?.description || 'Please follow the payment instructions.')
      .setColor(paymentInfo.embed?.color || '#5865F2');

    const actionButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:paid').setLabel('✅ I have Paid').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:doubt').setLabel('❓ Have a Doubt').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ content: `${interaction.user}`, embeds: [paymentEmbed], components: [actionButtons] });
  }

  if (customId === 'ticket:paid') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
    
    if (interaction.user.id !== ticket.openerId) {
      return await interaction.reply({ content: '❌ Only the ticket opener can confirm payment.', ephemeral: true });
    }

    await interaction.message.edit({ components: [] });

    const result = await promptForInput(interaction, `📧 **Email Confirmation**\n${interaction.user}, please enter your email address for your subscription:`, {
      validator: async (msg) => {
        const email = msg.content.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return { valid: false, error: '❌ Please enter a valid email address.' };
        }
        return { valid: true, value: email };
      }
    });
    
    if (result.value) {
      ticket.email = result.value;
      saveTicket(guildId, interaction.channel.id, ticket);

      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Payment Received')
        .setDescription(`Thank you ${interaction.user}!\n\nYour subscription will be activated within **2 hours**.\n\n📧 Email: ${result.value}\n📦 Plan: ${ticket.selectedPlan || 'N/A'}`)
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.channel.send({ embeds: [confirmEmbed] });
      await logTicketAction(interaction.guild, config, `Payment confirmed - Email: ${result.value}, Plan: ${ticket.selectedPlan}`, ticket, interaction.user);
    }
  }

  if (customId === 'ticket:doubt') {
    const ticket = getTicket(guildId, interaction.channel.id);
    if (!ticket) return await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });

    await interaction.message.edit({ components: [] });

    const doubtEmbed = new EmbedBuilder()
      .setTitle('❓ Question Received')
      .setDescription(`${interaction.user}, please wait. An admin will join the chat shortly to assist you.`)
      .setColor('#FFA500')
      .setTimestamp();

    await interaction.reply({ content: `<@&${config.supportRoleId}>`, embeds: [doubtEmbed] });
  }

  if (customId === 'ticket:delete') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const hasRole = member.roles.cache.has(config.supportRoleId);
    
    if (!hasRole && !member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ Only staff can delete ticket channels.', ephemeral: true });
    }

    await interaction.reply({ content: '🗑️ Deleting this ticket channel in 5 seconds...' });
    setTimeout(async () => {
      try {
        deleteTicket(guildId, interaction.channel.id);
        await interaction.channel.delete();
      } catch (err) {
        console.error('Failed to delete channel:', err);
      }
    }, 5000);
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

  if (customId === 'ticket:setup_button_color') {
    const colorOptions = {
      '1': { name: 'Primary (Blue)', style: 'Primary' },
      '2': { name: 'Secondary (Gray)', style: 'Secondary' },
      '3': { name: 'Success (Green)', style: 'Success' },
      '4': { name: 'Danger (Red)', style: 'Danger' }
    };
    
    const result = await promptForInput(interaction, `🎨 **Edit Button Color**\nChoose a color for the ticket button:\n\n**1** - Primary (Blue)\n**2** - Secondary (Gray)\n**3** - Success (Green)\n**4** - Danger (Red)\n\nCurrent: ${config.buttonColor || 'Primary (Blue)'}\n\nType a number (1-4):`, {
      validator: async (msg) => {
        const choice = msg.content.trim();
        if (!colorOptions[choice]) {
          return { valid: false, error: '❌ Please type a number 1-4.' };
        }
        return { valid: true, value: colorOptions[choice] };
      }
    });
    
    if (result.value) {
      setTicketConfig(guildId, { buttonColor: result.value.name, buttonStyle: result.value.style });
      await interaction.channel.send({ content: `✅ Button color updated to: **${result.value.name}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
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

  if (customId === 'ticket:setup_ticket_embed') {
    const ticketEmbed = config.ticketEmbed || {};
    
    const previewEmbed = new EmbedBuilder()
      .setTitle(ticketEmbed.title || '🎫 Support Ticket')
      .setDescription((ticketEmbed.description || 'Welcome {user}!\n\nPlease describe your issue...').replace(/{user}/g, interaction.user.toString()))
      .addFields(
        { name: 'Opened by', value: interaction.user.tag, inline: true },
        { name: 'Status', value: '🟢 Open', inline: true }
      )
      .setColor('#00ff00')
      .setTimestamp();

    const buttons1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:ticket_title').setLabel('Edit Title').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:ticket_desc').setLabel('Edit Description').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ 
      content: '**Ticket Opening Embed Preview:**\nThis is what users see when they open a ticket.\nUse `{user}` in the description to mention the ticket opener.',
      embeds: [previewEmbed], 
      components: [buttons1], 
      ephemeral: true 
    });
  }

  if (customId === 'ticket:ticket_title') {
    const ticketEmbed = config.ticketEmbed || {};
    const result = await promptForInput(interaction, `📝 **Edit Ticket Title**\nType the new title for the ticket opening embed.\n\nCurrent: ${ticketEmbed.title || '🎫 Support Ticket'}\n(Max 256 characters)`, {
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
      ticketEmbed.title = result.value;
      setTicketConfig(guildId, { ticketEmbed });
      await interaction.channel.send({ content: `✅ Ticket title updated to: **${result.value}**` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:ticket_desc') {
    const ticketEmbed = config.ticketEmbed || {};
    const result = await promptForInput(interaction, `📝 **Edit Ticket Description**\nType the new description for the ticket opening embed.\n\nUse \`{user}\` to mention the ticket opener.\n\nCurrent:\n${ticketEmbed.description || 'Welcome {user}!\\n\\nPlease describe your issue...'}\n\n(Max 4000 characters)`, {
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
      ticketEmbed.description = result.value;
      setTicketConfig(guildId, { ticketEmbed });
      await interaction.channel.send({ content: `✅ Ticket description updated!` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
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

      const buttonStyleMap = {
        'Primary': ButtonStyle.Primary,
        'Secondary': ButtonStyle.Secondary,
        'Success': ButtonStyle.Success,
        'Danger': ButtonStyle.Danger
      };
      const buttonStyle = buttonStyleMap[config.buttonStyle] || ButtonStyle.Primary;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open')
          .setLabel(config.buttonLabel || '📩 Open Ticket')
          .setStyle(buttonStyle)
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

  if (customId === 'ticket:setup_plans') {
    const plans = config.subscriptionPlans || [];
    const planList = plans.map((p, i) => `**${i + 1}.** ${p.name} – ${p.priceINR} / ${p.priceUSD}`).join('\n');

    const planEmbed = new EmbedBuilder()
      .setTitle('📦 Subscription Plans')
      .setDescription(`Current plans:\n\n${planList}\n\nClick a button to edit a plan.`)
      .setColor('#5865F2');

    const planRows = [];
    let currentRow = new ActionRowBuilder();
    plans.forEach((p, i) => {
      if (currentRow.components.length >= 5) {
        planRows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder().setCustomId(`ticket:edit_plan:${i}`).setLabel(`Edit ${p.name}`).setStyle(ButtonStyle.Primary)
      );
    });
    if (currentRow.components.length > 0) {
      planRows.push(currentRow);
    }

    await interaction.reply({ embeds: [planEmbed], components: planRows, ephemeral: true });
  }

  if (customId.startsWith('ticket:edit_plan:')) {
    const planIndex = parseInt(customId.split(':')[2]);
    const plans = config.subscriptionPlans || [];
    const plan = plans[planIndex];
    
    if (!plan) return await interaction.reply({ content: '❌ Plan not found.', ephemeral: true });

    const result = await promptForInput(interaction, `📦 **Edit Plan: ${plan.name}**\n\nEnter new pricing in format:\n\`Name | INR Price | USD Price\`\n\nExample: \`1 Month | ₹595 | $8\`\n\nCurrent: ${plan.name} | ${plan.priceINR} | ${plan.priceUSD}`, {
      validator: async (msg) => {
        const parts = msg.content.split('|').map(p => p.trim());
        if (parts.length !== 3) {
          return { valid: false, error: '❌ Please use format: Name | INR Price | USD Price' };
        }
        return { valid: true, value: { name: parts[0], priceINR: parts[1], priceUSD: parts[2] } };
      }
    });
    
    if (result.value) {
      plans[planIndex] = result.value;
      setTicketConfig(guildId, { subscriptionPlans: plans });
      await interaction.channel.send({ content: `✅ Plan updated: **${result.value.name}** – ${result.value.priceINR} / ${result.value.priceUSD}` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId === 'ticket:setup_payments') {
    const methods = config.paymentMethods || {};
    
    const methodEmbed = new EmbedBuilder()
      .setTitle('💳 Payment Methods')
      .setDescription('Edit the embed that appears for each payment method.')
      .setColor('#5865F2');

    const methodButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:edit_payment:upi').setLabel('Edit UPI').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:edit_payment:card').setLabel('Edit Card').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:edit_payment:paypal').setLabel('Edit PayPal').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:edit_payment:crypto').setLabel('Edit Crypto').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [methodEmbed], components: [methodButtons], ephemeral: true });
  }

  if (customId.startsWith('ticket:edit_payment:')) {
    const paymentKey = customId.split(':')[2];
    const defaultMethods = {
      upi: { name: 'UPI (Recommended)', embed: { title: '💳 UPI Payment', description: 'Please pay using the UPI ID below and upload screenshot.', color: '#00ff00' } },
      card: { name: 'Card (Recommended)', embed: { title: '💳 Card Payment', description: 'Please use the payment link below.', color: '#0099ff' } },
      paypal: { name: 'PayPal', embed: { title: '💰 PayPal Payment', description: 'Please send payment to our PayPal.', color: '#003087' } },
      crypto: { name: 'Crypto', embed: { title: '🪙 Crypto Payment', description: 'Please send crypto to the wallet address below.', color: '#f7931a' } }
    };
    const methods = config.paymentMethods || {};
    const method = methods[paymentKey] || defaultMethods[paymentKey];
    
    if (!method) return await interaction.reply({ content: '❌ Payment method not found.', ephemeral: true });
    
    if (!methods[paymentKey]) {
      methods[paymentKey] = method;
      setTicketConfig(guildId, { paymentMethods: methods });
    }

    const previewEmbed = new EmbedBuilder()
      .setTitle(method.embed?.title || `💳 ${method.name}`)
      .setDescription(method.embed?.description || 'Payment instructions here.')
      .setColor(method.embed?.color || '#5865F2');

    const editButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:payment_title:${paymentKey}`).setLabel('Edit Title').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket:payment_desc:${paymentKey}`).setLabel('Edit Description').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket:payment_color:${paymentKey}`).setLabel('Edit Color').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ content: `**${method.name} Embed Preview:**`, embeds: [previewEmbed], components: [editButtons], ephemeral: true });
  }

  if (customId.startsWith('ticket:payment_title:')) {
    const paymentKey = customId.split(':')[2];
    const methods = config.paymentMethods || {};
    const method = methods[paymentKey];
    
    const result = await promptForInput(interaction, `📝 **Edit ${method.name} Title**\nType the new title for this payment method embed.\n\nCurrent: ${method.embed?.title || '(default)'}`, {
      validator: async (msg) => {
        const title = msg.content.trim();
        if (title.length > 256) return { valid: false, error: '❌ Title must be 256 characters or less.' };
        return { valid: true, value: title };
      }
    });
    
    if (result.value) {
      if (!method.embed) method.embed = {};
      method.embed.title = result.value;
      methods[paymentKey] = method;
      setTicketConfig(guildId, { paymentMethods: methods });
      await interaction.channel.send({ content: `✅ ${method.name} title updated!` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId.startsWith('ticket:payment_desc:')) {
    const paymentKey = customId.split(':')[2];
    const methods = config.paymentMethods || {};
    const method = methods[paymentKey];
    
    const result = await promptForInput(interaction, `📝 **Edit ${method.name} Description**\nType the new description/instructions for this payment method.\n\nCurrent:\n${method.embed?.description || '(default)'}`, {
      validator: async (msg) => {
        const desc = msg.content.trim();
        if (desc.length > 4000) return { valid: false, error: '❌ Description must be 4000 characters or less.' };
        return { valid: true, value: desc };
      }
    });
    
    if (result.value) {
      if (!method.embed) method.embed = {};
      method.embed.description = result.value;
      methods[paymentKey] = method;
      setTicketConfig(guildId, { paymentMethods: methods });
      await interaction.channel.send({ content: `✅ ${method.name} description updated!` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (customId.startsWith('ticket:payment_color:')) {
    const paymentKey = customId.split(':')[2];
    const methods = config.paymentMethods || {};
    const method = methods[paymentKey];
    
    const result = await promptForInput(interaction, `🎨 **Edit ${method.name} Color**\nType a hex color code (e.g., #00ff00, #5865F2).\n\nCurrent: ${method.embed?.color || '#5865F2'}`, {
      validator: async (msg) => {
        const color = msg.content.trim();
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return { valid: false, error: '❌ Invalid hex color. Use format like #00ff00' };
        }
        return { valid: true, value: color };
      }
    });
    
    if (result.value) {
      if (!method.embed) method.embed = {};
      method.embed.color = result.value;
      methods[paymentKey] = method;
      setTicketConfig(guildId, { paymentMethods: methods });
      await interaction.channel.send({ content: `✅ ${method.name} color updated to ${result.value}!` }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
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
