const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

// Load API keys from .env
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Authenticate YouTube
const youtubeAuth = new google.auth.OAuth2();
youtubeAuth.setCredentials(require('./credentials/client_secret_account1.json'));
const youtube = google.youtube({ version: 'v3', auth: youtubeAuth });

// Fetch YouTube comments
async function getComments(videoId) {
  const res = await youtube.commentThreads.list({
    part: 'snippet',
    videoId: video_id,
    maxResults: 50,
  });
  return res.data.items.map(item => item.snippet.topLevelComment.snippet.textOriginal);
}

// Generate OpenAI reply
async function generateReply(comment) {
  const openaiResponse = await new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }).chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: `Reply to YouTube comment: ${comment}` }],
  });

  return openaiResponse.choices[0].message.content;
}

// Post comment on YouTube
async function postComment(videoId, text) {
  await youtube.commentThreads.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: { textOriginal: text },
        },
      },
    },
  });
}

// Telegram message handling
bot.onText(/(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/, async (msg, match) => {
  const chatId = msg.chat.id;
  const videoUrl = match[0];
  const videoId = videoIdFromUrl(video_url);

  const comments = await youtube.commentThreads.list({
    part: 'snippet',
    videoId: videoId,
    maxResults: 10,
  });

  if (comments.data.items.length > 0) {
    const randomComment = comments.items[Math.floor(Math.random() * comments.items.length)];
    const reply = await generateReply(randomComment.snippet.topLevelComment.snippet.textDisplay);
    await postComment(youtube, video_id, reply);
    bot.sendMessage(chatId, 'Comment posted successfully!');
  } else {
    bot.sendMessage(chatId, 'No comments found on that video.');
  }
});

console.log('Bot is running...');
