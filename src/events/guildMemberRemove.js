import { handleMemberRemove } from './giveawayManager.js';

export const name = 'guildMemberRemove';

export async function execute(member) {
  await handleMemberRemove(member);
}
