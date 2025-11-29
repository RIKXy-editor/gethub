import { loadData, addStickyMessage } from '../utils/storage.js';

export const name = 'messageCreate';

export async function execute(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const sticky = loadData('sticky-messages', {});
  const guildSticky = sticky[message.guild.id];

  if (guildSticky && guildSticky[message.channelId]) {
    const stickyData = guildSticky[message.channelId];
    
    try {
      const oldMessage = await message.channel.messages.fetch(stickyData.messageId);
      await oldMessage.delete();
    } catch (error) {
      console.log('Sticky message already deleted or inaccessible');
    }

    const newMessage = await message.channel.send(stickyData.content);
    addStickyMessage(message.guild.id, message.channelId, newMessage.id, stickyData.content);
  }
}
