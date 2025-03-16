const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID  !CLIENT_SECRET  !REDIRECT_URI) {
    console.error("❌ Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI in .env");
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
});

console.log('Authorize this app by visiting this url:', authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Enter the code from that page here: ', async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync('token.json', JSON.stringify(tokens));
        console.log('Token stored to token.json');
    } catch (error) {
        console.error('Error retrieving access token', error);
    }
    rl.close();
});
