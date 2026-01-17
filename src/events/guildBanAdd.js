import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } from 'discord.js';
import { getAppealsConfig, addBanRecord, generateCaseId } from '../utils/storage.js';

export const name = 'guildBanAdd';
export const once = false;

export async function execute(ban, client) {
  const { guild, user } = ban;
  
  try {
    const config = getAppealsConfig(guild.id);
    
    if (!config.enabled) {
      console.log(`[Appeals] Disabled for guild ${guild.id}, skipping DM for user ${user.tag}`);
      return;
    }
    
    let reason = 'No reason provided';
    let moderatorId = null;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 5
      });
      
      const banLog = auditLogs.entries.find(entry => 
        entry.target?.id === user.id && 
        Date.now() - entry.createdTimestamp < 10000
      );
      
      if (banLog) {
        reason = banLog.reason || 'No reason provided';
        moderatorId = banLog.executor?.id || null;
      }
    } catch (auditError) {
      console.log(`[Appeals] Could not fetch audit logs: ${auditError.message}`);
    }
    
    const caseId = generateCaseId();
    
    addBanRecord(guild.id, user.id, {
      caseId,
      reason,
      moderatorId,
      userTag: user.tag,
      userId: user.id
    });
    
    const template = config.dmTemplate || {};
    const embedTitle = (template.title || 'You were banned from {server}')
      .replace('{server}', guild.name);
    const embedDescription = (template.description || 'You have been banned from **{server}**.\n\n**Reason:** {reason}\n**Case ID:** {caseId}\n\nIf you believe this was a mistake, you can submit an appeal.')
      .replace('{server}', guild.name)
      .replace('{reason}', reason)
      .replace('{caseId}', caseId);
    
    const colorHex = (template.color || '#e74c3c').replace('#', '');
    const colorInt = parseInt(colorHex, 16);
    
    const embed = new EmbedBuilder()
      .setTitle(embedTitle)
      .setDescription(embedDescription)
      .setColor(colorInt)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: `Case ID: ${caseId}` });
    
    const buttons = [];
    
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`appeal:submit:${guild.id}:${caseId}`)
        .setLabel('Submit Appeal')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝')
    );
    
    if (config.rulesLink) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('View Rules')
          .setStyle(ButtonStyle.Link)
          .setURL(config.rulesLink)
          .setEmoji('📋')
      );
    }
    
    if (config.supportServerLink) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Support Server')
          .setStyle(ButtonStyle.Link)
          .setURL(config.supportServerLink)
          .setEmoji('💬')
      );
    }
    
    const row = new ActionRowBuilder().addComponents(buttons);
    
    try {
      await user.send({ embeds: [embed], components: [row] });
      console.log(`[Appeals] Sent ban appeal DM to ${user.tag} (Case: ${caseId})`);
    } catch (dmError) {
      console.log(`[Appeals] Could not DM user ${user.tag}: ${dmError.message}`);
      
      const { loadData, saveData } = await import('../utils/storage.js');
      const dmFailures = loadData('appeal-dm-failures', []);
      dmFailures.push({
        guildId: guild.id,
        userId: user.id,
        userTag: user.tag,
        caseId,
        timestamp: Date.now(),
        error: dmError.message
      });
      saveData('appeal-dm-failures', dmFailures);
    }
    
  } catch (error) {
    console.error('[Appeals] Error in guildBanAdd handler:', error);
  }
}
