const { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const cors = require('cors');

// ============================================
// DISCORD BOT
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store licenses in memory (use database in production)
let licenses = [];
let activePanels = new Map();

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

// Slash commands
const commands = [
    { name: 'setpanel', description: 'Create the control panel in this channel' },
    { name: 'whitelist', description: 'Whitelist a user', options: [{ name: 'user', type: 6, required: true }, { name: 'days', type: 4, required: false }] },
    { name: 'unwhitelist', description: 'Remove user from whitelist', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'blacklist', description: 'Blacklist a user', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
    { name: 'resethwid', description: 'Reset a user\'s HWID', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'adddays', description: 'Add days to a user\'s key', options: [{ name: 'user', type: 6, required: true }, { name: 'days', type: 4, required: true }] },
    { name: 'keys', description: 'List all active keys' },
    { name: 'gen', description: 'Generate a new license key', options: [{ name: 'days', type: 4, required: false }] },
    { name: 'stats', description: 'View bot statistics' }
];

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Registered ${commands.length} slash commands`);
});

// ============================================
// SLASH COMMANDS (Manager)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName, options, member, guild, channel } = interaction;
    
    // Check admin
    const isAdmin = member.permissions.has('Administrator');
    if (!isAdmin && commandName !== 'redeem' && commandName !== 'script' && commandName !== 'status') {
        return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
    }
    
    // ========== SETPANEL ==========
    if (commandName === 'setpanel') {
        const embed = new EmbedBuilder()
            .setTitle('⚡ Control Panel')
            .setDescription('This control panel is for the project: **GammaHub**\nIf you\'re a buyer, click the buttons below to redeem your key, get the script or reset your HWID')
            .setColor(0x5865F2)
            .setFooter({ text: 'Made with ❤️ - Support: discord.gg/support' });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('redeem').setLabel('🎫 Redeem Key').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('script').setLabel('📜 Get Script').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('resethwid').setLabel('🔄 Reset HWID').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('status').setLabel('📊 Status').setStyle(ButtonStyle.Secondary)
            );
        
        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Panel created!', ephemeral: true });
    }
    
    // ========== WHITELIST ==========
    if (commandName === 'whitelist') {
        const user = options.getUser('user');
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        let license = licenses.find(l => l.discordId === user.id);
        if (license) {
            license.expiresAt = expiresAt;
            await interaction.reply({ content: `✅ Updated ${user.tag}'s license! Expires in ${days} days.`, ephemeral: true });
        } else {
            const key = generateKey();
            licenses.push({ key, discordId: user.id, discordName: user.tag, expiresAt, used: false, hwid: null });
            await interaction.reply({ content: `✅ Whitelisted ${user.tag}!\nKey: \`${key}\``, ephemeral: true });
            try { await user.send(`🎉 You've been whitelisted!\nKey: \`${key}\``); } catch(e) {}
        }
    }
    
    // ========== UNWHITELIST ==========
    if (commandName === 'unwhitelist') {
        const user = options.getUser('user');
        licenses = licenses.filter(l => l.discordId !== user.id);
        await interaction.reply({ content: `✅ Removed ${user.tag} from whitelist.`, ephemeral: true });
    }
    
    // ========== BLACKLIST ==========
    if (commandName === 'blacklist') {
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const license = licenses.find(l => l.discordId === user.id);
        if (license) license.blacklisted = true;
        await interaction.reply({ content: `✅ Blacklisted ${user.tag}\nReason: ${reason}`, ephemeral: true });
    }
    
    // ========== RESETHWID ==========
    if (commandName === 'resethwid') {
        const user = options.getUser('user');
        const license = licenses.find(l => l.discordId === user.id);
        if (license) license.hwid = null;
        await interaction.reply({ content: `✅ Reset HWID for ${user.tag}`, ephemeral: true });
    }
    
    // ========== ADDDAYS ==========
    if (commandName === 'adddays') {
        const user = options.getUser('user');
        const days = options.getInteger('days');
        const license = licenses.find(l => l.discordId === user.id);
        if (license && license.expiresAt) {
            license.expiresAt.setDate(license.expiresAt.getDate() + days);
            await interaction.reply({ content: `✅ Added ${days} days to ${user.tag}'s license!`, ephemeral: true });
        }
    }
    
    // ========== KEYS ==========
    if (commandName === 'keys') {
        const activeKeys = licenses.filter(l => !l.blacklisted);
        const embed = new EmbedBuilder()
            .setTitle('📋 Active Keys')
            .setDescription(`Total: ${activeKeys.length} keys`)
            .setColor(0x5865F2);
        activeKeys.slice(0, 10).forEach(k => {
            embed.addFields({ name: k.key, value: `User: ${k.discordName || 'Unused'}\nExpires: ${k.expiresAt?.toDateString() || 'Never'}`, inline: false });
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // ========== GEN ==========
    if (commandName === 'gen') {
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        const key = generateKey();
        licenses.push({ key, expiresAt, used: false, hwid: null });
        await interaction.reply({ content: `✅ New key generated!\n\`${key}\`\nExpires in ${days} days`, ephemeral: true });
    }
    
    // ========== STATS ==========
    if (commandName === 'stats') {
        const activeKeys = licenses.filter(l => !l.blacklisted && (!l.expiresAt || l.expiresAt > new Date()));
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistics')
            .addFields(
                { name: 'Total Keys', value: `${licenses.length}`, inline: true },
                { name: 'Active Keys', value: `${activeKeys.length}`, inline: true },
                { name: 'Whitelisted Users', value: `${licenses.filter(l => l.discordId).length}`, inline: true }
            )
            .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================
// BUTTON HANDLERS (Panel)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, member } = interaction;
    let license = licenses.find(l => l.discordId === user.id);
    
    // Redeem Key button
    if (customId === 'redeem') {
        const modal = new ModalBuilder()
            .setCustomId('redeemModal')
            .setTitle('🎫 Redeem License Key');
        
        const keyInput = new TextInputBuilder()
            .setCustomId('key')
            .setLabel('Enter your license key')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('XXXX-XXXX-XXXX-XXXX')
            .setRequired(true);
        
        modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
        await interaction.showModal(modal);
    }
    
    // Get Script button
    if (customId === 'script') {
        if (!license || license.blacklisted) {
            return interaction.reply({ content: '❌ No active license found! Redeem a key first.', ephemeral: true });
        }
        
        const script = `-- GammaHub Loader
-- Licensed to: ${user.tag}
-- Expires: ${license.expiresAt?.toDateString() || 'Lifetime'}

local key = "${license.key}"
local hwid = game:GetService("Players").LocalPlayer.UserId

local function verify()
    local response = game:GetService("HttpService"):JSONDecode(
        game:HttpGet("https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-api.railway.app'}/verify?key=" .. key .. "&hwid=" .. hwid)
    )
    return response.valid, response.message
end

local valid, msg = verify()
if valid then
    print("✅ " .. msg)
    -- Load your actual script here
    loadstring(game:HttpGet("YOUR_SCRIPT_URL"))()
else
    game:GetService("StarterGui"):SetCore("SendNotification", {
        Title = "License Error",
        Text = msg,
        Duration = 5
    })
end`;
        
        try {
            await user.send({ content: '📜 **Your Loader Script**', files: [{ attachment: Buffer.from(script), name: 'loader.lua' }] });
            await interaction.reply({ content: '✅ Script sent to your DMs!', ephemeral: true });
        } catch(e) {
            await interaction.reply({ content: '❌ Enable DMs from server members!', ephemeral: true });
        }
    }
    
    // Reset HWID button
    if (customId === 'resethwid') {
        if (!license) return interaction.reply({ content: '❌ No license found!', ephemeral: true });
        license.hwid = null;
        await interaction.reply({ content: '🔄 Your HWID has been reset!', ephemeral: true });
    }
    
    // Status button
    if (customId === 'status') {
        if (!license) return interaction.reply({ content: '❌ No license found.', ephemeral: true });
        
        const isExpired = license.expiresAt && license.expiresAt < new Date();
        const embed = new EmbedBuilder()
            .setTitle('📊 License Status')
            .setColor(isExpired ? 0xED4245 : 0x57F287)
            .addFields(
                { name: 'Status', value: isExpired ? '❌ Expired' : '✅ Active', inline: true },
                { name: 'Expires', value: license.expiresAt?.toDateString() || 'Lifetime', inline: true },
                { name: 'HWID', value: license.hwid ? '🔒 Locked' : '⚠️ Not set', inline: true }
            );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// Modal handler for redeem
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'redeemModal') return;
    
    const key = interaction.fields.getTextInputValue('key').toUpperCase();
    const user = interaction.user;
    
    const license = licenses.find(l => l.key === key);
    
    if (!license) {
        return interaction.reply({ content: '❌ Invalid key!', ephemeral: true });
    }
    
    if (license.discordId && license.discordId !== user.id) {
        return interaction.reply({ content: '❌ Key already used by another Discord account!', ephemeral: true });
    }
    
    if (license.expiresAt && license.expiresAt < new Date()) {
        return interaction.reply({ content: '❌ Key has expired!', ephemeral: true });
    }
    
    license.discordId = user.id;
    license.discordName = user.tag;
    
    await interaction.reply({ content: `✅ **Key Redeemed!**\nYour license is now linked to ${user.tag}\nExpires: ${license.expiresAt?.toDateString() || 'Lifetime'}`, ephemeral: true });
});

// ============================================
// EXPRESS API
// ============================================
const app = express();
app.use(cors());
app.use(express.json());

app.get('/verify', (req, res) => {
    const { key, hwid } = req.query;
    const license = licenses.find(l => l.key === key);
    
    if (!license) return res.json({ valid: false, message: 'Invalid key' });
    if (license.blacklisted) return res.json({ valid: false, message: 'Blacklisted' });
    if (license.expiresAt && license.expiresAt < new Date()) return res.json({ valid: false, message: 'Expired' });
    if (license.hwid && license.hwid !== hwid) return res.json({ valid: false, message: 'HWID mismatch' });
    
    if (!license.hwid && hwid) license.hwid = hwid;
    
    res.json({ valid: true, message: 'License valid', expires: license.expiresAt });
});

app.get('/keys', (req, res) => res.json(licenses));
app.post('/gen', (req, res) => {
    const key = generateKey();
    licenses.push({ key, used: false, hwid: null });
    res.json({ success: true, key });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API on port ${PORT}`));

client.login(process.env.BOT_TOKEN);
