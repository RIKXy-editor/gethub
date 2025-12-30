import { EmbedBuilder } from 'discord.js';

export const name = 'guildMemberUpdate';
export const once = false;

// Only track role changes for these specific roles
const TRACKED_ROLES = [
  '1359184018251190566',
  '1356666093833556058',
  '1334727399656652810',
  '1411979810640494623',
  '1288433067324735538',
  '1352838641990242364',
  '1436771186381029396'
];

export async function execute(oldMember, newMember) {
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  // Find added roles
  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id) && TRACKED_ROLES.includes(role.id));
  
  // Find removed roles
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id) && TRACKED_ROLES.includes(role.id));

  // If no tracked role changes, skip
  if (addedRoles.size === 0 && removedRoles.size === 0) {
    return;
  }

  try {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Role Update')
      .setColor('#cc0000')
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() });

    // Add added roles field
    if (addedRoles.size > 0) {
      const roleNames = addedRoles.map(r => `✅ ${r.name}`).join('\n');
      embed.addFields({ name: 'Roles Added', value: roleNames, inline: false });
    }
    
    // Add removed roles field
    if (removedRoles.size > 0) {
      const roleNames = removedRoles.map(r => `❌ ${r.name}`).join('\n');
      embed.addFields({ name: 'Roles Removed', value: roleNames, inline: false });
    }

    // Add GIF at bottom
    embed.setImage('https://media.tenor.com/images/xxiisoul-thanos/xxiisoul-thanos.gif');

    // Send DM to user
    await newMember.user.send({ embeds: [embed] }).catch(() => {
      console.log(`Could not DM ${newMember.user.tag} about role change (DMs may be closed)`);
    });

    console.log(`[ROLE UPDATE] ${newMember.user.tag} - Added: ${addedRoles.size}, Removed: ${removedRoles.size}`);

  } catch (error) {
    console.error('Error in guildMemberRoleUpdate event:', error);
  }
}
