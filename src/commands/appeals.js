import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { loadData, saveData, getAppealsConfig, setAppealsConfig } from '../utils/storage.js';

export const data = new SlashCommandBuilder()
  .setName('appeals')
  .setDescription('Configure ban appeals system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Enable ban appeals system'))
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable ban appeals system'))
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('View current appeals settings'))
  .addSubcommand(sub =>
    sub.setName('channel')
      .setDescription('Set the appeals review channel')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Channel for staff to review appeals')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub =>
    sub.setName('staffrole')
      .setDescription('Set the staff role for reviewing appeals')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role that can review appeals')
          .setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('cooldown')
      .setDescription('Set appeal cooldown in days')
      .addIntegerOption(opt =>
        opt.setName('days')
          .setDescription('Days between appeal submissions')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(30)))
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List pending appeals'))
  .addSubcommand(sub =>
    sub.setName('stats')
      .setDescription('View appeals statistics'));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const subcommand = interaction.options.getSubcommand();
  
  const config = getAppealsConfig(guildId);
  
  switch (subcommand) {
    case 'enable': {
      config.enabled = true;
      setAppealsConfig(guildId, config);
      
      const embed = new EmbedBuilder()
        .setTitle('Ban Appeals Enabled')
        .setDescription('Ban appeals system is now active. Banned users will automatically receive a DM with an appeal option.')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Appeals Channel', value: config.appealsChannelId ? `<#${config.appealsChannelId}>` : 'Not set', inline: true },
          { name: 'Staff Role', value: config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not set', inline: true },
          { name: 'Cooldown', value: `${config.cooldownDays || 7} days`, inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      break;
    }
    
    case 'disable': {
      config.enabled = false;
      setAppealsConfig(guildId, config);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Ban Appeals Disabled')
          .setDescription('Ban appeals system has been disabled. Banned users will no longer receive appeal DMs.')
          .setColor(0xff0000)
          .setTimestamp()]
      });
      break;
    }
    
    case 'status': {
      const appeals = loadData('appeals', {});
      const guildAppeals = Object.values(appeals).filter(a => a.guildId === guildId);
      const pending = guildAppeals.filter(a => a.status === 'PENDING').length;
      const approved = guildAppeals.filter(a => a.status === 'APPROVED').length;
      const denied = guildAppeals.filter(a => a.status === 'DENIED').length;
      
      const embed = new EmbedBuilder()
        .setTitle('Ban Appeals Status')
        .setColor(config.enabled ? 0x00ff00 : 0xff0000)
        .addFields(
          { name: 'System Status', value: config.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Appeals Channel', value: config.appealsChannelId ? `<#${config.appealsChannelId}>` : 'Not set', inline: true },
          { name: 'Staff Role', value: config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not set', inline: true },
          { name: 'Cooldown', value: `${config.cooldownDays || 7} days`, inline: true },
          { name: 'Pending Appeals', value: `${pending}`, inline: true },
          { name: 'Total Appeals', value: `${guildAppeals.length}`, inline: true },
          { name: 'Approved', value: `${approved}`, inline: true },
          { name: 'Denied', value: `${denied}`, inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      break;
    }
    
    case 'channel': {
      const channel = interaction.options.getChannel('channel');
      config.appealsChannelId = channel.id;
      setAppealsConfig(guildId, config);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Appeals Channel Set')
          .setDescription(`Ban appeals will be posted to ${channel} for review.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'staffrole': {
      const role = interaction.options.getRole('role');
      config.staffRoleId = role.id;
      setAppealsConfig(guildId, config);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Staff Role Set')
          .setDescription(`${role} members can now review and manage appeals.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'cooldown': {
      const days = interaction.options.getInteger('days');
      config.cooldownDays = days;
      setAppealsConfig(guildId, config);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Cooldown Updated')
          .setDescription(`Users must wait ${days} days between appeal submissions.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'list': {
      const appeals = loadData('appeals', {});
      const pendingAppeals = Object.values(appeals)
        .filter(a => a.guildId === guildId && a.status === 'PENDING')
        .slice(0, 10);
      
      if (pendingAppeals.length === 0) {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Pending Appeals')
            .setDescription('No pending appeals.')
            .setColor(0x00b3ff)
            .setTimestamp()]
        });
        return;
      }
      
      const appealList = pendingAppeals.map((a, i) => {
        const time = new Date(a.createdAt).toLocaleDateString();
        return `**${i + 1}.** ${a.userTag} (${a.userId})\n   Case: ${a.caseId} | Submitted: ${time}`;
      }).join('\n\n');
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Pending Appeals')
          .setDescription(appealList)
          .setColor(0xf39c12)
          .setFooter({ text: `Showing ${pendingAppeals.length} pending appeals` })
          .setTimestamp()]
      });
      break;
    }
    
    case 'stats': {
      const appeals = loadData('appeals', {});
      const guildAppeals = Object.values(appeals).filter(a => a.guildId === guildId);
      
      const pending = guildAppeals.filter(a => a.status === 'PENDING').length;
      const approved = guildAppeals.filter(a => a.status === 'APPROVED').length;
      const denied = guildAppeals.filter(a => a.status === 'DENIED').length;
      
      const lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentAppeals = guildAppeals.filter(a => a.createdAt > lastWeek).length;
      
      const approvalRate = guildAppeals.length > 0 
        ? Math.round((approved / guildAppeals.length) * 100) 
        : 0;
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Appeals Statistics')
          .setColor(0x9b59b6)
          .addFields(
            { name: 'Total Appeals', value: `${guildAppeals.length}`, inline: true },
            { name: 'Pending', value: `${pending}`, inline: true },
            { name: 'This Week', value: `${recentAppeals}`, inline: true },
            { name: 'Approved', value: `${approved}`, inline: true },
            { name: 'Denied', value: `${denied}`, inline: true },
            { name: 'Approval Rate', value: `${approvalRate}%`, inline: true }
          )
          .setTimestamp()]
      });
      break;
    }
  }
  
  addAuditLog(guildId, {
    action: `appeals_${subcommand}`,
    userId: interaction.user.id,
    details: `Appeals ${subcommand} executed`
  });
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
