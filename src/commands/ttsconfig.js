import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/storage.js';

export const data = new SlashCommandBuilder()
  .setName('ttsconfig')
  .setDescription('Configure TTS (text-to-speech) settings for the server')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setchannel')
      .setDescription('Set the channel where TTS will be triggered')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Text channel for TTS messages')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable TTS feature')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();
    const config = getGuildConfig(interaction.guildId);

    if (subcommand === 'setchannel') {
      const channel = interaction.options.getChannel('channel');

      if (!config.tts) {
        config.tts = {};
      }

      const ttsConfig = {
        tts: {
          enabled: true,
          channelId: channel.id
        }
      };
      setGuildConfig(interaction.guildId, ttsConfig);

      await interaction.reply({
        content: `✅ TTS enabled! Messages in ${channel} will be spoken in your voice channel.\n\n**Rules:**\n• Max 150 characters per message\n• 10 second cooldown per user\n• No @mentions allowed\n• Messages queued automatically`,
        ephemeral: true
      });

      console.log(`[TTS] Configured for guild ${interaction.guildId}, channel ${channel.id}`);
    }

    if (subcommand === 'disable') {
      const ttsConfig = {
        tts: {
          enabled: false
        }
      };
      setGuildConfig(interaction.guildId, ttsConfig);

      await interaction.reply({
        content: '❌ TTS disabled.',
        ephemeral: true
      });

      console.log(`[TTS] Disabled for guild ${interaction.guildId}`);
    }
  } catch (error) {
    console.error('Error in ttsconfig command:', error);
    await interaction.reply({
      content: '❌ An error occurred while configuring TTS.',
      ephemeral: true
    });
  }
}
