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

    // Add GIF at bottom (different GIF based on action)
    const gifUrl = removedRoles.size > 0 && addedRoles.size === 0
      ? 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ2o0dncxMGxhOWZ6dDBseHlqZDBxaW1xOTBsOWtleng1aWN3c3l4biZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/G1ZPWPIszGDPh2NeG5/giphy.gif'
      : 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYXl6dHJhYTBucDlyb3pvZ29hd2hwYmczYTMxZXR4b3JvODd4ZnJmZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzCLJGxXQbwH09jzq0/giphy.gif';
    embed.setImage(gifUrl);

    // Send DM to user
    await newMember.user.send({ embeds: [embed] }).catch(() => {
      console.log(`Could not DM ${newMember.user.tag} about role change (DMs may be closed)`);
    });

    console.log(`[ROLE UPDATE] ${newMember.user.tag} - Added: ${addedRoles.size}, Removed: ${removedRoles.size}`);

  } catch (error) {
    console.error('Error in guildMemberRoleUpdate event:', error);
  }
}
