import { AttachmentBuilder } from 'discord.js';

export async function generateTranscript(channel, ticketData) {
  const messages = [];
  let lastMessageId = null;
  
  while (true) {
    const options = { limit: 100 };
    if (lastMessageId) options.before = lastMessageId;
    
    const fetchedMessages = await channel.messages.fetch(options);
    if (fetchedMessages.size === 0) break;
    
    messages.push(...fetchedMessages.values());
    lastMessageId = fetchedMessages.last().id;
    
    if (fetchedMessages.size < 100) break;
  }
  
  messages.reverse();
  
  const html = buildHtmlTranscript(messages, ticketData, channel);
  const buffer = Buffer.from(html, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
  
  return attachment;
}

function buildHtmlTranscript(messages, ticketData, channel) {
  const formatTimestamp = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  };

  let messagesHtml = '';
  for (const msg of messages) {
    const attachmentsHtml = msg.attachments.size > 0 
      ? `<div class="attachments">${[...msg.attachments.values()].map(a => 
          a.contentType?.startsWith('image/') 
            ? `<img src="${a.url}" alt="attachment" style="max-width: 300px; border-radius: 4px;">` 
            : `<a href="${a.url}" target="_blank">${a.name}</a>`
        ).join('')}</div>` 
      : '';

    const embedsHtml = msg.embeds.length > 0
      ? `<div class="embeds">${msg.embeds.map(e => `
          <div class="embed" style="border-left: 4px solid ${e.hexColor || '#5865f2'}; background: #2f3136; padding: 10px; margin: 5px 0; border-radius: 4px;">
            ${e.title ? `<div class="embed-title" style="font-weight: bold; color: #fff;">${escapeHtml(e.title)}</div>` : ''}
            ${e.description ? `<div class="embed-desc" style="color: #dcddde;">${escapeHtml(e.description)}</div>` : ''}
          </div>
        `).join('')}</div>`
      : '';

    messagesHtml += `
      <div class="message">
        <img class="avatar" src="${msg.author.displayAvatarURL({ size: 64 })}" alt="avatar">
        <div class="content">
          <div class="header">
            <span class="author" style="color: ${msg.member?.displayHexColor || '#fff'};">${escapeHtml(msg.author.displayName || msg.author.username)}</span>
            <span class="timestamp">${formatTimestamp(msg.createdAt)}</span>
          </div>
          <div class="text">${escapeHtml(msg.content)}</div>
          ${attachmentsHtml}
          ${embedsHtml}
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Transcript - ${channel.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: #36393f; 
      color: #dcddde; 
      padding: 20px; 
    }
    .header-info {
      background: #2f3136;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header-info h1 { color: #fff; margin-bottom: 10px; }
    .header-info p { color: #72767d; margin: 5px 0; }
    .messages { background: #36393f; }
    .message {
      display: flex;
      padding: 10px 20px;
      transition: background 0.1s;
    }
    .message:hover { background: #32353b; }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      margin-right: 15px;
      flex-shrink: 0;
    }
    .content { flex: 1; min-width: 0; }
    .header { margin-bottom: 4px; }
    .author { font-weight: 600; margin-right: 8px; }
    .timestamp { color: #72767d; font-size: 12px; }
    .text { word-wrap: break-word; line-height: 1.4; }
    .attachments { margin-top: 8px; }
    .attachments img { display: block; margin-top: 5px; }
    .attachments a { color: #00b0f4; text-decoration: none; }
    .embeds { margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header-info">
    <h1>Ticket Transcript</h1>
    <p><strong>Channel:</strong> #${channel.name}</p>
    <p><strong>Category:</strong> ${ticketData?.category || 'Unknown'}</p>
    <p><strong>Opened by:</strong> ${ticketData?.openerTag || 'Unknown'}</p>
    <p><strong>Created:</strong> ${ticketData?.createdAt ? formatTimestamp(ticketData.createdAt) : 'Unknown'}</p>
    <p><strong>Messages:</strong> ${messages.length}</p>
    <p><strong>Transcript generated:</strong> ${formatTimestamp(new Date())}</p>
  </div>
  <div class="messages">
    ${messagesHtml}
  </div>
</body>
</html>`;
}
