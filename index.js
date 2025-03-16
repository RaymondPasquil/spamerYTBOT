const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');

// Load API keys from .env
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const googleClientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;

if (!telegramToken || !openaiApiKey || !googleClientEmail || !googlePrivateKey) {
    console.error("❌ Missing required API keys in .env file.");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });

// Initialize Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Authenticate YouTube API
let youtube;
try {
    const youtubeAuth = new google.auth.JWT(
        googleClientEmail,
        null,
        googlePrivateKey.replace(/\\n/g, '\n'), // Fixes newline issue in keys
        ['https://www.googleapis.com/auth/youtube.force-ssl']
    );
    
    youtube = google.youtube({ version: 'v3', auth: youtubeAuth });
    console.log('✅ YouTube API authenticated successfully');
} catch (error) {
    console.error('❌ Error setting up YouTube API authentication:', error.message);
    process.exit(1); // Exit if authentication fails
}

// Extract Video ID from YouTube URL
function extractVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.*\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
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

        if (!res.data.items || res.data.items.length === 0) {
            console.log('ℹ️ No comments found.');
            return [];
        }

        return res.data.items.map(item => item.snippet.topLevelComment.snippet.textOriginal);
    } catch (error) {
        console.error('❌ Error fetching comments:', error.message);
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

        return openaiResponse.choices[0]?.message?.content?.trim() || 'Thanks for your comment!';
    } catch (error) {
        console.error('❌ Error generating OpenAI response:', error.message);
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

        console.log(`✅ Comment posted successfully: "${text}"`);
    } catch (error) {
        console.error('❌ Error posting comment:', error.message);
    }
}

// Handle Telegram messages with YouTube links
bot.onText(/(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/, async (msg, match) => {
    const chatId = msg.chat.id;
    const videoUrl = match[0];
    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
        bot.sendMessage(chatId, '❌ Invalid YouTube link. Please try again.');
        return;
    }

    bot.sendMessage(chatId, '🔍 Fetching comments...');

    const comments = await getComments(videoId);

    if (comments.length > 0) {
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        const reply = await generateReply(randomComment);

        await postComment(videoId, reply);
        bot.sendMessage(chatId, '✅ Comment posted successfully!');
    } else {
        bot.sendMessage(chatId, '⚠️ No comments found on that video.');
    }
});

console.log('🤖 Bot is running...');
