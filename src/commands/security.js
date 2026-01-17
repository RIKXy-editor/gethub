import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';

export const data = new SlashCommandBuilder()
  .setName('security')
  .setDescription('Configure anti-nuke protection system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Enable anti-nuke protection'))
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable anti-nuke protection'))
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('View current security settings'))
  .addSubcommand(sub =>
    sub.setName('logchannel')
      .setDescription('Set security events channel')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Channel for security alerts')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub =>
    sub.setName('thresholds')
      .setDescription('Set detection thresholds')
      .addIntegerOption(opt =>
        opt.setName('channel_deletes')
          .setDescription('Max channel deletes before action (0 to disable)')
          .setMinValue(0)
          .setMaxValue(20))
      .addIntegerOption(opt =>
        opt.setName('role_deletes')
          .setDescription('Max role deletes before action (0 to disable)')
          .setMinValue(0)
          .setMaxValue(20))
      .addIntegerOption(opt =>
        opt.setName('bans')
          .setDescription('Max bans before action (0 to disable)')
          .setMinValue(0)
          .setMaxValue(50))
      .addIntegerOption(opt =>
        opt.setName('timeframe')
          .setDescription('Detection timeframe in seconds')
          .setMinValue(10)
          .setMaxValue(300)))
  .addSubcommand(sub =>
    sub.setName('action')
      .setDescription('Set action when nuke detected')
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Action to take against offender')
          .setRequired(true)
          .addChoices(
            { name: 'Remove Permissions', value: 'remove_perms' },
            { name: 'Kick', value: 'kick' },
            { name: 'Ban', value: 'ban' },
            { name: 'Lockdown + Remove Perms', value: 'lockdown' }
          )))
  .addSubcommand(sub =>
    sub.setName('whitelist')
      .setDescription('Manage trusted users/roles')
      .addStringOption(opt =>
        opt.setName('action')
          .setDescription('Add or remove')
          .setRequired(true)
          .addChoices(
            { name: 'Add User', value: 'add_user' },
            { name: 'Remove User', value: 'remove_user' },
            { name: 'Add Role', value: 'add_role' },
            { name: 'Remove Role', value: 'remove_role' }
          ))
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User to whitelist'))
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role to whitelist')))
  .addSubcommand(sub =>
    sub.setName('events')
      .setDescription('View recent security events'));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const subcommand = interaction.options.getSubcommand();
  
  const security = loadData('security', {});
  if (!security[guildId]) {
    security[guildId] = {
      antinuke: {
        enabled: false,
        logChannelId: null,
        thresholds: {
          channelDeletes: 3,
          roleDeletes: 3,
          bans: 5,
          timeframe: 60
        },
        action: 'remove_perms',
        whitelistedUsers: [],
        whitelistedRoles: []
      }
    };
  }
  
  if (!security[guildId].antinuke) {
    security[guildId].antinuke = {
      enabled: false,
      logChannelId: null,
      thresholds: {
        channelDeletes: 3,
        roleDeletes: 3,
        bans: 5,
        timeframe: 60
      },
      action: 'remove_perms',
      whitelistedUsers: [],
      whitelistedRoles: []
    };
  }
  
  const config = security[guildId].antinuke;
  
  switch (subcommand) {
    case 'enable': {
      config.enabled = true;
      saveData('security', security);
      
      const embed = new EmbedBuilder()
        .setTitle('Anti-Nuke Enabled')
        .setDescription('Anti-nuke protection is now active. The bot will monitor for destructive actions.')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Channel Delete Threshold', value: `${config.thresholds.channelDeletes}`, inline: true },
          { name: 'Role Delete Threshold', value: `${config.thresholds.roleDeletes}`, inline: true },
          { name: 'Ban Threshold', value: `${config.thresholds.bans}`, inline: true },
          { name: 'Timeframe', value: `${config.thresholds.timeframe} seconds`, inline: true },
          { name: 'Action', value: config.action.replace('_', ' '), inline: true }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      break;
    }
    
    case 'disable': {
      config.enabled = false;
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Anti-Nuke Disabled')
          .setDescription('Anti-nuke protection has been disabled.')
          .setColor(0xff0000)
          .setTimestamp()]
      });
      break;
    }
    
    case 'status': {
      const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : 'Not set';
      const whitelistedUsers = config.whitelistedUsers?.length > 0 
        ? config.whitelistedUsers.map(u => `<@${u}>`).join(', ')
        : 'None';
      const whitelistedRoles = config.whitelistedRoles?.length > 0 
        ? config.whitelistedRoles.map(r => `<@&${r}>`).join(', ')
        : 'None';
      
      const embed = new EmbedBuilder()
        .setTitle('Security Status')
        .setColor(config.enabled ? 0x00ff00 : 0xff0000)
        .addFields(
          { name: 'Status', value: config.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Action', value: config.action?.replace('_', ' ') || 'remove perms', inline: true },
          { name: 'Log Channel', value: logChannel, inline: true },
          { name: 'Channel Delete Threshold', value: `${config.thresholds?.channelDeletes || 3}`, inline: true },
          { name: 'Role Delete Threshold', value: `${config.thresholds?.roleDeletes || 3}`, inline: true },
          { name: 'Ban Threshold', value: `${config.thresholds?.bans || 5}`, inline: true },
          { name: 'Timeframe', value: `${config.thresholds?.timeframe || 60} seconds`, inline: true },
          { name: 'Whitelisted Users', value: whitelistedUsers, inline: false },
          { name: 'Whitelisted Roles', value: whitelistedRoles, inline: false }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      break;
    }
    
    case 'logchannel': {
      const channel = interaction.options.getChannel('channel');
      config.logChannelId = channel.id;
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Security Log Channel Set')
          .setDescription(`Security events will be logged to ${channel}.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'thresholds': {
      const channelDeletes = interaction.options.getInteger('channel_deletes');
      const roleDeletes = interaction.options.getInteger('role_deletes');
      const bans = interaction.options.getInteger('bans');
      const timeframe = interaction.options.getInteger('timeframe');
      
      if (channelDeletes !== null) config.thresholds.channelDeletes = channelDeletes;
      if (roleDeletes !== null) config.thresholds.roleDeletes = roleDeletes;
      if (bans !== null) config.thresholds.bans = bans;
      if (timeframe !== null) config.thresholds.timeframe = timeframe;
      
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Thresholds Updated')
          .setDescription('Security detection thresholds have been updated.')
          .addFields(
            { name: 'Channel Deletes', value: `${config.thresholds.channelDeletes}`, inline: true },
            { name: 'Role Deletes', value: `${config.thresholds.roleDeletes}`, inline: true },
            { name: 'Bans', value: `${config.thresholds.bans}`, inline: true },
            { name: 'Timeframe', value: `${config.thresholds.timeframe}s`, inline: true }
          )
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'action': {
      const actionType = interaction.options.getString('type');
      config.action = actionType;
      saveData('security', security);
      
      const actionNames = {
        remove_perms: 'Remove Permissions',
        kick: 'Kick Offender',
        ban: 'Ban Offender',
        lockdown: 'Lockdown + Remove Permissions'
      };
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Security Action Updated')
          .setDescription(`When a nuke attempt is detected, action will be: **${actionNames[actionType]}**`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'whitelist': {
      const action = interaction.options.getString('action');
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      
      if (!config.whitelistedUsers) config.whitelistedUsers = [];
      if (!config.whitelistedRoles) config.whitelistedRoles = [];
      
      if (action === 'add_user' && user) {
        if (!config.whitelistedUsers.includes(user.id)) {
          config.whitelistedUsers.push(user.id);
        }
        saveData('security', security);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('User Whitelisted')
            .setDescription(`${user} is now trusted and will bypass security checks.`)
            .setColor(0x00ff00)
            .setTimestamp()]
        });
      } else if (action === 'remove_user' && user) {
        config.whitelistedUsers = config.whitelistedUsers.filter(u => u !== user.id);
        saveData('security', security);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('User Removed')
            .setDescription(`${user} is no longer whitelisted.`)
            .setColor(0xff9900)
            .setTimestamp()]
        });
      } else if (action === 'add_role' && role) {
        if (!config.whitelistedRoles.includes(role.id)) {
          config.whitelistedRoles.push(role.id);
        }
        saveData('security', security);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Role Whitelisted')
            .setDescription(`${role} members are now trusted.`)
            .setColor(0x00ff00)
            .setTimestamp()]
        });
      } else if (action === 'remove_role' && role) {
        config.whitelistedRoles = config.whitelistedRoles.filter(r => r !== role.id);
        saveData('security', security);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Role Removed')
            .setDescription(`${role} is no longer whitelisted.`)
            .setColor(0xff9900)
            .setTimestamp()]
        });
      } else {
        await interaction.reply({
          content: 'Please specify a user or role for the whitelist action.',
          ephemeral: true
        });
      }
      break;
    }
    
    case 'events': {
      const events = loadData('securityEvents', {});
      const guildEvents = events[guildId] || [];
      
      if (guildEvents.length === 0) {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Security Events')
            .setDescription('No security events recorded.')
            .setColor(0x00b3ff)
            .setTimestamp()]
        });
        return;
      }
      
      const recentEvents = guildEvents.slice(0, 10);
      const eventList = recentEvents.map((e, i) => {
        const time = new Date(e.timestamp).toLocaleString();
        return `**${i + 1}.** ${e.type} - ${e.details}\n   *${time}*`;
      }).join('\n\n');
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Recent Security Events')
          .setDescription(eventList || 'No events')
          .setColor(0xff9900)
          .setFooter({ text: `Showing ${recentEvents.length} of ${guildEvents.length} events` })
          .setTimestamp()]
      });
      break;
    }
  }
  
  addAuditLog(guildId, {
    action: `security_${subcommand}`,
    userId: interaction.user.id,
    details: `Security ${subcommand} executed`
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
