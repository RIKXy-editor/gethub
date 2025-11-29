import fs from 'fs';
import path from 'path';

const dataDir = './data';

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadData(filename, defaultValue = {}) {
  ensureDir();
  const filePath = path.join(dataDir, `${filename}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
  }
  return defaultValue;
}

export function saveData(filename, data) {
  ensureDir();
  const filePath = path.join(dataDir, `${filename}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
  }
}

export function getGuildConfig(guildId) {
  const configs = loadData('configs', {});
  return configs[guildId] || {};
}

export function setGuildConfig(guildId, config) {
  const configs = loadData('configs', {});
  configs[guildId] = { ...configs[guildId], ...config };
  saveData('configs', configs);
}

export function addScheduledMessage(messageData) {
  const messages = loadData('scheduled-messages', []);
  messages.push({ ...messageData, id: Date.now() });
  saveData('scheduled-messages', messages);
  return messageData.id;
}

export function getScheduledMessages() {
  return loadData('scheduled-messages', []);
}

export function removeScheduledMessage(id) {
  const messages = loadData('scheduled-messages', []);
  const filtered = messages.filter(m => m.id !== id);
  saveData('scheduled-messages', filtered);
}

export function addStickyMessage(guildId, channelId, messageId, content) {
  const sticky = loadData('sticky-messages', {});
  if (!sticky[guildId]) sticky[guildId] = {};
  sticky[guildId][channelId] = { messageId, content };
  saveData('sticky-messages', sticky);
}

export function getStickyMessage(guildId, channelId) {
  const sticky = loadData('sticky-messages', {});
  return sticky[guildId]?.[channelId] || null;
}

export function removeStickyMessage(guildId, channelId) {
  const sticky = loadData('sticky-messages', {});
  if (sticky[guildId]) delete sticky[guildId][channelId];
  saveData('sticky-messages', sticky);
}
