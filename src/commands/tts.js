import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const userCooldowns = new Map();
const COOLDOWN_MS = 5000; // 5 seconds cooldown per user
const MAX_CHARS = 200;

export const data = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('Convert text to speech and play it in voice channel')
  .addStringOption(option =>
    option.setName('text')
      .setDescription('Text to convert to speech (max 200 characters)')
      .setRequired(true)
      .setMaxLength(MAX_CHARS)
  );

function sanitizeText(text) {
  // Remove @everyone, @here
  text = text.replace(/@everyone|@here/g, '');
  
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, '');
  
  // Limit emojis
  text = text.replace(/([^\w\s])\1{2,}/g, '$1$1');
  
  return text.trim();
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const now = Date.now();
  
  // Check cooldown
  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + COOLDOWN_MS;
    if (now < expirationTime) {
      const timeLeft = Math.ceil((expirationTime - now) / 1000);
      return await interaction.reply({
        content: `⏳ Please wait ${timeLeft} seconds before using TTS again.`,
        ephemeral: true
      });
    }
  }
  
  // Check if bot is in voice channel
  const connection = interaction.client.voiceConnections?.get(interaction.guild.id);
  if (!connection) {
    return await interaction.reply({
      content: '❌ Bot is not in a voice channel. Use `/join` first!',
      ephemeral: true
    });
  }
  
  // Set cooldown
  userCooldowns.set(userId, now);
  
  try {
    await interaction.deferReply({ ephemeral: true });
    
    let text = interaction.options.getString('text');
    text = sanitizeText(text);
    
    if (!text) {
      return await interaction.editReply({
        content: '❌ Text is empty after sanitization. Please use valid text.'
      });
    }
    
    // Create temporary audio file
    const tempDir = '/tmp';
    const audioFile = path.join(tempDir, `tts-${Date.now()}.wav`);
    
    // Use espeak for TTS (available on Linux)
    try {
      await execAsync(`espeak-ng "${text}" -w "${audioFile}" --speed=150`);
    } catch (error) {
      console.error('TTS generation error:', error);
      return await interaction.editReply({
        content: '❌ Failed to generate speech. Please try again.'
      });
    }
    
    // Create audio resource and player
    const resource = createAudioResource(audioFile);
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });
    
    connection.subscribe(player);
    player.play(resource);
    
    // Wait for playback to finish and clean up
    player.once(AudioPlayerStatus.Idle, () => {
      try {
        fs.unlinkSync(audioFile);
      } catch (err) {
        console.error('Error cleaning up audio file:', err);
      }
    });
    
    player.on('error', error => {
      console.error('Audio player error:', error);
      try {
        fs.unlinkSync(audioFile);
      } catch (err) {
        console.error('Error cleaning up audio file:', err);
      }
    });
    
    await interaction.editReply({
      content: `🔊 Speaking: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`
    });
    
  } catch (error) {
    console.error('Error in TTS command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while processing your request.'
    });
  }
}
