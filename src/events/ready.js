import { ActivityType } from 'discord.js';
import { getScheduledMessages } from '../utils/storage.js';

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
                       msg.frequency === 'daily' ? timeSinceLastRun > 60000 :
                       msg.frequency === 'weekly' ? timeSinceLastRun > 60000 :
                       msg.frequency === 'monthly' ? timeSinceLastRun > 60000 : false;

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
