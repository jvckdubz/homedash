const fetch = require('node-fetch');

// Send message to Telegram
async function sendTelegramMessage(botToken, chatId, text, topicId = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  
  // Add message_thread_id if topic is specified
  if (topicId && topicId.toString().trim()) {
    body.message_thread_id = parseInt(topicId);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error');
  }
  return data;
}

module.exports = {
  sendTelegramMessage
};
