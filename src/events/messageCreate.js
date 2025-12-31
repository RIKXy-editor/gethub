import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { ttsQueue } from '../utils/ttsQueue.js';
import { getGuildConfig } from '../utils/storage.js';

export const name = 'messageCreate';
export const once = false;

export async function execute(message) {
  // Ignore bot messages
  if (message.author.bot) return;

  // Get TTS config
  const config = getGuildConfig(message.guildId);
  if (!config.tts || !config.tts.enabled || !config.tts.channelId) return;

  // Only process in TTS channel
  if (message.channelId !== config.tts.channelId) return;

  // Check if user is in a voice channel
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply({
      content: '❌ You must be in a voice channel to use TTS!',
      ephemeral: true
    }).catch(() => {});
    return;
  }

  // Check cooldown
  if (ttsQueue.isUserOnCooldown(message.author.id)) {
    await message.reply({
      content: '⏳ Please wait before using TTS again (10 second cooldown).',
      ephemeral: true
    }).catch(() => {});
    return;
  }

  // Validate message
  const validation = ttsQueue.validateMessage(message.content);
  if (!validation.valid) {
    await message.reply({
      content: `❌ ${validation.reason}`,
      ephemeral: true
    }).catch(() => {});
    return;
  }

  try {
    // Set cooldown
    ttsQueue.setCooldown(message.author.id);

    // Get or create connection
    let connection = getVoiceConnection(message.guildId);

    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guildId,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false
      });
      ttsQueue.setConnection(message.guildId, connection);
    }

    // Add message to queue
    await ttsQueue.addToQueue(message.guildId, {
      text: message.content,
      userId: message.author.id,
      username: message.author.username
    });

    // React to show it's queued
    await message.react('🔊').catch(() => {});

    console.log(`[TTS] ${message.author.tag}: "${message.content}" (queue: ${ttsQueue.getQueueSize(message.guildId)})`);

  } catch (error) {
    console.error('Error in TTS messageCreate event:', error);
    await message.reply({
      content: '❌ An error occurred while processing TTS.',
      ephemeral: true
    }).catch(() => {});
  }
}
