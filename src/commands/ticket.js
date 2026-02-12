import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder } from 'discord.js';
import { Guild, Panel, Plan, PaymentMethod } from '../db/models.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket system management')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub.setName('setup').setDescription('Configure ticket system settings')
    .addChannelOption(opt => opt.setName('category').setDescription('Category for ticket channels').addChannelTypes(ChannelType.GuildCategory))
    .addChannelOption(opt => opt.setName('logs').setDescription('Channel for ticket logs').addChannelTypes(ChannelType.GuildText))
    .addRoleOption(opt => opt.setName('staff-role').setDescription('Staff role for ticket access'))
  )
  .addSubcommand(sub => sub.setName('panel').setDescription('Post a ticket panel in a channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post the panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Panel title (default: Support Tickets)'))
    .addStringOption(opt => opt.setName('description').setDescription('Panel description'))
    .addStringOption(opt => opt.setName('color').setDescription('Embed color hex (e.g. #5865F2)'))
    .addStringOption(opt => opt.setName('button-label').setDescription('Button text (default: Open Ticket)'))
    .addStringOption(opt => opt.setName('button-emoji').setDescription('Button emoji (e.g. 📩)'))
  )
  .addSubcommand(sub => sub.setName('stats').setDescription('View ticket statistics'));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const category = interaction.options.getChannel('category');
    const logs = interaction.options.getChannel('logs');
    const staffRole = interaction.options.getRole('staff-role');

    let guild = await Guild.get(guildId);
    if (!guild) {
      await Guild.create(guildId);
      guild = await Guild.get(guildId);
    }

    const updates = {};
    if (category) updates.ticket_category_id = category.id;
    if (logs) updates.logs_channel_id = logs.id;
    if (staffRole) updates.staff_role_ids = [staffRole.id];

    if (Object.keys(updates).length > 0) {
      await Guild.update(guildId, updates);
      guild = await Guild.get(guildId);
    }

    const plans = await Plan.getAll(guildId);
    const methods = await PaymentMethod.getAll(guildId);

    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket System Setup')
      .setDescription('Current configuration for your ticket system.')
      .addFields(
        { name: '📁 Ticket Category', value: guild?.ticket_category_id ? `<#${guild.ticket_category_id}>` : '❌ Not set — use `/ticket setup category:#channel`', inline: true },
        { name: '📋 Logs Channel', value: guild?.logs_channel_id ? `<#${guild.logs_channel_id}>` : '❌ Not set', inline: true },
        { name: '👥 Staff Role', value: guild?.staff_role_ids?.length ? guild.staff_role_ids.map(r => `<@&${r}>`).join(', ') : '❌ Not set', inline: true },
        { name: '📦 Plans', value: plans.length > 0 ? plans.map(p => `${p.enabled ? '✅' : '❌'} **${p.name}** — ₹${p.price}`).join('\n') : 'No plans — add via dashboard', inline: false },
        { name: '💳 Payment Methods', value: methods.length > 0 ? methods.map(m => `${m.enabled ? '✅' : '❌'} ${m.emoji || ''} **${m.label}**`).join('\n') : 'No methods — add via dashboard', inline: false }
      )
      .setColor('#5865F2')
      .setTimestamp();

    let statusMsg = '';
    if (Object.keys(updates).length > 0) {
      const changed = [];
      if (category) changed.push(`Category → ${category}`);
      if (logs) changed.push(`Logs → ${logs}`);
      if (staffRole) changed.push(`Staff Role → ${staffRole}`);
      statusMsg = `✅ Updated: ${changed.join(', ')}\n\n`;
    }

    await interaction.reply({ content: statusMsg || null, embeds: [embed], ephemeral: true });
  }

  if (subcommand === 'panel') {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title') || 'Support Tickets';
    const description = interaction.options.getString('description') || 'Click the button below to open a ticket.\n\nOur team will assist you as soon as possible.';
    const color = interaction.options.getString('color') || '#5865F2';
    const buttonLabel = interaction.options.getString('button-label') || 'Open Ticket';
    const buttonEmoji = interaction.options.getString('button-emoji') || '📩';

    let guild = await Guild.get(guildId);
    if (!guild) {
      await Guild.create(guildId);
      guild = await Guild.get(guildId);
    }

    if (!guild?.ticket_category_id) {
      return interaction.reply({ content: '❌ Please set a ticket category first using `/ticket setup category:#your-category`', ephemeral: true });
    }

    if (!guild?.staff_role_ids?.length) {
      return interaction.reply({ content: '❌ Please set a staff role first using `/ticket setup staff-role:@your-role`', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const panel = await Panel.create({
        guild_id: guildId,
        channel_id: channel.id,
        title,
        description,
        color,
        button_label: buttonLabel,
        button_emoji: buttonEmoji,
        button_color: 'Primary',
        category_id: guild.ticket_category_id,
        staff_role_id: guild.staff_role_ids[0],
        logs_channel_id: guild.logs_channel_id,
        enabled: true
      });

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);

      const btn = new ButtonBuilder()
        .setCustomId(`ticket:open:${panel.id}`)
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Primary);

      if (buttonEmoji) btn.setEmoji(buttonEmoji);

      const row = new ActionRowBuilder().addComponents(btn);
      const msg = await channel.send({ embeds: [embed], components: [row] });
      await Panel.update(panel.id, { message_id: msg.id });

      await interaction.editReply({ content: `✅ Ticket panel posted in ${channel}!\n\nPanel ID: **${panel.id}** — You can also manage panels from the web dashboard.` });
    } catch (err) {
      console.error('[TICKET] Error posting panel:', err);
      await interaction.editReply({ content: '❌ Failed to post panel. Make sure the bot has permission to send messages in that channel.' });
    }
  }

  if (subcommand === 'stats') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { Ticket, Subscription } = await import('../db/models.js');
      const ticketStats = await Ticket.countByGuild(guildId);
      const subStats = await Subscription.getStats(guildId);

      const embed = new EmbedBuilder()
        .setTitle('📊 Ticket & Subscription Statistics')
        .addFields(
          { name: '🎫 Total Tickets', value: String(ticketStats?.total || 0), inline: true },
          { name: '🟢 Open', value: String(ticketStats?.open || 0), inline: true },
          { name: '🔴 Closed', value: String(ticketStats?.closed || 0), inline: true },
          { name: '📦 Active Subscriptions', value: String(subStats?.active || 0), inline: true },
          { name: '💰 Total Revenue', value: `₹${parseFloat(subStats?.total_revenue || 0).toLocaleString()}`, inline: true },
          { name: '📅 Expiring (7 days)', value: String(subStats?.expiring_soon || 0), inline: true }
        )
        .setColor('#5865F2')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[TICKET] Error fetching stats:', err);
      await interaction.editReply({ content: '❌ Failed to fetch statistics.' });
    }
  }
}
