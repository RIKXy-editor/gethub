import { loadData, addStickyMessage } from '../utils/storage.js';

export const name = 'messageCreate';

const TARGET_USER_ID = '1085920853604175962';
const FUNNY_REPLIES = [
  "He's probably busy editing something again 😂",
  "He's definitely lost in the editing timeline 🎬",
  "Probably rendering a 4K video as we speak 😂",
  "He's vibing with those Adobe subscriptions 😂",
  "Cutting clips as we speak! ✂️😂",
  "He's out there creating masterpieces 🎥😂"
];

export async function execute(message) {
  // Ignore bot messages to prevent infinite loops
  if (message.author.bot) return;
  if (!message.guild) return;

  // Check if target user is mentioned
  if (message.mentions.has(TARGET_USER_ID)) {
    try {
      const randomReply = FUNNY_REPLIES[Math.floor(Math.random() * FUNNY_REPLIES.length)];
      await message.reply(randomReply);
    } catch (error) {
      console.error('Error replying to mention:', error);
    }
  }

  const sticky = loadData('sticky-messages', {});
  const guildSticky = sticky[message.guild.id];

  if (guildSticky && guildSticky[message.channelId]) {
    const stickyData = guildSticky[message.channelId];
    
    try {
      // Fetch and delete the old sticky message
      const oldMessage = await message.channel.messages.fetch(stickyData.messageId);
      await oldMessage.delete();
    } catch (error) {
      console.log('Sticky message already deleted or inaccessible');
    }

    // Repost sticky message at the bottom
    try {
      const newMessage = await message.channel.send(stickyData.content);
      addStickyMessage(message.guild.id, message.channelId, newMessage.id, stickyData.content);
    } catch (error) {
      console.error('Error reposting sticky message:', error);
    }
  }
}
