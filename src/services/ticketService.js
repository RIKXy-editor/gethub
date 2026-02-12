import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import { Panel, Plan, PaymentMethod, PlanPricing, Ticket, Subscription, Reminder, Payment, Log, Guild } from '../db/models.js';

const BUTTON_STYLES = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger
};

function getButtonStyle(style) {
  return BUTTON_STYLES[style] || ButtonStyle.Secondary;
}

export async function handleTicketButton(interaction) {
  const panelId = interaction.customId.replace('ticket:open:', '');
  const panel = await Panel.getById(panelId);
  if (!panel || !panel.enabled) {
    return interaction.reply({ content: 'This ticket panel is currently disabled.', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const openTickets = await Ticket.getOpenByUser(guildId, interaction.user.id);
  if (openTickets.length >= panel.max_tickets_per_user) {
    return interaction.reply({ content: `You already have ${openTickets.length} open ticket(s). Please close existing tickets first.`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const categoryId = panel.category_id || null;
    const guild = await Guild.get(guildId);
    const staffRoleId = panel.staff_role_id || (guild?.staff_role_ids?.[0]) || null;

    const permissionOverwrites = [
      { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }
    ];

    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites
    });

    const ticket = await Ticket.create({
      guild_id: guildId,
      user_id: interaction.user.id,
      channel_id: channel.id,
      panel_id: panel.id
    });

    await Log.create(guildId, 'ticket_created', interaction.user.id, null, { ticket_id: ticket.id, channel_id: channel.id });

    const staffPing = staffRoleId ? `<@&${staffRoleId}>` : '';
    const adminControls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.id}`)
        .setLabel('Claim Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🙋'),
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticket.id}`)
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    const plans = await Plan.getEnabled(guildId);
    if (plans.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('Ticket Opened')
        .setDescription(`<@${interaction.user.id}> opened a ticket.\nA staff member will be with you shortly.`)
        .setColor('#5865F2')
        .setTimestamp();
      await channel.send({ content: `<@${interaction.user.id}> ${staffPing}`, embeds: [embed], components: [adminControls] });
    } else {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 New Ticket')
        .setDescription(`<@${interaction.user.id}> opened a ticket.\n${staffPing ? `Staff notified: ${staffPing}` : ''}`)
        .setColor('#5865F2')
        .setTimestamp();
      await channel.send({ content: `<@${interaction.user.id}> ${staffPing}`, embeds: [welcomeEmbed], components: [adminControls] });
      await sendPlanSelection(channel, interaction.user.id, ticket.id, plans);
    }

    await interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
  } catch (err) {
    console.error('[TICKET] Error creating ticket:', err);
    await interaction.editReply({ content: 'Failed to create ticket. Please try again.' });
  }
}

async function sendPlanSelection(channel, userId, ticketId, plans) {
  let description = 'Select your subscription duration below.\n\n';
  for (const plan of plans) {
    const rec = plan.recommended ? ' 🔥 **Recommended**' : '';
    const discount = plan.discount_percent > 0 ? ` (${plan.discount_percent}% OFF)` : '';
    description += `**${plan.name}** — ₹${plan.price}${discount}${rec}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Choose Your Subscription Plan')
    .setDescription(description)
    .setColor('#5865F2')
    .setTimestamp();

  const rows = [];
  let currentRow = new ActionRowBuilder();
  let btnCount = 0;

  for (const plan of plans) {
    if (btnCount >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
      btnCount = 0;
    }
    const btn = new ButtonBuilder()
      .setCustomId(`ticket:plan:${ticketId}:${plan.id}`)
      .setLabel(plan.name)
      .setStyle(getButtonStyle(plan.button_color));
    if (plan.button_emoji) btn.setEmoji(plan.button_emoji);
    currentRow.addComponents(btn);
    btnCount++;
  }
  if (btnCount > 0) rows.push(currentRow);

  await channel.send({ content: `<@${userId}>`, embeds: [embed], components: rows });
}

export async function handlePlanSelect(interaction) {
  const parts = interaction.customId.split(':');
  const ticketId = parseInt(parts[2]);
  const planId = parseInt(parts[3]);

  try {
    try {
      await interaction.deferUpdate();
    } catch (deferErr) {
      console.log('[TICKET] deferUpdate failed (already acked), continuing...', deferErr.code);
    }

    const ticket = await Ticket.getById(ticketId);
    if (!ticket || ticket.user_id !== interaction.user.id) {
      try { await interaction.followUp({ content: 'This is not your ticket.', ephemeral: true }); } catch (e) {}
      return;
    }

    const plan = await Plan.getById(planId);
    if (!plan) {
      try { await interaction.followUp({ content: 'Plan not found.', ephemeral: true }); } catch (e) {}
      return;
    }

    await Ticket.update(ticketId, { plan_id: planId });

    try {
      await interaction.message.edit({ components: [] });
    } catch (editErr) {
      console.log('[TICKET] Could not remove plan buttons:', editErr.message);
    }

    const methods = await PaymentMethod.getEnabled(ticket.guild_id);
    if (methods.length === 0) {
      return interaction.channel.send('No payment methods configured. Please contact an admin.');
    }

    const pricingList = await PlanPricing.getByPlan(planId);
    const pricingMap = {};
    for (const pp of pricingList) {
      pricingMap[pp.payment_method_id] = pp;
    }

    let description = `**Selected Plan:** ${plan.name}\n\nChoose your preferred payment method:\n\n`;
    for (const m of methods) {
      const rec = m.recommended ? ' ⭐ **Recommended**' : '';
      const methodPrice = pricingMap[m.id]?.price ?? plan.price;
      const currency = pricingMap[m.id]?.currency || plan.currency || 'INR';
      const symbol = currency === 'USD' ? '$' : '₹';
      description += `${m.emoji || ''} **${m.label}** — ${symbol}${parseFloat(methodPrice).toLocaleString()}${rec}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('Select Payment Method')
      .setDescription(description)
      .setColor('#5865F2')
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();
    let btnCount = 0;

    for (const m of methods) {
      if (btnCount >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        btnCount = 0;
      }
      const btn = new ButtonBuilder()
        .setCustomId(`ticket:pay:${ticketId}:${m.id}`)
        .setLabel(m.label)
        .setStyle(getButtonStyle(m.button_color));
      if (m.emoji) btn.setEmoji(m.emoji);
      currentRow.addComponents(btn);
      btnCount++;
    }
    if (btnCount > 0) rows.push(currentRow);

    await interaction.channel.send({ embeds: [embed], components: rows });
  } catch (err) {
    console.error('[TICKET] Error handling plan select:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong while selecting the plan. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

export async function handlePaymentSelect(interaction) {
  const parts = interaction.customId.split(':');
  const ticketId = parseInt(parts[2]);
  const methodId = parseInt(parts[3]);

  try {
    try { await interaction.deferUpdate(); } catch (e) {}

    const ticket = await Ticket.getById(ticketId);
    if (!ticket || ticket.user_id !== interaction.user.id) {
      try { await interaction.followUp({ content: 'This is not your ticket.', ephemeral: true }); } catch (e) {}
      return;
    }

    const method = await PaymentMethod.getById(methodId);
    if (!method) {
      try { await interaction.followUp({ content: 'Payment method not found.', ephemeral: true }); } catch (e) {}
      return;
    }

    await Ticket.update(ticketId, { payment_method_id: methodId });
    try { await interaction.message.edit({ components: [] }); } catch (e) {}

    const plan = await Plan.getById(ticket.plan_id);
    const pricing = await PlanPricing.getPrice(ticket.plan_id, methodId);
    const methodPrice = pricing.price;
    const currency = pricing.currency || 'INR';
    const symbol = currency === 'USD' ? '$' : '₹';

    let description = method.instructions || 'Please complete the payment and click the button below.';
    if (plan) description += `\n\n**Plan:** ${plan.name}\n**Amount:** ${symbol}${parseFloat(methodPrice).toLocaleString()}`;
    if (method.payment_link) description += `\n**Payment Link:** ${method.payment_link}`;

    const embed = new EmbedBuilder()
      .setTitle(`Payment via ${method.label}`)
      .setDescription(description)
      .setColor(method.embed_color || '#5865F2')
      .setTimestamp();

    if (method.qr_image_url) embed.setImage(method.qr_image_url);
    if (method.embed_thumbnail) embed.setThumbnail(method.embed_thumbnail);
    if (method.embed_image && !method.qr_image_url) embed.setImage(method.embed_image);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:paid:${ticketId}`)
        .setLabel('I Have Completed Payment')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[TICKET] Error handling payment select:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

export async function handlePaidButton(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  try {
    try { await interaction.deferUpdate(); } catch (e) {}

    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      try { await interaction.followUp({ content: 'Ticket not found.', ephemeral: true }); } catch (e) {}
      return;
    }

    if (ticket.user_id !== interaction.user.id) {
      try { await interaction.followUp({ content: 'This is not your ticket.', ephemeral: true }); } catch (e) {}
      return;
    }

    try { await interaction.message.edit({ components: [] }); } catch (e) {}

    const plan = await Plan.getById(ticket.plan_id);
    const method = await PaymentMethod.getById(ticket.payment_method_id);
    const guild = await Guild.get(ticket.guild_id);
    const panel = await Panel.getById(ticket.panel_id);
    const staffRoleId = panel?.staff_role_id || guild?.staff_role_ids?.[0] || null;
    const staffPing = staffRoleId ? `<@&${staffRoleId}>` : '';

    const pricing = ticket.plan_id && ticket.payment_method_id ? await PlanPricing.getPrice(ticket.plan_id, ticket.payment_method_id) : { price: plan?.price || 0, currency: plan?.currency || 'INR' };
    const paidSymbol = (pricing.currency || 'INR') === 'USD' ? '$' : '₹';

    const embed = new EmbedBuilder()
      .setTitle('💰 Payment Submitted')
      .setDescription(`<@${interaction.user.id}> has indicated they completed payment.\n\n**Plan:** ${plan?.name || 'N/A'}\n**Method:** ${method?.label || 'N/A'}\n**Amount:** ${paidSymbol}${parseFloat(pricing.price).toLocaleString()}\n\nAn admin will verify and confirm your payment.`)
      .setColor('#FFA500')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:confirm:${ticketId}`)
        .setLabel('Confirm Payment')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`ticket:deny_pay:${ticketId}`)
        .setLabel('Deny Payment')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    await interaction.channel.send({ content: staffPing ? `${staffPing} Payment review needed:` : '', embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[TICKET] Error handling paid button:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

export async function handleConfirmPayment(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  try {
    const isAdmin = await checkStaffPermission(interaction);
    if (!isAdmin) {
      return interaction.reply({ content: 'Only staff members can confirm payments.', ephemeral: true });
    }

    try { await interaction.deferUpdate(); } catch (e) {}

    const ticket = await Ticket.getById(ticketId);
    if (!ticket) {
      try { await interaction.followUp({ content: 'Ticket not found.', ephemeral: true }); } catch (e) {}
      return;
    }

    await Ticket.update(ticketId, {
      payment_confirmed: true,
      payment_confirmed_by: interaction.user.id,
      payment_confirmed_at: new Date().toISOString()
    });

    await Log.create(ticket.guild_id, 'payment_confirmed', interaction.user.id, ticket.user_id, { ticket_id: ticketId });

    try { await interaction.message.edit({ components: [] }); } catch (e) {}

    const embed = new EmbedBuilder()
      .setTitle('✅ Payment Confirmed')
      .setDescription(`Payment has been confirmed by <@${interaction.user.id}>.\n\nPlease submit your email carefully for your subscription delivery.`)
      .setColor('#00FF00')
      .setFooter({ text: '⚠️ Please enter your email carefully. Wrong email means wrong subscription delivery.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:email_btn:${ticketId}`)
        .setLabel('Enter Subscription Email')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📧')
    );

    await interaction.channel.send({ content: `<@${ticket.user_id}>`, embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[TICKET] Error confirming payment:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

export async function handleDenyPayment(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);
  const isAdmin = await checkStaffPermission(interaction);
  if (!isAdmin) {
    return interaction.reply({ content: 'Only staff members can deny payments.', ephemeral: true });
  }

  try {
    try { await interaction.deferUpdate(); } catch (e) {}
    try { await interaction.message.edit({ components: [] }); } catch (e) {}

    const embed = new EmbedBuilder()
      .setTitle('❌ Payment Denied')
      .setDescription(`Payment was denied by <@${interaction.user.id}>. Please contact a staff member for more information.`)
      .setColor('#FF0000')
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[TICKET] Error denying payment:', err);
  }
}

export async function handleEmailButton(interaction) {
  try {
    const ticketId = parseInt(interaction.customId.split(':')[2]);
    const ticket = await Ticket.getById(ticketId);
    if (!ticket || ticket.user_id !== interaction.user.id) {
      return interaction.reply({ content: 'This is not your ticket.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket:email_modal:${ticketId}`)
      .setTitle('Enter Subscription Email');

    const emailInput = new TextInputBuilder()
      .setCustomId('email')
      .setLabel('Your Email Address')
      .setPlaceholder('example@email.com')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
    await interaction.showModal(modal);
  } catch (err) {
    console.error('[TICKET] Error showing email modal:', err);
  }
}

export async function handleEmailModal(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);
  const email = interaction.fields.getTextInputValue('email').trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return interaction.reply({ content: 'Please enter a valid email address.', ephemeral: true });
  }

  try {
    const ticket = await Ticket.getById(ticketId);
    if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    await Ticket.update(ticketId, { email });
    const plan = await Plan.getById(ticket.plan_id);
    const method = await PaymentMethod.getById(ticket.payment_method_id);
    const pricing = ticket.plan_id && ticket.payment_method_id ? await PlanPricing.getPrice(ticket.plan_id, ticket.payment_method_id) : { price: plan?.price || 0, currency: plan?.currency || 'INR' };
    const finalPrice = pricing.price;
    const finalCurrency = pricing.currency || 'INR';

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (plan?.duration_days || 30));

    const subscription = await Subscription.create({
      guild_id: ticket.guild_id,
      user_id: ticket.user_id,
      ticket_id: ticket.id,
      plan_id: plan?.id,
      email,
      plan_name: plan?.name || 'Unknown',
      price: finalPrice,
      currency: finalCurrency,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      payment_method: method?.label || 'Unknown',
      status: 'active'
    });

    await Payment.create({
      guild_id: ticket.guild_id,
      ticket_id: ticket.id,
      subscription_id: subscription.id,
      user_id: ticket.user_id,
      amount: finalPrice,
      currency: finalCurrency,
      payment_method: method?.label,
      status: 'confirmed'
    });

    const guild = await Guild.get(ticket.guild_id);
    const reminderDays = guild?.reminder_days || [3, 2, 1];
    const reminders = [];
    for (const daysBefore of reminderDays) {
      const reminderDate = new Date(endDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      if (reminderDate > startDate) {
        reminders.push({
          subscription_id: subscription.id,
          user_id: ticket.user_id,
          guild_id: ticket.guild_id,
          reminder_date: reminderDate.toISOString().split('T')[0],
          days_before: daysBefore
        });
      }
    }
    if (reminders.length > 0) await Reminder.createBulk(reminders);

    await Log.create(ticket.guild_id, 'subscription_created', ticket.user_id, null, {
      subscription_id: subscription.id, plan: plan?.name, email, end_date: endDate.toISOString()
    });

    await interaction.editReply({ content: 'Email submitted successfully!' });

    const subSymbol = finalCurrency === 'USD' ? '$' : '₹';
    const embed = new EmbedBuilder()
      .setTitle('🎉 Subscription Activated!')
      .setDescription([
        `**Email:** ${email}`,
        `**Plan:** ${plan?.name || 'N/A'}`,
        `**Price:** ${subSymbol}${parseFloat(finalPrice).toLocaleString()}`,
        `**Start Date:** ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        `**End Date:** ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        `**Payment Method:** ${method?.label || 'N/A'}`,
        '',
        'You will receive DM reminders before your subscription expires.'
      ].join('\n'))
      .setColor('#00FF00')
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticketId}`)
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await interaction.channel.send({ embeds: [embed], components: [closeRow] });
  } catch (err) {
    console.error('[TICKET] Error handling email modal:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong creating the subscription. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

export async function handleCloseTicket(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);
  const isAdmin = await checkStaffPermission(interaction);
  if (!isAdmin) {
    return interaction.reply({ content: 'Only staff members can close tickets.', ephemeral: true });
  }

  try {
    try { await interaction.deferUpdate(); } catch (e) {}
    try { await interaction.message.edit({ components: [] }); } catch (e) {}
    await Ticket.close(ticketId, interaction.user.id);
    await Log.create(interaction.guild.id, 'ticket_closed', interaction.user.id, null, { ticket_id: ticketId });

    const embed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by <@${interaction.user.id}>.`)
      .setColor('#FF0000')
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    setTimeout(async () => {
      try {
        await interaction.channel.delete();
      } catch (e) {
        console.error('[TICKET] Failed to delete channel:', e.message);
      }
    }, 5000);
  } catch (err) {
    console.error('[TICKET] Error closing ticket:', err);
  }
}

export async function handleClaimTicket(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);
  const isAdmin = await checkStaffPermission(interaction);
  if (!isAdmin) {
    return interaction.reply({ content: 'Only staff members can claim tickets.', ephemeral: true });
  }

  try {
    try { await interaction.deferUpdate(); } catch (e) {}
    await Ticket.update(ticketId, { claimed_by: interaction.user.id });

    const embed = new EmbedBuilder()
      .setTitle('🙋 Ticket Claimed')
      .setDescription(`This ticket is now being handled by <@${interaction.user.id}>.`)
      .setColor('#5865F2')
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[TICKET] Error claiming ticket:', err);
    try {
      await interaction.followUp({ content: 'Something went wrong. Please try again.', ephemeral: true });
    } catch (e) {}
  }
}

async function checkStaffPermission(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

  const guild = await Guild.get(interaction.guild.id);
  if (guild?.staff_role_ids?.length > 0) {
    return guild.staff_role_ids.some(roleId => interaction.member.roles.cache.has(roleId));
  }

  const ticket = await Ticket.getByChannel(interaction.channel.id);
  if (ticket) {
    const panel = await Panel.getById(ticket.panel_id);
    if (panel?.staff_role_id && interaction.member.roles.cache.has(panel.staff_role_id)) return true;
  }

  return false;
}

export async function routeTicketInteraction(interaction) {
  const id = interaction.customId;

  if (id.startsWith('ticket:open:')) return handleTicketButton(interaction);
  if (id.startsWith('ticket:plan:')) return handlePlanSelect(interaction);
  if (id.startsWith('ticket:pay:')) return handlePaymentSelect(interaction);
  if (id.startsWith('ticket:paid:')) return handlePaidButton(interaction);
  if (id.startsWith('ticket:confirm:')) return handleConfirmPayment(interaction);
  if (id.startsWith('ticket:deny_pay:')) return handleDenyPayment(interaction);
  if (id.startsWith('ticket:email_btn:')) return handleEmailButton(interaction);
  if (id.startsWith('ticket:close:')) return handleCloseTicket(interaction);
  if (id.startsWith('ticket:claim:')) return handleClaimTicket(interaction);

  return null;
}
