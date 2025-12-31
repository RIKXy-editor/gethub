import { VoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, '../../temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

class TTSQueue {
  constructor() {
    this.queues = new Map(); // guildId -> queue array
    this.connections = new Map(); // guildId -> connection
    this.players = new Map(); // guildId -> player
    this.idleTimers = new Map(); // guildId -> timer
    this.userCooldowns = new Map(); // userId -> timestamp
  }

  // Check if user is on cooldown
  isUserOnCooldown(userId, cooldownMs = 10000) {
    const lastTime = this.userCooldowns.get(userId);
    if (!lastTime) return false;
    return Date.now() - lastTime < cooldownMs;
  }

  // Set user cooldown
  setCooldown(userId) {
    this.userCooldowns.set(userId, Date.now());
  }

  // Validate message
  validateMessage(text) {
    const maxLength = 150;
    
    if (text.length > maxLength) {
      return { valid: false, reason: `Message too long (max ${maxLength} characters)` };
    }

    // Filter mentions
    if (text.includes('@everyone') || text.includes('@here')) {
      return { valid: false, reason: 'Mention filtering: @everyone/@here not allowed' };
    }

    if (/<@!?\d+>/.test(text)) {
      return { valid: false, reason: 'Mention filtering: User mentions not allowed' };
    }

    return { valid: true };
  }

  // Convert text to speech using Edge TTS
  async textToSpeech(text, userId) {
    return new Promise((resolve, reject) => {
      const filename = `tts_${userId}_${Date.now()}.mp3`;
      const filepath = path.join(tempDir, filename);

      // Use edge-tts through Node's exec
      const command = `edge-tts --text "${text.replace(/"/g, '\\"')}" --write-media "${filepath}"`;

      exec(command, (error) => {
        if (error) {
          reject(new Error(`TTS generation failed: ${error.message}`));
        } else {
          resolve(filepath);
        }
      });
    });
  }

  // Add message to queue
  async addToQueue(guildId, message) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, []);
    }

    const queue = this.queues.get(guildId);
    queue.push(message);

    // Start processing if not already
    if (queue.length === 1) {
      this.processQueue(guildId);
    }
  }

  // Process queue
  async processQueue(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) return;

    const message = queue[0];
    const connection = this.connections.get(guildId);

    if (!connection) {
      queue.shift();
      if (queue.length > 0) {
        this.processQueue(guildId);
      }
      return;
    }

    try {
      const audioFile = await this.textToSpeech(message.text, message.userId);
      const resource = createAudioResource(audioFile);
      const player = this.getOrCreatePlayer(guildId, connection);

      player.play(resource);

      // Wait for audio to finish
      await new Promise((resolve) => {
        const onFinish = () => {
          player.off(AudioPlayerStatus.Idle, onFinish);
          // Clean up temp file
          fs.unlink(audioFile, () => {});
          resolve();
        };
        player.once(AudioPlayerStatus.Idle, onFinish);
      });

      // Move to next message
      queue.shift();
      this.resetIdleTimer(guildId);

      if (queue.length > 0) {
        this.processQueue(guildId);
      }
    } catch (error) {
      console.error(`Error processing TTS for guild ${guildId}:`, error);
      queue.shift();
      if (queue.length > 0) {
        this.processQueue(guildId);
      }
    }
  }

  // Get or create player
  getOrCreatePlayer(guildId, connection) {
    if (this.players.has(guildId)) {
      return this.players.get(guildId);
    }

    const player = createAudioPlayer();
    connection.subscribe(player);
    this.players.set(guildId, player);
    return player;
  }

  // Set voice connection
  setConnection(guildId, connection) {
    this.connections.set(guildId, connection);
    this.resetIdleTimer(guildId);
  }

  // Reset idle timer (disconnect after 90 seconds idle)
  resetIdleTimer(guildId) {
    const existingTimer = this.idleTimers.get(guildId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const connection = this.connections.get(guildId);
      if (connection) {
        connection.destroy();
        this.connections.delete(guildId);
        this.players.delete(guildId);
        this.queues.delete(guildId);
      }
    }, 90000); // 90 seconds

    this.idleTimers.set(guildId, timer);
  }

  // Get queue size
  getQueueSize(guildId) {
    const queue = this.queues.get(guildId);
    return queue ? queue.length : 0;
  }
}

export const ttsQueue = new TTSQueue();
