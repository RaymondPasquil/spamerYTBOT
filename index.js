const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

// Load API keys from .env
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Authenticate YouTube API
const credentials = JSON.parse(fs.readFileSync('client_secret_account1.json', 'utf8'));
const youtubeAuth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/youtube.force-ssl']
);
const youtube = google.youtube({ version: 'v3', auth: youtubeAuth });

// Extract Video ID from YouTube URL
function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Fetch YouTube comments
async function getComments(videoId) {
  try {
    const res = await youtube.commentThreads.list({
      part: 'snippet',
      videoId: videoId,
      maxResults: 50,
    });

    return res.data.items.map(item => item.snippet.topLevelComment.snippet.textOriginal);
  } catch (error) {
    console.error('Error fetching comments:', error.message);
    return [];
  }
}

// Generate OpenAI reply
async function generateReply(comment) {
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: `Reply to this YouTube comment: "${comment}"` }],
    });

    return openaiResponse.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating OpenAI response:', error.message);
    return 'Thanks for your comment!';
  }
}

// Post comment on YouTube
async function postComment(videoId, text) {
  try {
    await youtube.commentThreads.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          videoId: videoId,
          topLevelComment: {
            snippet: { textOriginal: text },
          },
        },
      },
    });

    console.log('Comment posted successfully:', text);
  } catch (error) {
    console.error('Error posting comment:', error.message);
  }
}

// Handle Telegram messages with YouTube links
bot.onText(/(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/, async (msg, match) => {
  const chatId = msg.chat.id;
  const videoUrl = match[0];
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    bot.sendMessage(chatId, 'Invalid YouTube link. Please try again.');
    return;
  }

  bot.sendMessage(chatId, 'Fetching comments...');

  const comments = await getComments(videoId);

  if (comments.length > 0) {
    const randomComment = comments[Math.floor(Math.random() * comments.length)];
    const reply = await generateReply(randomComment);
    
    await postComment(videoId, reply);

    bot.sendMessage(chatId, 'Comment posted successfully!');
  } else {
    bot.sendMessage(chatId, 'No comments found on that video.');
  }
});

console.log('Bot is running...');
