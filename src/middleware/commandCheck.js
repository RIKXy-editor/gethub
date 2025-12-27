import { checkCommandExecutionAllowed, isMaintenanceMode } from '../utils/botExecutor.js';

export async function handleCommandExecution(interaction, commandName) {
  const check = checkCommandExecutionAllowed(commandName);
  
  if (!check.allowed) {
    return await interaction.reply({
      content: `⛔ ${check.reason}`,
      ephemeral: true
    });
  }
  
  return { allowed: true };
}
