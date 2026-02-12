import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getAllPanels } from './database.js';

export async function restorePanels(client) {
  const panels = getAllPanels();
  let restored = 0;
  let failed = 0;

  for (const panel of panels) {
    try {
      const guild = client.guilds.cache.get(panel.guildId);
      if (!guild) {
        console.log(`[PANEL RESTORE] Guild ${panel.guildId} not found, skipping.`);
        failed++;
        continue;
      }

      const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
      if (!channel) {
        console.log(`[PANEL RESTORE] Channel ${panel.channelId} not found, skipping.`);
        failed++;
        continue;
      }

      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) {
        restored++;
        console.log(`[PANEL RESTORE] Panel in #${channel.name} (${panel.guildId}) still exists, interactions ready.`);
      } else {
        console.log(`[PANEL RESTORE] Panel message ${panel.messageId} in #${channel.name} was deleted.`);
        failed++;
      }
    } catch (err) {
      console.error(`[PANEL RESTORE] Error restoring panel:`, err.message);
      failed++;
    }
  }

  console.log(`[PANEL RESTORE] Complete: ${restored} active, ${failed} missing/failed out of ${panels.length} total.`);
}
