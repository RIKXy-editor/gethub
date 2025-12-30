import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('copy')
  .setDescription('Create an exact copy of the current channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction) {
  const channel = interaction.channel;
  
  if (!channel) {
    return await interaction.reply({
      content: '❌ Could not determine the current channel.',
      ephemeral: true
    });
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    // Generate new channel name, handle conflicts
    let newName = `${channel.name}-copy`;
    let nameConflictCount = 1;
    
    while (interaction.guild.channels.cache.find(c => c.name === newName)) {
      newName = `${channel.name}-copy-${nameConflictCount}`;
      nameConflictCount++;
    }

    // Prepare base channel options
    const channelOptions = {
      name: newName,
      type: channel.type,
      parent: channel.parentId,
      position: channel.position,
      nsfw: channel.nsfw || false
    };

    // Copy text channel specific settings
    if (channel.isTextBased()) {
      if (channel.topic) channelOptions.topic = channel.topic;
      if (channel.rateLimitPerUser) channelOptions.rateLimitPerUser = channel.rateLimitPerUser;
    }

    // Copy voice channel specific settings
    if (channel.isVoiceBased()) {
      if (channel.bitrate) channelOptions.bitrate = channel.bitrate;
      if (channel.userLimit) channelOptions.userLimit = channel.userLimit;
    }

    // Copy permission overwrites exactly
    const permissionOverwrites = [];
    channel.permissionOverwrites.cache.forEach(overwrite => {
      permissionOverwrites.push({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield
      });
    });
    channelOptions.permissionOverwrites = permissionOverwrites;

    // Create the new channel
    const newChannel = await interaction.guild.channels.create(channelOptions);

    console.log(`[COPY] Channel copied: ${channel.name} (#${channel.id}) -> ${newName} (#${newChannel.id})`);

    await interaction.editReply({
      content: `✅ Channel copied successfully! Created **#${newName}** with all settings and permissions.`
    });

  } catch (error) {
    console.error('Error in copy command:', error);
    
    await interaction.editReply({
      content: '❌ An error occurred while copying the channel. Check bot permissions.'
    });
  }
}
