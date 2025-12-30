export const name = 'guildMemberUpdate';
export const once = false;

export async function execute(oldMember, newMember) {
  // Check if roles actually changed
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  // Find added roles
  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
  
  // Find removed roles
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

  // If no role changes, skip
  if (addedRoles.size === 0 && removedRoles.size === 0) {
    return;
  }

  try {
    // Build message
    let message = '';
    
    if (addedRoles.size > 0) {
      const roleNames = addedRoles.map(r => `\`${r.name}\``).join(', ');
      message += `✅ **Role Added**\nYou received: ${roleNames}\n`;
    }
    
    if (removedRoles.size > 0) {
      const roleNames = removedRoles.map(r => `\`${r.name}\``).join(', ');
      message += `❌ **Role Removed**\nYou lost: ${roleNames}\n`;
    }

    message += `\nServer: **${newMember.guild.name}**`;

    // Send DM to user
    await newMember.user.send({ content: message }).catch(() => {
      console.log(`Could not DM ${newMember.user.tag} about role change (DMs may be closed)`);
    });

    console.log(`[ROLE UPDATE] ${newMember.user.tag} - Added: ${addedRoles.size}, Removed: ${removedRoles.size}`);

  } catch (error) {
    console.error('Error in guildMemberRoleUpdate event:', error);
  }
}
