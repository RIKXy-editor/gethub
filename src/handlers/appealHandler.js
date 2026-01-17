import { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType
} from 'discord.js';
import { 
  getAppealsConfig, 
  getBanRecord, 
  canUserAppeal, 
  hasPendingAppeal,
  addAppeal,
  generateAppealId,
  getAppeal,
  updateAppeal,
  addAppealHistory,
  loadData,
  saveData
} from '../utils/storage.js';

export async function handleAppealButton(interaction) {
  const customId = interaction.customId;
  
  if (customId.startsWith('appeal:submit:')) {
    await handleSubmitAppealButton(interaction);
    return true;
  }
  
  if (customId.startsWith('appeal:approve:')) {
    await handleApproveAppeal(interaction);
    return true;
  }
  
  if (customId.startsWith('appeal:deny:')) {
    await handleDenyAppeal(interaction);
    return true;
  }
  
  if (customId.startsWith('appeal:askinfo:')) {
    await handleAskInfoAppeal(interaction);
    return true;
  }
  
  if (customId.startsWith('appeal:history:')) {
    await handleViewHistory(interaction);
    return true;
  }
  
  if (customId.startsWith('appeal:denyconfirm:')) {
    await showDenyReasonModal(interaction);
    return true;
  }
  
  return false;
}

async function handleSubmitAppealButton(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const caseId = parts[3];
    
    const config = getAppealsConfig(guildId);
    
    if (!config.enabled) {
      await interaction.reply({
        content: 'Appeals are currently disabled for this server.',
        ephemeral: true
      });
      return;
    }
    
    const cooldownCheck = canUserAppeal(guildId, interaction.user.id, config.cooldownDays);
    if (!cooldownCheck.canAppeal) {
      await interaction.reply({
        content: `You cannot submit another appeal yet. Please wait ${cooldownCheck.remainingDays} more day(s).`,
        ephemeral: true
      });
      return;
    }
    
    if (hasPendingAppeal(guildId, interaction.user.id)) {
      await interaction.reply({
        content: 'You already have a pending appeal. Please wait for staff to review it.',
        ephemeral: true
      });
      return;
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`appeal:modal:${guildId}:${caseId}`)
      .setTitle('Submit Ban Appeal');
    
    const titleInput = new TextInputBuilder()
      .setCustomId('appeal_title')
      .setLabel('Appeal Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Unban request')
      .setRequired(true)
      .setMaxLength(100);
    
    const whatHappenedInput = new TextInputBuilder()
      .setCustomId('appeal_what')
      .setLabel('What happened?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Explain what led to your ban...')
      .setRequired(true)
      .setMaxLength(1000);
    
    const whyUnbanInput = new TextInputBuilder()
      .setCustomId('appeal_why')
      .setLabel('Why should we unban you?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Explain why you deserve a second chance...')
      .setRequired(true)
      .setMaxLength(1000);
    
    const agreeRulesInput = new TextInputBuilder()
      .setCustomId('appeal_agree')
      .setLabel('Do you agree to follow the rules?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Yes')
      .setRequired(true)
      .setMaxLength(50);
    
    const proofInput = new TextInputBuilder()
      .setCustomId('appeal_proof')
      .setLabel('Proof link (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://...')
      .setRequired(false)
      .setMaxLength(500);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(whatHappenedInput),
      new ActionRowBuilder().addComponents(whyUnbanInput),
      new ActionRowBuilder().addComponents(agreeRulesInput),
      new ActionRowBuilder().addComponents(proofInput)
    );
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('[Appeals] Error showing appeal modal:', error);
    await interaction.reply({
      content: 'An error occurred. Please try again later.',
      ephemeral: true
    }).catch(() => {});
  }
}

export async function handleAppealModal(interaction) {
  if (!interaction.customId.startsWith('appeal:modal:')) return false;
  
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const caseId = parts[3];
    
    const config = getAppealsConfig(guildId);
    const banRecord = getBanRecord(guildId, interaction.user.id);
    
    const title = interaction.fields.getTextInputValue('appeal_title');
    const whatHappened = interaction.fields.getTextInputValue('appeal_what');
    const whyUnban = interaction.fields.getTextInputValue('appeal_why');
    const agreeRules = interaction.fields.getTextInputValue('appeal_agree');
    const proofLink = interaction.fields.getTextInputValue('appeal_proof') || null;
    
    const appealId = generateAppealId();
    
    const appealData = {
      appealId,
      guildId,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      userAvatar: interaction.user.displayAvatarURL({ dynamic: true }),
      caseId,
      banReason: banRecord?.reason || 'Unknown',
      title,
      answers: {
        whatHappened,
        whyUnban,
        agreeRules
      },
      proofLink,
      status: 'PENDING',
      staffMessageId: null,
      staffChannelId: null
    };
    
    addAppeal(appealData);
    
    await interaction.reply({
      content: '✅ Your appeal has been submitted! Staff will review it and you will be notified of the decision.',
      ephemeral: true
    });
    
    if (config.appealsChannelId) {
      try {
        const guild = await interaction.client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(config.appealsChannelId);
        
        if (channel) {
          const userCreatedAt = Math.floor(interaction.user.createdTimestamp / 1000);
          
          const embed = new EmbedBuilder()
            .setTitle(`📋 New Ban Appeal: ${title}`)
            .setColor('#f39c12')
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: '👤 User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: '🆔 User ID', value: interaction.user.id, inline: true },
              { name: '📅 Account Created', value: `<t:${userCreatedAt}:R>`, inline: true },
              { name: '🔖 Case ID', value: caseId, inline: true },
              { name: '📝 Appeal ID', value: appealId, inline: true },
              { name: '📊 Status', value: '🟡 PENDING', inline: true },
              { name: '⛔ Ban Reason', value: banRecord?.reason || 'No reason provided', inline: false },
              { name: '❓ What Happened', value: whatHappened.substring(0, 1024), inline: false },
              { name: '💭 Why Unban', value: whyUnban.substring(0, 1024), inline: false },
              { name: '✅ Agrees to Follow Rules', value: agreeRules, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Appeal ID: ${appealId}` });
          
          if (proofLink) {
            embed.addFields({ name: '🔗 Proof Link', value: proofLink, inline: false });
          }
          
          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`appeal:approve:${appealId}`)
              .setLabel('Approve (Unban)')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(`appeal:denyconfirm:${appealId}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌'),
            new ButtonBuilder()
              .setCustomId(`appeal:askinfo:${appealId}`)
              .setLabel('Ask for More Info')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('💬'),
            new ButtonBuilder()
              .setCustomId(`appeal:history:${appealId}`)
              .setLabel('History')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🧾')
          );
          
          const staffMessage = await channel.send({ 
            content: config.staffRoleId ? `<@&${config.staffRoleId}> New ban appeal received!` : 'New ban appeal received!',
            embeds: [embed], 
            components: [buttons] 
          });
          
          updateAppeal(appealId, { 
            staffMessageId: staffMessage.id, 
            staffChannelId: channel.id 
          });
        }
      } catch (channelError) {
        console.error('[Appeals] Error posting to staff channel:', channelError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[Appeals] Error handling appeal modal:', error);
    await interaction.reply({
      content: 'An error occurred while submitting your appeal. Please try again.',
      ephemeral: true
    }).catch(() => {});
    return true;
  }
}

async function handleApproveAppeal(interaction) {
  try {
    const appealId = interaction.customId.split(':')[2];
    const appeal = getAppeal(appealId);
    
    if (!appeal) {
      await interaction.reply({ content: 'Appeal not found.', ephemeral: true });
      return;
    }
    
    if (appeal.status !== 'PENDING') {
      await interaction.reply({ content: `This appeal has already been ${appeal.status.toLowerCase()}.`, ephemeral: true });
      return;
    }
    
    const config = getAppealsConfig(appeal.guildId);
    if (config.staffRoleId && !interaction.member.roles.cache.has(config.staffRoleId)) {
      await interaction.reply({ content: 'You do not have permission to review appeals.', ephemeral: true });
      return;
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    const guild = await interaction.client.guilds.fetch(appeal.guildId);
    
    try {
      await guild.members.unban(appeal.userId, `Appeal approved by ${interaction.user.tag}`);
    } catch (unbanError) {
      await interaction.editReply({ content: `Failed to unban user: ${unbanError.message}` });
      return;
    }
    
    updateAppeal(appealId, { status: 'APPROVED' });
    addAppealHistory(appealId, 'approved', `Appeal approved by ${interaction.user.tag}`, interaction.user.id);
    
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor('#2ecc71')
      .spliceFields(5, 1, { name: '📊 Status', value: '✅ APPROVED', inline: true })
      .addFields({ name: '👨‍⚖️ Reviewed By', value: `<@${interaction.user.id}>`, inline: true });
    
    await interaction.message.edit({ embeds: [embed], components: [] });
    
    try {
      const user = await interaction.client.users.fetch(appeal.userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('✅ Ban Appeal Approved!')
        .setDescription(`Great news! Your ban appeal for **${guild.name}** has been approved.\n\nYou have been unbanned and can rejoin the server.`)
        .setColor('#2ecc71')
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('[Appeals] Could not DM user about approval:', dmError.message);
    }
    
    addAuditLog(appeal.guildId, {
      action: 'APPEAL_APPROVED',
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      target: appeal.userTag,
      targetId: appeal.userId,
      appealId,
      caseId: appeal.caseId
    });
    
    await interaction.editReply({ content: `✅ Appeal approved. User has been unbanned.` });
  } catch (error) {
    console.error('[Appeals] Error approving appeal:', error);
    await interaction.editReply({ content: 'An error occurred while processing the approval.' }).catch(() => {});
  }
}

async function showDenyReasonModal(interaction) {
  try {
    const appealId = interaction.customId.split(':')[2];
    
    const modal = new ModalBuilder()
      .setCustomId(`appeal:denymodal:${appealId}`)
      .setTitle('Deny Appeal');
    
    const reasonInput = new TextInputBuilder()
      .setCustomId('deny_reason')
      .setLabel('Reason for denial (will be sent to user)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Explain why this appeal is being denied...')
      .setRequired(false)
      .setMaxLength(1000);
    
    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('[Appeals] Error showing deny modal:', error);
  }
}

export async function handleDenyModal(interaction) {
  if (!interaction.customId.startsWith('appeal:denymodal:')) return false;
  
  try {
    const appealId = interaction.customId.split(':')[2];
    const appeal = getAppeal(appealId);
    
    if (!appeal) {
      await interaction.reply({ content: 'Appeal not found.', ephemeral: true });
      return true;
    }
    
    const reason = interaction.fields.getTextInputValue('deny_reason') || 'No reason provided';
    
    updateAppeal(appealId, { status: 'DENIED', denyReason: reason });
    addAppealHistory(appealId, 'denied', `Appeal denied by ${interaction.user.tag}: ${reason}`, interaction.user.id);
    
    const staffChannel = await interaction.client.channels.fetch(appeal.staffChannelId);
    if (staffChannel && appeal.staffMessageId) {
      try {
        const staffMessage = await staffChannel.messages.fetch(appeal.staffMessageId);
        const embed = EmbedBuilder.from(staffMessage.embeds[0])
          .setColor('#e74c3c')
          .spliceFields(5, 1, { name: '📊 Status', value: '❌ DENIED', inline: true })
          .addFields(
            { name: '👨‍⚖️ Reviewed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📝 Deny Reason', value: reason, inline: false }
          );
        
        await staffMessage.edit({ embeds: [embed], components: [] });
      } catch {}
    }
    
    try {
      const user = await interaction.client.users.fetch(appeal.userId);
      const guild = await interaction.client.guilds.fetch(appeal.guildId);
      
      const dmEmbed = new EmbedBuilder()
        .setTitle('❌ Ban Appeal Denied')
        .setDescription(`Unfortunately, your ban appeal for **${guild.name}** has been denied.`)
        .addFields({ name: 'Reason', value: reason })
        .setColor('#e74c3c')
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log('[Appeals] Could not DM user about denial:', dmError.message);
    }
    
    addAuditLog(appeal.guildId, {
      action: 'APPEAL_DENIED',
      moderator: interaction.user.tag,
      moderatorId: interaction.user.id,
      target: appeal.userTag,
      targetId: appeal.userId,
      appealId,
      caseId: appeal.caseId,
      reason
    });
    
    await interaction.reply({ content: '❌ Appeal denied. User has been notified.', ephemeral: true });
    return true;
  } catch (error) {
    console.error('[Appeals] Error handling deny modal:', error);
    await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    return true;
  }
}

async function handleAskInfoAppeal(interaction) {
  try {
    const appealId = interaction.customId.split(':')[2];
    
    const modal = new ModalBuilder()
      .setCustomId(`appeal:askinfomodal:${appealId}`)
      .setTitle('Request More Information');
    
    const messageInput = new TextInputBuilder()
      .setCustomId('info_message')
      .setLabel('What information do you need?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ask the user for more details...')
      .setRequired(true)
      .setMaxLength(1000);
    
    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('[Appeals] Error showing ask info modal:', error);
  }
}

export async function handleAskInfoModal(interaction) {
  if (!interaction.customId.startsWith('appeal:askinfomodal:')) return false;
  
  try {
    const appealId = interaction.customId.split(':')[2];
    const appeal = getAppeal(appealId);
    
    if (!appeal) {
      await interaction.reply({ content: 'Appeal not found.', ephemeral: true });
      return true;
    }
    
    const message = interaction.fields.getTextInputValue('info_message');
    
    addAppealHistory(appealId, 'info_requested', `Staff requested more info: ${message}`, interaction.user.id);
    
    try {
      const user = await interaction.client.users.fetch(appeal.userId);
      const guild = await interaction.client.guilds.fetch(appeal.guildId);
      
      const dmEmbed = new EmbedBuilder()
        .setTitle('💬 More Information Needed')
        .setDescription(`Staff reviewing your ban appeal for **${guild.name}** need more information.`)
        .addFields(
          { name: 'Staff Message', value: message },
          { name: 'Appeal ID', value: appealId }
        )
        .setColor('#3498db')
        .setFooter({ text: 'Please reply to this DM with the requested information.' })
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      await interaction.reply({ content: 'Could not DM the user. They may have DMs disabled.', ephemeral: true });
      return true;
    }
    
    await interaction.reply({ content: '💬 Message sent to user requesting more information.', ephemeral: true });
    return true;
  } catch (error) {
    console.error('[Appeals] Error handling ask info modal:', error);
    await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    return true;
  }
}

async function handleViewHistory(interaction) {
  try {
    const appealId = interaction.customId.split(':')[2];
    const appeal = getAppeal(appealId);
    
    if (!appeal) {
      await interaction.reply({ content: 'Appeal not found.', ephemeral: true });
      return;
    }
    
    const history = appeal.history || [];
    
    let historyText = history.map(h => {
      const time = new Date(h.timestamp).toLocaleString();
      return `**${h.action.toUpperCase()}** - ${time}\n${h.details}${h.staffId ? ` (by <@${h.staffId}>)` : ''}`;
    }).join('\n\n');
    
    if (!historyText) historyText = 'No history available.';
    
    const embed = new EmbedBuilder()
      .setTitle(`📜 Appeal History: ${appealId}`)
      .setDescription(historyText.substring(0, 4000))
      .setColor('#9b59b6')
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('[Appeals] Error viewing history:', error);
    await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
  }
}

function addAuditLog(guildId, logData) {
  const logs = loadData('auditLogs', {});
  if (!logs[guildId]) logs[guildId] = [];
  logs[guildId].unshift({
    ...logData,
    timestamp: Date.now()
  });
  if (logs[guildId].length > 1000) logs[guildId] = logs[guildId].slice(0, 1000);
  saveData('auditLogs', logs);
}
