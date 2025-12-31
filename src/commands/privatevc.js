import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('privatevc')
  .setDescription('Create a private voice channel for your group')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Name of the private voice channel')
      .setRequired(true)
      .setMaxLength(32)
  )
  .setDMPermission(false);

export async function execute(interaction) {
  try {
    const channelName = interaction.options.getString('name');
    const guild = interaction.guild;
    const member = interaction.member;

    // Create private voice channel
    const privateVC = await guild.channels.create({
      name: `🔒 ${channelName}`,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['Connect']
        },
        {
          id: member.id,
          allow: ['Connect', 'Speak', 'ManageChannels']
        }
      ]
    });

    // Move user to the new channel
    await member.voice.setChannel(privateVC);

    await interaction.reply({
      content: `✅ Private voice channel created: **${privateVC.name}**\n\nYou can invite people by right-clicking the channel and selecting "Copy Channel Link" or by giving them permission directly.`,
      ephemeral: true
    });

    console.log(`[PRIVATE VC] Created by ${member.user.tag}: ${privateVC.name} (${privateVC.id})`);

  } catch (error) {
    console.error('Error in privatevc command:', error);
    await interaction.reply({
      content: '❌ Failed to create private voice channel.',
      ephemeral: true
    });
  }
}
