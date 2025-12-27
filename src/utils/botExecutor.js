import fs from 'fs';

export function loadBotConfig() {
  try {
    const data = fs.readFileSync('data/admin-config.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading bot config:', error);
    return null;
  }
}

export function isBotEnabled() {
  const config = loadBotConfig();
  return config?.bot?.enabled ?? true;
}

export function isMaintenanceMode() {
  const config = loadBotConfig();
  return config?.bot?.maintenance_mode ?? false;
}

export function isCommandEnabled(commandName) {
  const config = loadBotConfig();
  if (!config?.commands?.[commandName]) return true;
  return config.commands[commandName].enabled ?? true;
}

export function isFeatureEnabled(featureName) {
  const config = loadBotConfig();
  if (!config?.features?.[featureName]) return true;
  return config.features[featureName].enabled ?? true;
}

export function getFeatureConfig(featureName) {
  const config = loadBotConfig();
  return config?.features?.[featureName] || null;
}

export function getCommandConfig(commandName) {
  const config = loadBotConfig();
  return config?.commands?.[commandName] || null;
}

export function checkCommandExecutionAllowed(commandName) {
  if (!isBotEnabled()) {
    return { allowed: false, reason: 'Bot is currently disabled' };
  }
  
  if (isMaintenanceMode()) {
    return { allowed: false, reason: 'Bot is in maintenance mode' };
  }
  
  if (!isCommandEnabled(commandName)) {
    return { allowed: false, reason: 'This command is disabled' };
  }
  
  return { allowed: true };
}
