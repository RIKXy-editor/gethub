import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';
import { generateTranscript } from '../utils/transcript.js';

function getTicketConfig(guildId) {
  const configs = loadData('ticketConfig', {});
  return configs[guildId] || {
    categoryId: null,
    logsChannelId: null,
    transcriptDm: true,
    maxTicketsPerUser: 1,
    cooldownSeconds: 60,
    categories: []
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

function getUserOpenTickets(guildId, userId, category) {
  const tickets = getTickets(guildId);
  return Object.values(tickets).filter(t => 
    t.openerId === userId && t.category === category && t.status !== 'closed'
  ).length;
}

function generateShortId() {
  return Math.random().toString(36).substring(2, 6);
}

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket system management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName('panel').setDescription('Post the ticket panel in a channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post panel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand(sub => sub.setName('setup').setDescription('Configure the ticket system'))
  .addSubcommand(sub => sub.setName('setlogs').setDescription('Set the ticket logs channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Logs channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand(sub => sub.setName('setcategory').setDescription('Set Discord category for ticket channels')
    .addChannelOption(opt => opt.setName('category').setDescription('Category channel').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
  .addSubcommand(sub => sub.setName('addtype').setDescription('Add a ticket type/category')
    .addStringOption(opt => opt.setName('name').setDescription('Category name').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Support role for this category').setRequired(true))
    .addStringOption(opt => opt.setName('emoji').setDescription('Emoji for this category').setRequired(false)))
  .addSubcommand(sub => sub.setName('removetype').setDescription('Remove a ticket type')
    .addStringOption(opt => opt.setName('name').setDescription('Category name to remove').setRequired(true)))
  .addSubcommand(sub => sub.setName('listtypes').setDescription('List all ticket types'))
  .addSubcommand(sub => sub.setName('stats').setDescription('View staff ticket statistics'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const config = getTicketConfig(guildId);

  if (subcommand === 'panel') {
    const channel = interaction.options.getChannel('channel');
    
    if (config.categories.length === 0) {
      return await interaction.reply({ content: '❌ No ticket categories configured. Use `/ticket addtype` first.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Select a category below to create a support ticket.\n\nOur team will assist you as soon as possible.')
      .setColor('#5865F2')
      .setFooter({ text: 'Select a category from the dropdown to open a ticket' });

    const selectOptions = config.categories.map(cat => ({
      label: cat.name,
      value: cat.name.toLowerCase().replace(/\s+/g, '-'),
      emoji: cat.emoji || '📩',
      description: `Open a ${cat.name} ticket`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket:select_category')
      .setPlaceholder('Select ticket category...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket panel posted in ${channel}`, ephemeral: true });
  }

  if (subcommand === 'setup') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket System Setup')
      .setDescription('Current configuration:')
      .addFields(
        { name: '📁 Ticket Category', value: config.categoryId ? `<#${config.categoryId}>` : 'Not set', inline: true },
        { name: '📋 Logs Channel', value: config.logsChannelId ? `<#${config.logsChannelId}>` : 'Not set', inline: true },
        { name: '📩 DM Transcripts', value: config.transcriptDm ? 'Enabled' : 'Disabled', inline: true },
        { name: '🎟️ Max Tickets/User', value: String(config.maxTicketsPerUser), inline: true },
        { name: '⏱️ Cooldown', value: `${config.cooldownSeconds}s`, inline: true },
        { name: '📑 Categories', value: config.categories.length > 0 ? config.categories.map(c => `${c.emoji || '📩'} ${c.name}`).join('\n') : 'None', inline: true }
      )
      .setColor('#5865F2');

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:setup_category').setLabel('Set Category').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:setup_logs').setLabel('Set Logs').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:setup_toggle_dm').setLabel('Toggle DM').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:setup_limits').setLabel('Set Limits').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
  }

  if (subcommand === 'setlogs') {
    const channel = interaction.options.getChannel('channel');
    setTicketConfig(guildId, { logsChannelId: channel.id });
    await interaction.reply({ content: `✅ Ticket logs channel set to ${channel}`, ephemeral: true });
  }

  if (subcommand === 'setcategory') {
    const category = interaction.options.getChannel('category');
    setTicketConfig(guildId, { categoryId: category.id });
    await interaction.reply({ content: `✅ Ticket channels will be created in ${category.name}`, ephemeral: true });
  }

  if (subcommand === 'addtype') {
    const name = interaction.options.getString('name');
    const role = interaction.options.getRole('role');
    const emoji = interaction.options.getString('emoji') || '📩';
    
    const categories = [...config.categories];
    const existing = categories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    
    if (existing >= 0) {
      categories[existing] = { name, roleId: role.id, emoji };
    } else {
      categories.push({ name, roleId: role.id, emoji });
    }
    
    setTicketConfig(guildId, { categories });
    await interaction.reply({ content: `✅ Ticket category "${emoji} ${name}" added with support role ${role}`, ephemeral: true });
  }

  if (subcommand === 'removetype') {
    const name = interaction.options.getString('name');
    const categories = config.categories.filter(c => c.name.toLowerCase() !== name.toLowerCase());
    
    if (categories.length === config.categories.length) {
      return await interaction.reply({ content: `❌ Category "${name}" not found.`, ephemeral: true });
    }
    
    setTicketConfig(guildId, { categories });
    await interaction.reply({ content: `✅ Ticket category "${name}" removed.`, ephemeral: true });
  }

  if (subcommand === 'listtypes') {
    if (config.categories.length === 0) {
      return await interaction.reply({ content: '📑 No ticket categories configured.', ephemeral: true });
    }
    
    const list = config.categories.map((c, i) => 
      `${i + 1}. ${c.emoji || '📩'} **${c.name}** - <@&${c.roleId}>`
    ).join('\n');
    
    await interaction.reply({ content: `📑 **Ticket Categories:**\n\n${list}`, ephemeral: true });
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

  if (customId === 'ticket:select_category' && interaction.isStringSelectMenu()) {
    const categoryValue = interaction.values[0];
    const category = config.categories.find(c => c.name.toLowerCase().replace(/\s+/g, '-') === categoryValue);
    
    if (!category) {
      return await interaction.reply({ content: '❌ Invalid category selected.', ephemeral: true });
    }

    const cooldownExpiry = getUserCooldown(guildId, interaction.user.id);
    const timeLeft = Math.ceil((cooldownExpiry + (config.cooldownSeconds * 1000) - Date.now()) / 1000);
    
    if (timeLeft > 0) {
      return await interaction.reply({ content: `⏱️ Please wait ${timeLeft} seconds before creating another ticket.`, ephemeral: true });
    }

    const openTickets = getUserOpenTickets(guildId, interaction.user.id, category.name);
    if (openTickets >= config.maxTicketsPerUser) {
      return await interaction.reply({ content: `❌ You already have ${openTickets} open ticket(s) in this category.`, ephemeral: true });
    }

    if (!config.categoryId) {
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
          { id: category.roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ]
      });

      const ticketData = {
        openerId: interaction.user.id,
        openerTag: interaction.user.tag,
        channelId: ticketChannel.id,
        category: category.name,
        createdAt: Date.now(),
        claimedBy: null,
        status: 'open'
      };

      saveTicket(guildId, ticketChannel.id, ticketData);
      setUserCooldown(guildId, interaction.user.id);

      const controlEmbed = new EmbedBuilder()
        .setTitle(`🎫 ${category.name} Ticket`)
        .setDescription(`Welcome ${interaction.user}!\n\nPlease describe your issue and our support team will assist you shortly.`)
        .addFields(
          { name: 'Category', value: category.name, inline: true },
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

      await ticketChannel.send({ content: `${interaction.user} <@&${category.roleId}>`, embeds: [controlEmbed], components: [buttons1, buttons2] });

      if (config.logsChannelId) {
        const logsChannel = await interaction.guild.channels.fetch(config.logsChannelId).catch(() => null);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Created')
            .addFields(
              { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
              { name: 'Category', value: category.name, inline: true },
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
          new TextInputBuilder().setCustomId('max_tickets').setLabel('Max tickets per user per category').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.maxTicketsPerUser))
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cooldown').setLabel('Cooldown in seconds').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.cooldownSeconds))
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
