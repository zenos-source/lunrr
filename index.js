const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');

// ============ DISCORD BOT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`✅ Discord Bot online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        await message.reply('Pong!');
    }
    
    if (message.content === '!panel') {
        const embed = {
            title: 'Control Panel',
            description: 'Click buttons below',
            color: 0x5865F2
        };
        await message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.BOT_TOKEN);

// ============ API SERVER ============
const app = express();
app.use(cors());
app.use(express.json());

let licenses = [];

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        if (i < 3) key += '-';
    }
    return key;
}

app.get('/verify', (req, res) => {
    const { key, hwid } = req.query;
    const license = licenses.find(l => l.key === key);
    
    if (!license) {
        return res.json({ valid: false, message: 'Invalid key' });
    }
    if (license.used && license.hwid !== hwid) {
        return res.json({ valid: false, message: 'HWID mismatch' });
    }
    
    if (!license.used) {
        license.used = true;
        license.hwid = hwid;
    }
    
    res.json({ valid: true, message: 'License valid' });
});

app.post('/gen', (req, res) => {
    const key = generateKey();
    licenses.push({ key, used: false, hwid: null });
    res.json({ success: true, key: key });
});

app.get('/keys', (req, res) => {
    res.json(licenses);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
});
