import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } from 'discord.js';
import { Guild, Panel, Plan, PaymentMethod, PlanPricing, Ticket, Subscription, Payment } from '../db/models.js';

async function isStaff(interaction, ticket) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const guild = await Guild.get(ticket.guild_id);
  if (guild?.staff_role_ids?.length) {
    return guild.staff_role_ids.some(roleId => interaction.member.roles.cache.has(roleId));
  }
  const panel = ticket.panel_id ? await Panel.get(ticket.panel_id) : null;
  if (panel?.staff_role_id) {
    return interaction.member.roles.cache.has(panel.staff_role_id);
  }
  return false;
}

export async function routeTicketInteraction(interaction) {
  const customId = interaction.customId;

  try {
    if (customId.startsWith('ticket:open:')) {
      await handleOpenTicket(interaction);
    } else if (customId.startsWith('ticket:plan:')) {
      await handlePlanSelect(interaction);
    } else if (customId.startsWith('ticket:pay:')) {
      await handlePaymentSelect(interaction);
    } else if (customId.startsWith('ticket:paid:')) {
      await handlePaid(interaction);
    } else if (customId.startsWith('ticket:confirm:')) {
      await handleConfirmPayment(interaction);
    } else if (customId.startsWith('ticket:deny_pay:')) {
      await handleDenyPayment(interaction);
    } else if (customId.startsWith('ticket:email_btn:')) {
      await handleEmailButton(interaction);
    } else if (customId.startsWith('ticket:close:')) {
      await handleCloseTicket(interaction);
    } else if (customId.startsWith('ticket:claim:')) {
      await handleClaimTicket(interaction);
    } else if (customId === 'ticket:claim') {
      await handleClaimByChannel(interaction);
    } else if (customId === 'ticket:close') {
      await handleCloseByChannel(interaction);
    } else if (customId === 'ticket:add_user') {
      await handleAddUser(interaction);
    } else if (customId === 'ticket:remove_user') {
      await handleRemoveUser(interaction);
    } else {
      console.log(`[TICKET] Unhandled ticket button: ${customId}`);
    }
  } catch (err) {
    console.error(`[TICKET] Error handling ${customId}:`, err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true });
      }
    } catch {}
  }
}

export async function handleEmailModal(interaction) {
  if (!interaction.customId.startsWith('ticket:email_modal:')) return false;
  const ticketId = parseInt(interaction.customId.split(':')[2]);
  const email = interaction.fields.getTextInputValue('email_input');

  try {
    await interaction.deferUpdate().catch(() => {});
    const ticket = await Ticket.get(ticketId);
    if (!ticket) return;

    if (!ticket.payment_confirmed) {
      console.warn(`[TICKET] Email modal submitted for ticket ${ticketId} without payment confirmation`);
      return;
    }

    await Ticket.update(ticketId, { email });

    const plan = ticket.plan_id ? await Plan.get(ticket.plan_id) : null;
    const method = ticket.payment_method_id ? await PaymentMethod.get(ticket.payment_method_id) : null;
    let price = plan?.price;
    let currency = plan?.currency || 'INR';
    if (plan && method) {
      const pp = await PlanPricing.getPrice(plan.id, method.id);
      if (pp) { price = pp.price; currency = pp.currency || currency; }
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (plan?.duration_days || 30));

    const sub = await Subscription.create({
      guild_id: ticket.guild_id,
      user_id: ticket.user_id,
      ticket_id: ticketId,
      plan_id: plan?.id || null,
      email,
      plan_name: plan?.name || 'Unknown',
      price: price || 0,
      currency,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      payment_method: method?.label || 'Unknown',
      status: 'active'
    });

    const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
    if (channel) {
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Subscription Activated!')
        .setDescription(`Subscription created successfully for <@${ticket.user_id}>`)
        .addFields(
          { name: '📦 Plan', value: plan?.name || 'Unknown', inline: true },
          { name: '💰 Price', value: `${currency === 'USD' ? '$' : '₹'}${price}`, inline: true },
          { name: '💳 Method', value: method?.label || 'Unknown', inline: true },
          { name: '📧 Email', value: email, inline: true },
          { name: '📅 Start', value: `<t:${Math.floor(startDate.getTime() / 1000)}:d>`, inline: true },
          { name: '📅 Expires', value: `<t:${Math.floor(endDate.getTime() / 1000)}:d>`, inline: true },
          { name: '🆔 Sub ID', value: `#${sub.id}`, inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await channel.send({ embeds: [successEmbed] });
    }

    return true;
  } catch (err) {
    console.error('[TICKET] Email modal error:', err);
    return false;
  }
}

async function handleOpenTicket(interaction) {
  const panelId = parseInt(interaction.customId.split(':')[2]);
  const panel = await Panel.get(panelId);
  if (!panel) {
    return interaction.reply({ content: '❌ This ticket panel no longer exists.', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const openTickets = await Ticket.getOpenByUser(guildId, userId);
  const maxTickets = panel.max_tickets_per_user || 1;
  if (openTickets.length >= maxTickets) {
    return interaction.reply({ content: `❌ You already have ${openTickets.length} open ticket(s). Maximum is ${maxTickets}.`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const categoryId = panel.category_id;
  const staffRoleId = panel.staff_role_id;
  if (!categoryId || !staffRoleId) {
    return interaction.editReply({ content: '❌ Ticket system not configured. Please contact an admin.' });
  }

  const ticketNum = Math.floor(Math.random() * 9000) + 1000;
  const channelName = `ticket-${ticketNum}`;

  try {
    const ticketChannel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: ['ViewChannel'] },
        { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
        { id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
      ]
    });

    const ticket = await Ticket.create({
      guild_id: guildId,
      user_id: userId,
      channel_id: ticketChannel.id,
      panel_id: panelId,
      status: 'open'
    });

    const staffRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:claim:${ticket.id}`).setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✋'),
      new ButtonBuilder().setCustomId(`ticket:close:${ticket.id}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    const controlEmbed = new EmbedBuilder()
      .setTitle('🎫 New Ticket')
      .setDescription(`Welcome ${interaction.user}!\n\nPlease select your subscription plan below.`)
      .addFields(
        { name: 'Ticket #', value: String(ticket.id), inline: true },
        { name: 'Opened by', value: interaction.user.tag, inline: true },
        { name: 'Status', value: '🟢 Open', inline: true }
      )
      .setColor('#00ff00')
      .setTimestamp();

    await ticketChannel.send({ content: `<@&${staffRoleId}>`, embeds: [controlEmbed], components: [staffRow] });

    const plans = await Plan.getEnabled(guildId);
    if (plans.length > 0) {
      const planEmbed = new EmbedBuilder()
        .setTitle('📦 Select Your Plan')
        .setDescription(
          `${interaction.user}, choose your subscription plan:\n\n` +
          plans.map((p, i) => {
            const priceStr = `${p.currency === 'USD' ? '$' : '₹'}${p.price}`;
            return `**${i + 1}.** ${p.button_emoji || ''} ${p.name} — ${priceStr}${p.recommended ? ' ⭐' : ''}`;
          }).join('\n')
        )
        .setColor('#5865F2');

      const planRows = [];
      let currentRow = new ActionRowBuilder();
      for (const plan of plans) {
        if (currentRow.components.length >= 5) {
          planRows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
        const btn = new ButtonBuilder()
          .setCustomId(`ticket:plan:${ticket.id}:${plan.id}`)
          .setLabel(plan.name)
          .setStyle(plan.recommended ? ButtonStyle.Success : ButtonStyle.Primary);
        if (plan.button_emoji) btn.setEmoji(plan.button_emoji);
        currentRow.addComponents(btn);
      }
      if (currentRow.components.length > 0) planRows.push(currentRow);

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [planEmbed], components: planRows });
    }

    if (panel.logs_channel_id) {
      const logsChannel = await interaction.guild.channels.fetch(panel.logs_channel_id).catch(() => null);
      if (logsChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🎫 Ticket Created')
          .addFields(
            { name: 'User', value: `${interaction.user.tag} (${userId})`, inline: true },
            { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true },
            { name: 'Panel', value: panel.title || 'Default', inline: true }
          )
          .setColor('#00ff00')
          .setTimestamp();
        await logsChannel.send({ embeds: [logEmbed] });
      }
    }

    await interaction.editReply({ content: `✅ Ticket created: ${ticketChannel}` });
  } catch (err) {
    console.error('[TICKET] Error creating ticket:', err);
    await interaction.editReply({ content: '❌ Failed to create ticket. Please contact an admin.' });
  }
}

async function handlePlanSelect(interaction) {
  const parts = interaction.customId.split(':');
  const ticketId = parseInt(parts[2]);
  const planId = parseInt(parts[3]);

  try { await interaction.deferUpdate(); } catch {}

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;
  if (ticket.user_id !== interaction.user.id) {
    return interaction.followUp({ content: '❌ Only the ticket opener can select a plan.', ephemeral: true });
  }

  const plan = await Plan.get(planId);
  if (!plan) return;

  await Ticket.update(ticketId, { plan_id: planId });

  const methods = await PaymentMethod.getEnabled(ticket.guild_id);
  if (methods.length === 0) {
    const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
    if (channel) {
      await channel.send({ content: '❌ No payment methods configured. Please contact an admin.' });
    }
    return;
  }

  const methodEmbed = new EmbedBuilder()
    .setTitle('💳 Select Payment Method')
    .setDescription(`Plan selected: **${plan.name}**\n\nChoose your payment method:\n\n` +
      (await Promise.all(methods.map(async (m) => {
        const pp = await PlanPricing.getPrice(planId, m.id);
        const price = pp ? `${(pp.currency || plan.currency) === 'USD' ? '$' : '₹'}${pp.price}` : `₹${plan.price}`;
        return `${m.emoji || '💳'} **${m.label}** — ${price}${m.recommended ? ' ⭐' : ''}`;
      }))).join('\n')
    )
    .setColor('#5865F2');

  const methodRows = [];
  let currentRow = new ActionRowBuilder();
  for (const method of methods) {
    if (currentRow.components.length >= 5) {
      methodRows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    const btn = new ButtonBuilder()
      .setCustomId(`ticket:pay:${ticketId}:${method.id}`)
      .setLabel(method.label)
      .setStyle(method.recommended ? ButtonStyle.Success : ButtonStyle.Secondary);
    if (method.emoji) btn.setEmoji(method.emoji);
    currentRow.addComponents(btn);
  }
  if (currentRow.components.length > 0) methodRows.push(currentRow);

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ embeds: [methodEmbed], components: methodRows });
  }
}

async function handlePaymentSelect(interaction) {
  const parts = interaction.customId.split(':');
  const ticketId = parseInt(parts[2]);
  const methodId = parseInt(parts[3]);

  try { await interaction.deferUpdate(); } catch {}

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;
  if (ticket.user_id !== interaction.user.id) {
    return interaction.followUp({ content: '❌ Only the ticket opener can select a payment method.', ephemeral: true });
  }

  const method = await PaymentMethod.get(methodId);
  if (!method) return;

  await Ticket.update(ticketId, { payment_method_id: methodId });

  const plan = ticket.plan_id ? await Plan.get(ticket.plan_id) : null;
  let price = plan?.price || 0;
  let currency = plan?.currency || 'INR';
  if (plan) {
    const pp = await PlanPricing.getPrice(plan.id, methodId);
    if (pp) { price = pp.price; currency = pp.currency || currency; }
  }

  const currSymbol = currency === 'USD' ? '$' : '₹';
  const payEmbed = new EmbedBuilder()
    .setTitle(`${method.emoji || '💳'} ${method.label} Payment`)
    .setDescription(
      method.instructions ||
      `Please complete your payment of **${currSymbol}${price}** using ${method.label}.\n\nAfter payment, click the **I've Paid** button below.`
    )
    .addFields(
      { name: '💰 Amount', value: `${currSymbol}${price}`, inline: true },
      { name: '📦 Plan', value: plan?.name || 'N/A', inline: true }
    )
    .setColor(method.embed_color || '#5865F2');

  if (method.payment_link) {
    payEmbed.addFields({ name: '🔗 Payment Link', value: method.payment_link, inline: false });
  }
  if (method.qr_image_url) {
    payEmbed.setImage(method.qr_image_url);
  }
  if (method.embed_thumbnail) {
    payEmbed.setThumbnail(method.embed_thumbnail);
  }

  const paidRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:paid:${ticketId}`)
      .setLabel("I've Paid")
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ embeds: [payEmbed], components: [paidRow] });
  }
}

async function handlePaid(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  try { await interaction.deferUpdate(); } catch {}

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;

  const plan = ticket.plan_id ? await Plan.get(ticket.plan_id) : null;
  const method = ticket.payment_method_id ? await PaymentMethod.get(ticket.payment_method_id) : null;
  let price = plan?.price || 0;
  let currency = plan?.currency || 'INR';
  if (plan && method) {
    const pp = await PlanPricing.getPrice(plan.id, method.id);
    if (pp) { price = pp.price; currency = pp.currency || currency; }
  }

  await Payment.create({
    guild_id: ticket.guild_id,
    ticket_id: ticketId,
    user_id: ticket.user_id,
    amount: price,
    currency,
    payment_method: method?.label || 'Unknown',
    status: 'pending'
  });

  const currSymbol = currency === 'USD' ? '$' : '₹';
  const confirmEmbed = new EmbedBuilder()
    .setTitle('💰 Payment Submitted')
    .setDescription(`<@${ticket.user_id}> claims to have paid.\n\n**Staff:** Please verify the payment and click Confirm or Deny.`)
    .addFields(
      { name: '📦 Plan', value: plan?.name || 'N/A', inline: true },
      { name: '💰 Amount', value: `${currSymbol}${price}`, inline: true },
      { name: '💳 Method', value: method?.label || 'N/A', inline: true }
    )
    .setColor('#FFA500')
    .setTimestamp();

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:confirm:${ticketId}`).setLabel('Confirm Payment').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`ticket:deny_pay:${ticketId}`).setLabel('Deny Payment').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
  }
}

async function handleConfirmPayment(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;

  if (!(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff can confirm payments.', ephemeral: true });
  }

  try { await interaction.deferUpdate(); } catch {}

  await Ticket.update(ticketId, {
    payment_confirmed: true,
    payment_confirmed_by: interaction.user.id,
    payment_confirmed_at: new Date().toISOString()
  });

  const emailEmbed = new EmbedBuilder()
    .setTitle('📧 Email Required')
    .setDescription(`<@${ticket.user_id}>, payment confirmed! Please provide your email address for the subscription.`)
    .setColor('#00ff00');

  const emailRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:email_btn:${ticketId}`)
      .setLabel('Enter Email')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📧')
  );

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({
      content: `<@${ticket.user_id}> ✅ Payment confirmed by ${interaction.user}!`,
      embeds: [emailEmbed],
      components: [emailRow]
    });
  }
}

async function handleDenyPayment(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;

  if (!(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff can deny payments.', ephemeral: true });
  }

  try { await interaction.deferUpdate(); } catch {}

  const denyEmbed = new EmbedBuilder()
    .setTitle('❌ Payment Denied')
    .setDescription(`Payment for <@${ticket.user_id}> was denied by ${interaction.user}.\n\nPlease try again or contact staff.`)
    .setColor('#ff0000')
    .setTimestamp();

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ embeds: [denyEmbed] });
  }
}

async function handleEmailButton(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  const ticket = await Ticket.get(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
  }

  if (ticket.user_id !== interaction.user.id) {
    return interaction.reply({ content: '❌ Only the ticket opener can enter an email.', ephemeral: true });
  }

  if (!ticket.payment_confirmed) {
    return interaction.reply({ content: '❌ Payment has not been confirmed by staff yet.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket:email_modal:${ticketId}`)
    .setTitle('Enter Your Email');

  const emailInput = new TextInputBuilder()
    .setCustomId('email_input')
    .setLabel('Email Address')
    .setPlaceholder('your@email.com')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
  await interaction.showModal(modal);
}

async function handleCloseTicket(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;

  if (ticket.user_id !== interaction.user.id && !(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff or the ticket opener can close tickets.', ephemeral: true });
  }

  try { await interaction.deferUpdate(); } catch {}

  await Ticket.update(ticketId, {
    status: 'closed',
    closed_by: interaction.user.id,
    closed_at: new Date().toISOString()
  });

  const closeEmbed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket was closed by ${interaction.user}.\nThis channel will be deleted in 10 seconds.`)
    .setColor('#ff0000')
    .setTimestamp();

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ embeds: [closeEmbed] });
    setTimeout(async () => {
      try { await channel.delete(); } catch (err) {
        console.error('[TICKET] Failed to delete channel:', err);
      }
    }, 10000);
  }
}

async function handleClaimTicket(interaction) {
  const ticketId = parseInt(interaction.customId.split(':')[2]);

  const ticket = await Ticket.get(ticketId);
  if (!ticket) return;

  if (!(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
  }

  try { await interaction.deferUpdate(); } catch {}

  if (ticket.claimed_by) {
    return interaction.followUp({ content: `❌ Already claimed by <@${ticket.claimed_by}>`, ephemeral: true });
  }

  await Ticket.update(ticketId, { claimed_by: interaction.user.id });

  const channel = await interaction.client.channels.fetch(ticket.channel_id).catch(() => null);
  if (channel) {
    await channel.send({ content: `✅ ${interaction.user} has claimed this ticket.` });
  }
}

async function handleClaimByChannel(interaction) {
  const ticket = await Ticket.getByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ No active ticket in this channel.', ephemeral: true });
  }
  if (!(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
  }
  if (ticket.claimed_by) {
    return interaction.reply({ content: `❌ Already claimed by <@${ticket.claimed_by}>`, ephemeral: true });
  }
  try { await interaction.deferUpdate(); } catch {}
  await Ticket.update(ticket.id, { claimed_by: interaction.user.id });
  await interaction.channel.send({ content: `✅ ${interaction.user} has claimed this ticket.` });
}

async function handleCloseByChannel(interaction) {
  const ticket = await Ticket.getByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ No active ticket in this channel.', ephemeral: true });
  }
  if (ticket.user_id !== interaction.user.id && !(await isStaff(interaction, ticket))) {
    return interaction.reply({ content: '❌ Only staff or the ticket opener can close tickets.', ephemeral: true });
  }
  try { await interaction.deferUpdate(); } catch {}
  await Ticket.update(ticket.id, {
    status: 'closed',
    closed_by: interaction.user.id,
    closed_at: new Date().toISOString()
  });
  const closeEmbed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`Closed by ${interaction.user}. Channel will be deleted in 10 seconds.`)
    .setColor('#ff0000');
  await interaction.channel.send({ embeds: [closeEmbed] });
  setTimeout(async () => {
    try { await interaction.channel.delete(); } catch {}
  }, 10000);
}

async function handleAddUser(interaction) {
  const ticket = await Ticket.getByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ No active ticket in this channel.', ephemeral: true });
  }
  await interaction.reply({ content: '➕ Mention the user you want to add (e.g. @user):', ephemeral: true });
  const filter = m => m.author.id === interaction.user.id;
  try {
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
    const msg = collected.first();
    const mention = msg.mentions.users.first();
    await msg.delete().catch(() => {});
    if (!mention) {
      return interaction.followUp({ content: '❌ No user mentioned.', ephemeral: true });
    }
    await interaction.channel.permissionOverwrites.edit(mention.id, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true
    });
    await interaction.channel.send({ content: `✅ ${mention} has been added to this ticket.` });
  } catch {
    interaction.followUp({ content: '⏱️ Timed out.', ephemeral: true }).catch(() => {});
  }
}

async function handleRemoveUser(interaction) {
  const ticket = await Ticket.getByChannel(interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: '❌ No active ticket in this channel.', ephemeral: true });
  }
  await interaction.reply({ content: '➖ Mention the user you want to remove:', ephemeral: true });
  const filter = m => m.author.id === interaction.user.id;
  try {
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
    const msg = collected.first();
    const mention = msg.mentions.users.first();
    await msg.delete().catch(() => {});
    if (!mention) {
      return interaction.followUp({ content: '❌ No user mentioned.', ephemeral: true });
    }
    await interaction.channel.permissionOverwrites.delete(mention.id);
    await interaction.channel.send({ content: `✅ ${mention} has been removed from this ticket.` });
  } catch {
    interaction.followUp({ content: '⏱️ Timed out.', ephemeral: true }).catch(() => {});
  }
}
