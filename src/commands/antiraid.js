import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { loadData, saveData } from '../utils/storage.js';

export const data = new SlashCommandBuilder()
  .setName('antiraid')
  .setDescription('Configure anti-raid protection system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Enable anti-raid protection'))
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable anti-raid protection'))
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('View current anti-raid settings'))
  .addSubcommand(sub =>
    sub.setName('jointhreshold')
      .setDescription('Set join rate threshold')
      .addIntegerOption(opt =>
        opt.setName('joins')
          .setDescription('Number of joins')
          .setRequired(true)
          .setMinValue(3)
          .setMaxValue(50))
      .addIntegerOption(opt =>
        opt.setName('seconds')
          .setDescription('Time window in seconds')
          .setRequired(true)
          .setMinValue(5)
          .setMaxValue(120)))
  .addSubcommand(sub =>
    sub.setName('accountage')
      .setDescription('Set minimum account age')
      .addIntegerOption(opt =>
        opt.setName('days')
          .setDescription('Minimum account age in days')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(365)))
  .addSubcommand(sub =>
    sub.setName('action')
      .setDescription('Set action when raid detected')
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Action to take')
          .setRequired(true)
          .addChoices(
            { name: 'Timeout (1 hour)', value: 'timeout' },
            { name: 'Kick', value: 'kick' },
            { name: 'Ban', value: 'ban' },
            { name: 'Lockdown Server', value: 'lockdown' }
          )))
  .addSubcommand(sub =>
    sub.setName('logchannel')
      .setDescription('Set raid alerts channel')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Channel for raid alerts')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub =>
    sub.setName('whitelist')
      .setDescription('Manage whitelist')
      .addStringOption(opt =>
        opt.setName('action')
          .setDescription('Add or remove')
          .setRequired(true)
          .addChoices(
            { name: 'Add Role', value: 'add_role' },
            { name: 'Remove Role', value: 'remove_role' }
          ))
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role to whitelist')
          .setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('raidmode')
      .setDescription('Toggle emergency raid mode (instant lockdown)')
      .addBooleanOption(opt =>
        opt.setName('activate')
          .setDescription('Activate or deactivate raid mode')
          .setRequired(true)));

export async function execute(interaction) {
  const guildId = interaction.guild.id;
  const subcommand = interaction.options.getSubcommand();
  
  const security = loadData('security', {});
  if (!security[guildId]) {
    security[guildId] = {
      antiraid: {
        enabled: false,
        joinThreshold: { joins: 10, seconds: 30 },
        accountAge: 7,
        action: 'timeout',
        logChannelId: null,
        whitelistedRoles: [],
        raidMode: false
      }
    };
  }
  
  const config = security[guildId].antiraid;
  
  switch (subcommand) {
    case 'enable': {
      config.enabled = true;
      saveData('security', security);
      
      const embed = new EmbedBuilder()
        .setTitle('Anti-Raid Enabled')
        .setDescription('Anti-raid protection is now active.')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Join Threshold', value: `${config.joinThreshold.joins} joins / ${config.joinThreshold.seconds}s`, inline: true },
          { name: 'Account Age', value: `${config.accountAge} days minimum`, inline: true },
          { name: 'Action', value: config.action, inline: true }
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
          .setTitle('Anti-Raid Disabled')
          .setDescription('Anti-raid protection has been disabled.')
          .setColor(0xff0000)
          .setTimestamp()]
      });
      break;
    }
    
    case 'status': {
      const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : 'Not set';
      const whitelistedRoles = config.whitelistedRoles.length > 0 
        ? config.whitelistedRoles.map(r => `<@&${r}>`).join(', ')
        : 'None';
      
      const embed = new EmbedBuilder()
        .setTitle('Anti-Raid Status')
        .setColor(config.enabled ? 0x00ff00 : 0xff0000)
        .addFields(
          { name: 'Status', value: config.enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Raid Mode', value: config.raidMode ? 'ACTIVE' : 'Inactive', inline: true },
          { name: 'Join Threshold', value: `${config.joinThreshold.joins} joins / ${config.joinThreshold.seconds}s`, inline: true },
          { name: 'Account Age', value: `${config.accountAge} days minimum`, inline: true },
          { name: 'Action', value: config.action, inline: true },
          { name: 'Log Channel', value: logChannel, inline: true },
          { name: 'Whitelisted Roles', value: whitelistedRoles, inline: false }
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      break;
    }
    
    case 'jointhreshold': {
      const joins = interaction.options.getInteger('joins');
      const seconds = interaction.options.getInteger('seconds');
      
      config.joinThreshold = { joins, seconds };
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Join Threshold Updated')
          .setDescription(`Raid will be detected if ${joins} members join within ${seconds} seconds.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'accountage': {
      const days = interaction.options.getInteger('days');
      config.accountAge = days;
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Account Age Threshold Updated')
          .setDescription(days === 0 
            ? 'Account age check is now disabled.'
            : `Accounts younger than ${days} days will be flagged.`)
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
        timeout: 'Timeout (1 hour)',
        kick: 'Kick',
        ban: 'Ban',
        lockdown: 'Server Lockdown'
      };
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Raid Action Updated')
          .setDescription(`When a raid is detected, the action will be: **${actionNames[actionType]}**`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'logchannel': {
      const channel = interaction.options.getChannel('channel');
      config.logChannelId = channel.id;
      saveData('security', security);
      
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle('Log Channel Set')
          .setDescription(`Raid alerts will be sent to ${channel}.`)
          .setColor(0x00b3ff)
          .setTimestamp()]
      });
      break;
    }
    
    case 'whitelist': {
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      
      if (action === 'add_role') {
        if (!config.whitelistedRoles.includes(role.id)) {
          config.whitelistedRoles.push(role.id);
        }
        saveData('security', security);
        
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Role Whitelisted')
            .setDescription(`${role} members will bypass anti-raid checks.`)
            .setColor(0x00ff00)
            .setTimestamp()]
        });
      } else {
        config.whitelistedRoles = config.whitelistedRoles.filter(r => r !== role.id);
        saveData('security', security);
        
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Role Removed from Whitelist')
            .setDescription(`${role} is no longer whitelisted.`)
            .setColor(0xff9900)
            .setTimestamp()]
        });
      }
      break;
    }
    
    case 'raidmode': {
      const activate = interaction.options.getBoolean('activate');
      config.raidMode = activate;
      saveData('security', security);
      
      if (activate) {
        try {
          const everyone = interaction.guild.roles.everyone;
          await everyone.setPermissions(everyone.permissions.remove(['SendMessages', 'AddReactions', 'CreatePublicThreads', 'CreatePrivateThreads']));
          
          await interaction.guild.setVerificationLevel(4);
        } catch (error) {
          console.error('Raid mode activation error:', error);
        }
        
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('RAID MODE ACTIVATED')
            .setDescription('Server is now in lockdown:\n- Messages disabled for @everyone\n- Verification level set to highest\n- New members will be closely monitored')
            .setColor(0xff0000)
            .setTimestamp()]
        });
        
        if (config.logChannelId) {
          try {
            const logChannel = await interaction.guild.channels.fetch(config.logChannelId);
            await logChannel.send({
              embeds: [new EmbedBuilder()
                .setTitle('RAID MODE ACTIVATED')
                .setDescription(`Activated by ${interaction.user}`)
                .setColor(0xff0000)
                .setTimestamp()]
            });
          } catch (e) {}
        }
      } else {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle('Raid Mode Deactivated')
            .setDescription('Raid mode has been turned off. Please manually restore permissions if needed.')
            .setColor(0x00ff00)
            .setTimestamp()]
        });
      }
      break;
    }
  }
  
  addAuditLog(guildId, {
    action: `antiraid_${subcommand}`,
    userId: interaction.user.id,
    details: `Anti-raid ${subcommand} executed`
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
