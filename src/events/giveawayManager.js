import { EmbedBuilder } from 'discord.js';
import { getAllGiveaways, updateGiveaway, getEntries, removeUserFromAllEntries } from '../utils/storage.js';
import { selectWinners } from '../utils/giveawayManager.js';

let giveawayCheckInterval;

export function startGiveawayAutoEnd(client) {
  // Check every 10 seconds
  giveawayCheckInterval = setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const allGiveaways = getAllGiveaways(guild.id);
      
      for (const [messageId, giveaway] of Object.entries(allGiveaways)) {
        if (giveaway.ended) continue;
        
        if (Date.now() >= giveaway.endTime) {
          await endGiveaway(client, guild, messageId, giveaway);
        }
      }
    }
  }, 10000);
}

export function stopGiveawayAutoEnd() {
  if (giveawayCheckInterval) {
    clearInterval(giveawayCheckInterval);
  }
}

async function endGiveaway(client, guild, messageId, giveaway) {
  try {
    const channel = await guild.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(messageId);
    
    // Get valid entries
    let entries = getEntries(guild.id, messageId);
    const validEntries = [];
    
    for (const entry of entries) {
      try {
        const member = await guild.members.fetch(entry.userId);
        
        if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
          continue;
        }
        
        validEntries.push(entry);
      } catch (error) {
        continue;
      }
    }
    
    // Select winners
    const winnerIds = selectWinners(validEntries, giveaway.winnerCount, giveaway.multiplierRoles);
    
    // Update embed
    const embed = message.embeds[0];
    if (embed) {
      const newEmbed = EmbedBuilder.from(embed);
      
      let winnerText = 'No valid entries';
      if (winnerIds.length > 0) {
        winnerText = winnerIds.map(id => `<@${id}>`).join(', ');
      }
      
      const detailsField = newEmbed.data.fields.find(f => f.name === '🎯 Giveaway Details');
      if (detailsField) {
        const lines = detailsField.value.split('\n');
        lines[1] = `**Winner(s):** ${winnerText}`;
        detailsField.value = lines.join('\n');
      }
      
      newEmbed.setFooter({ text: '✅ Giveaway has ended.' });
      
      await message.edit({ embeds: [newEmbed] });
    }
    
    // Send DMs to winners
    for (const winnerId of winnerIds) {
      try {
        const winner = await client.users.fetch(winnerId);
        await winner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('🎉 You Won!')
              .setDescription(`Congratulations! You've won: **${giveaway.prize}**`)
              .setFooter({ text: 'Thank you for participating!' })
          ]
        });
      } catch (error) {
        console.error(`Could not DM winner ${winnerId}:`, error.message);
      }
    }
    
    updateGiveaway(guild.id, messageId, { ended: true });
    console.log(`Auto-ended giveaway ${messageId} with ${winnerIds.length} winners`);
  } catch (error) {
    console.error('Error auto-ending giveaway:', error);
  }
}

export async function handleMemberRemove(member) {
  removeUserFromAllEntries(member.guild.id, member.id);
  console.log(`Removed ${member.user.tag} from all giveaway entries`);
}
