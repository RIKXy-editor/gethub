import { loadData, saveData } from './storage.js';

// ====== CONFIGURATION ======
// Customize these values as needed
const GIVEAWAY_TITLE = "Editor's Club Giveaways";
const DEFAULT_MULTIPLIER_ROLES = {
  // 'role_id': 2,  // Example: Server Booster = 2x entries
  // 'role_id': 3,  // Example: Supporter = 3x entries
};
// ====== END CONFIGURATION ======

export function generateTickets(participants, multiplierRoles = {}) {
  // Create a ticket array where each entry is weighted by multipliers
  const tickets = [];
  
  for (const participant of participants) {
    let multiplier = 1;
    
    // Check if user has any multiplier roles
    if (participant.userRoles && multiplierRoles) {
      for (const roleId of participant.userRoles) {
        if (multiplierRoles[roleId]) {
          multiplier = Math.max(multiplier, multiplierRoles[roleId]);
        }
      }
    }
    
    // Add tickets for this user
    for (let i = 0; i < multiplier; i++) {
      tickets.push(participant.userId);
    }
  }
  
  return tickets;
}

export function selectWinners(participants, winnerCount, multiplierRoles = {}) {
  if (participants.length === 0) return [];
  
  const tickets = generateTickets(participants, multiplierRoles);
  if (tickets.length === 0) return [];
  
  const winners = new Set();
  const maxWinners = Math.min(winnerCount, participants.length);
  
  while (winners.size < maxWinners) {
    const randomIndex = Math.floor(Math.random() * tickets.length);
    winners.add(tickets[randomIndex]);
  }
  
  return Array.from(winners);
}

export function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([mhd])$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  let ms = 0;
  switch (unit) {
    case 'm':
      ms = value * 60 * 1000;
      break;
    case 'h':
      ms = value * 60 * 60 * 1000;
      break;
    case 'd':
      ms = value * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }
  
  return ms;
}

export function getGiveawayTitle() {
  return GIVEAWAY_TITLE;
}

export function addGiveaway(guildId, giveawayData) {
  const giveaways = loadData('giveaways', {});
  if (!giveaways[guildId]) giveaways[guildId] = {};
  
  const id = giveawayData.messageId;
  giveaways[guildId][id] = giveawayData;
  saveData('giveaways', giveaways);
}

export function getGiveaway(guildId, messageId) {
  const giveaways = loadData('giveaways', {});
  return giveaways[guildId]?.[messageId] || null;
}

export function updateGiveaway(guildId, messageId, updates) {
  const giveaways = loadData('giveaways', {});
  if (!giveaways[guildId] || !giveaways[guildId][messageId]) return;
  
  giveaways[guildId][messageId] = { ...giveaways[guildId][messageId], ...updates };
  saveData('giveaways', giveaways);
}

export function removeGiveaway(guildId, messageId) {
  const giveaways = loadData('giveaways', {});
  if (giveaways[guildId]) delete giveaways[guildId][messageId];
  saveData('giveaways', giveaways);
}

export function getAllGiveaways(guildId) {
  const giveaways = loadData('giveaways', {});
  return giveaways[guildId] || {};
}

export function addEntry(guildId, messageId, userId, userRoles = []) {
  const entries = loadData('giveaway-entries', {});
  if (!entries[guildId]) entries[guildId] = {};
  if (!entries[guildId][messageId]) entries[guildId][messageId] = [];
  
  // Prevent duplicates
  if (!entries[guildId][messageId].find(e => e.userId === userId)) {
    entries[guildId][messageId].push({ userId, userRoles });
  }
  
  saveData('giveaway-entries', entries);
}

export function removeEntry(guildId, messageId, userId) {
  const entries = loadData('giveaway-entries', {});
  if (entries[guildId]?.[messageId]) {
    entries[guildId][messageId] = entries[guildId][messageId].filter(e => e.userId !== userId);
  }
  saveData('giveaway-entries', entries);
}

export function getEntries(guildId, messageId) {
  const entries = loadData('giveaway-entries', {});
  return entries[guildId]?.[messageId] || [];
}

export function hasEntry(guildId, messageId, userId) {
  const entries = getEntries(guildId, messageId);
  return entries.some(e => e.userId === userId);
}

export function removeUserFromAllEntries(guildId, userId) {
  const entries = loadData('giveaway-entries', {});
  if (entries[guildId]) {
    for (const messageId in entries[guildId]) {
      entries[guildId][messageId] = entries[guildId][messageId].filter(e => e.userId !== userId);
    }
  }
  saveData('giveaway-entries', entries);
}

export function validateEntries(guildId, messageId, guild, giveaway) {
  const entries = getEntries(guildId, messageId);
  const validEntries = [];
  
  for (const entry of entries) {
    try {
      const member = guild.members.cache.get(entry.userId);
      if (!member) {
        // User left the server
        removeEntry(guildId, messageId, entry.userId);
        continue;
      }
      
      // Check required role
      if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
        removeEntry(guildId, messageId, entry.userId);
        continue;
      }
      
      validEntries.push(entry);
    } catch (error) {
      console.error('Error validating entry:', error);
    }
  }
  
  return validEntries;
}

export function cleanupGiveawayEntries(guildId, messageId) {
  const entries = loadData('giveaway-entries', {});
  if (entries[guildId]) delete entries[guildId][messageId];
  saveData('giveaway-entries', entries);
}
