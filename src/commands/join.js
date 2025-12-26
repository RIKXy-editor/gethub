import { SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Join your current voice channel');

export async function execute(interaction) {
  const member = interaction.guild.members.cache.get(interaction.user.id);
  
  if (!member.voice.channel) {
    return await interaction.reply({
      content: '❌ You must be in a voice channel to use this command.',
      ephemeral: true
    });
  }
  
  try {
    const connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });
    
    // Store connection for later use
    interaction.client.voiceConnections = interaction.client.voiceConnections || new Map();
    interaction.client.voiceConnections.set(interaction.guild.id, connection);
    
    await interaction.reply({
      content: `✅ Joined **${member.voice.channel.name}**. Use \`/tts\` to speak!`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error joining voice channel:', error);
    await interaction.reply({
      content: '❌ Failed to join the voice channel.',
      ephemeral: true
    });
  }
}
