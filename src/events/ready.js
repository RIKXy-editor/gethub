import { ActivityType, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { getScheduledMessages, getJobConfig, setJobConfig } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

const statuses = [
  { name: 'Managing Editors Club', type: ActivityType.Playing },
  { name: 'Editing Videos', type: ActivityType.Playing },
  { name: 'Searching Assets', type: ActivityType.Playing },
  { name: 'Rendering Projects', type: ActivityType.Playing },
  { name: 'Color Grading', type: ActivityType.Playing },
  { name: 'Audio Mixing', type: ActivityType.Playing },
  { name: 'Exporting Videos', type: ActivityType.Playing },
  { name: 'Managing Tickets', type: ActivityType.Watching }
];

let currentStatusIndex = 0;

function updateStatus(client) {
  const status = statuses[currentStatusIndex];
  client.user.setActivity(status.name, { type: status.type });
  currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
}

export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  
  updateStatus(client);
  setInterval(() => updateStatus(client), 15000);
  console.log('Rotating status started!');

  startScheduledMessageLoop(client);
  maintainJobPostingButton(client);
}

async function maintainJobPostingButton(client) {
  setInterval(async () => {
    try {
      const config = getJobConfig(GUILD_ID);
      if (!config.channelId) return;

      const channel = await client.channels.fetch(config.channelId).catch(() => null);
      if (!channel) return;

      // Check if button message exists
      if (config.buttonMessageId) {
        try {
          await channel.messages.fetch(config.buttonMessageId);
          return; // Message exists, no action needed
        } catch (error) {
          console.log('Job button message was deleted, recreating...');
        }
      }

      // Create new button message
      const button = new ButtonBuilder()
        .setCustomId('post_job_button')
        .setLabel('Post Job')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);
      const message = await channel.send({ components: [row] });
      setJobConfig(GUILD_ID, { buttonMessageId: message.id });
    } catch (error) {
      console.error('Error maintaining job button:', error);
    }
  }, 60000); // Check every minute
}

async function startScheduledMessageLoop(client) {
  setInterval(async () => {
    const messages = getScheduledMessages();
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const msg of messages) {
      if (msg.time !== currentTime) continue;

      const timeSinceLastRun = now.getTime() - msg.lastRun;
      const shouldRun = msg.frequency === 'once' ? timeSinceLastRun > 60000 :
                       msg.frequency === '12h' ? timeSinceLastRun > 43200000 :
                       msg.frequency === 'daily' ? timeSinceLastRun > 86400000 :
                       msg.frequency === 'weekly' ? timeSinceLastRun > 604800000 :
                       msg.frequency === 'monthly' ? timeSinceLastRun > 2592000000 : false;

      if (shouldRun) {
        try {
          const channel = await client.channels.fetch(msg.channelId);
          if (channel) await channel.send(msg.message);
          msg.lastRun = now.getTime();
        } catch (error) {
          console.error('Error sending scheduled message:', error);
        }
      }
    }
  }, 60000);
}
