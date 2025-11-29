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

export function getJobConfig(guildId) {
  const configs = loadData('job-config', {});
  return configs[guildId] || { channelId: null, roleId: null, buttonMessageId: null, cooldownMinutes: 5 };
}

export function setJobConfig(guildId, config) {
  const configs = loadData('job-config', {});
  configs[guildId] = { ...configs[guildId], ...config };
  saveData('job-config', configs);
}

export function addCooldown(userId) {
  const cooldowns = loadData('job-cooldowns', {});
  cooldowns[userId] = Date.now();
  saveData('job-cooldowns', cooldowns);
}

export function getCooldownExpiry(userId, cooldownMinutes = 5) {
  const cooldowns = loadData('job-cooldowns', {});
  const lastUsed = cooldowns[userId];
  if (!lastUsed) return 0;
  const expiryTime = lastUsed + (cooldownMinutes * 60 * 1000);
  const timeLeft = expiryTime - Date.now();
  return timeLeft > 0 ? Math.ceil(timeLeft / 1000) : 0;
}

export function getWelcomeText(guildId) {
  const texts = loadData('custom-texts', {});
  return texts[guildId]?.welcomeText || 'Welcome to {server}, {user}! You are member #{member_count}.';
}

export function setWelcomeText(guildId, text) {
  const texts = loadData('custom-texts', {});
  if (!texts[guildId]) texts[guildId] = {};
  texts[guildId].welcomeText = text;
  saveData('custom-texts', texts);
}

export function getJobBannerText(guildId) {
  const texts = loadData('custom-texts', {});
  return texts[guildId]?.jobBannerText || `──────────────────────────────
📢 Post Your Job Here

**Rules for posting jobs:**
- Be clear about what you want (no vague "need editor" only).
- Mention video type (YouTube, Reels, Shorts, Ads, etc.).
- Mention contract type (one-time / monthly / long-term).
- Mention budget honestly (fixed / range / negotiable).
- Add sample links (YouTube / Google Drive) so editors can see your style.
- No fake jobs, no trolling, no spam.`;
}

export function setJobBannerText(guildId, text) {
  const texts = loadData('custom-texts', {});
  if (!texts[guildId]) texts[guildId] = {};
  texts[guildId].jobBannerText = text;
  saveData('custom-texts', texts);
}
