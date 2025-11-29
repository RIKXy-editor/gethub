import { loadData, addStickyMessage } from '../utils/storage.js';

export const name = 'messageCreate';

export async function execute(message) {
  // Ignore bot messages to prevent infinite loops
  if (message.author.bot) return;
  if (!message.guild) return;

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
