import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Make the bot join your voice channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Voice channel to join (optional, uses your current channel if not specified)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .setDMPermission(false);

export async function execute(interaction) {
  try {
    let targetChannel = interaction.options.getChannel('channel');

    // If no channel specified, use user's current voice channel
    if (!targetChannel) {
      targetChannel = interaction.member?.voice?.channel;
      
      if (!targetChannel) {
        await interaction.reply({
          content: '❌ You must be in a voice channel or specify one!',
          ephemeral: true
        });
        return;
      }
    }

    // Check if bot already in a VC
    const existingConnection = getVoiceConnection(interaction.guildId);
    if (existingConnection) {
      await interaction.reply({
        content: `✅ Bot is already in a voice channel: **${existingConnection.joinConfig.channelId}**`,
        ephemeral: true
      });
      return;
    }

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    await interaction.reply({
      content: `✅ Bot joined **${targetChannel.name}**!`,
      ephemeral: true
    });

    console.log(`[JOIN] Bot joined ${targetChannel.name} (${targetChannel.id}) in guild ${interaction.guildId}`);

  } catch (error) {
    console.error('Error in /join command:', error);
    await interaction.reply({
      content: '❌ Failed to join voice channel.',
      ephemeral: true
    });
  }
}
