import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getPendingReminders, markReminderSent, expireSubscription, getActiveSubscriptions } from './database.js';

const RESUBSCRIBE_URL = 'https://discord.com/channels/1153309880644554804/1415963231108861952';
const CHECK_INTERVAL = 60 * 60 * 1000;

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function startReminderScheduler(client) {
  console.log('[REMINDERS] Scheduler started, checking every hour.');

  async function checkReminders() {
    try {
      const today = getTodayStr();
      const reminders = getPendingReminders(today);

      if (reminders.length === 0) return;

      console.log(`[REMINDERS] Found ${reminders.length} pending reminders for ${today}`);

      for (const reminder of reminders) {
        try {
          const user = await client.users.fetch(reminder.user_id).catch(() => null);
          if (!user) {
            markReminderSent(reminder.id);
            continue;
          }

          const endDate = new Date(reminder.end_date * 1000);
          const endDateStr = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

          const todayDate = new Date(today);
          const daysLeft = Math.ceil((endDate - todayDate) / (1000 * 60 * 60 * 24));
          const isFinalDay = daysLeft <= 1;

          let description = `Hey there, your Adobe subscription (**${reminder.plan_name}**) is going to end soon.\n\n`;
          description += `**Expiry Date:** ${endDateStr}\n`;
          description += `**Days Remaining:** ${daysLeft <= 0 ? 'Today!' : daysLeft + ' day(s)'}\n`;

          if (isFinalDay) {
            description += `\n🎉 **Get 10% OFF on any subscription from 3 months to 1 year if you renew now!**`;
          }

          const embed = new EmbedBuilder()
            .setTitle('⏰ Subscription Ending Soon')
            .setDescription(description)
            .setColor(isFinalDay ? '#FF0000' : '#FFA500')
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Resubscribe Now')
              .setStyle(ButtonStyle.Link)
              .setURL(RESUBSCRIBE_URL)
          );

          await user.send({ embeds: [embed], components: [row] }).catch(err => {
            console.log(`[REMINDERS] Could not DM user ${reminder.user_id}: ${err.message}`);
          });

          markReminderSent(reminder.id);
          console.log(`[REMINDERS] Sent reminder to ${reminder.user_id} for sub #${reminder.subscription_id} (${daysLeft} days left)`);
        } catch (err) {
          console.error(`[REMINDERS] Error sending reminder ${reminder.id}:`, err.message);
        }
      }

      const activeSubs = getActiveSubscriptions();
      const nowSec = Math.floor(Date.now() / 1000);
      for (const sub of activeSubs) {
        if (sub.end_date <= nowSec) {
          expireSubscription(sub.id);
          console.log(`[REMINDERS] Expired subscription #${sub.id} for user ${sub.user_id}`);
        }
      }
    } catch (err) {
      console.error('[REMINDERS] Scheduler error:', err);
    }
  }

  checkReminders();
  setInterval(checkReminders, CHECK_INTERVAL);
}
