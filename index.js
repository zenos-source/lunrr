const { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store data in memory (use database in production)
let licenses = [];
let panelNames = new Map();

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
    { name: 'setpanel', description: 'Create control panel', options: [{ name: 'name', type: 3, required: true, description: 'Panel name (e.g., FLASH TP)' }] },
    { name: 'whitelist', description: 'Whitelist a user', options: [{ name: 'user', type: 6, required: true }, { name: 'days', type: 4, required: false }] },
    { name: 'unwhitelist', description: 'Remove user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'blacklist', description: 'Blacklist user', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
    { name: 'keys', description: 'List all keys' },
    { name: 'gen', description: 'Generate key', options: [{ name: 'days', type: 4, required: false }] },
    { name: 'stats', description: 'Bot statistics' }
];

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Registered ${commands.length} commands`);
});

// ============================================
// SETPANEL COMMAND
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'setpanel') {
        const panelName = interaction.options.getString('name');
        panelNames.set(interaction.guild.id, panelName);
        
        const embed = new EmbedBuilder()
            .setTitle(`⚡ ${panelName} Control Panel`)
            .setDescription(`This control panel is for the project: **${panelName}**\nIf you're a buyer, click the buttons below to redeem your key, get the script or reset your HWID`)
            .setColor(0x5865F2);
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('redeem').setLabel('🎫 Redeem Key').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('script').setLabel('📜 Get Script').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('resethwid').setLabel('🔄 Reset HWID').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('status').setLabel('📊 Status').setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Panel created with name: **${panelName}**`, ephemeral: true });
    }
});

// ============================================
// BUTTON HANDLERS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const panelName = panelNames.get(interaction.guild.id) || 'Lunr';
    let license = licenses.find(l => l.discordId === interaction.user.id);
    
    // Redeem Key
    if (interaction.customId === 'redeem') {
        const modal = new ModalBuilder().setCustomId('redeemModal').setTitle('🎫 Redeem Key');
        const input = new TextInputBuilder().setCustomId('key').setLabel('License Key').setStyle(TextInputStyle.Short).setPlaceholder('XXXX-XXXX-XXXX-XXXX').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }
    
    // Get Script
    if (interaction.customId === 'script') {
        if (!license || license.blacklisted) return interaction.reply({ content: '❌ No active license!', ephemeral: true });
        
        const script = `-- ${panelName} Loader
local key = "${license.key}"
local hwid = game:GetService("Players").LocalPlayer.UserId

local function verify()
    local url = "https://your-api.railway.app/verify?key=" .. key .. "&hwid=" .. hwid
    local res = game:GetService("HttpService"):JSONDecode(game:HttpGet(url))
    return res.valid, res.message
end

local valid, msg = verify()
if valid then
    print("✅ " .. msg)
    loadstring(game:HttpGet("YOUR_SCRIPT_URL"))()
else
    game:GetService("StarterGui"):SetCore("SendNotification", {Title = "${panelName}", Text = msg, Duration = 5})
end`;
        
        try {
            await interaction.user.send({ files: [{ attachment: Buffer.from(script), name: `${panelName.toLowerCase()}_loader.lua` }] });
            await interaction.reply({ content: '✅ Script sent to DMs!', ephemeral: true });
        } catch(e) {
            await interaction.reply({ content: '❌ Enable DMs!', ephemeral: true });
        }
    }
    
    // Reset HWID
    if (interaction.customId === 'resethwid') {
        if (!license) return interaction.reply({ content: '❌ No license found!', ephemeral: true });
        license.hwid = null;
        await interaction.reply({ content: '🔄 HWID reset!', ephemeral: true });
    }
    
    // Status
    if (interaction.customId === 'status') {
        if (!license) return interaction.reply({ content: '❌ No license found.', ephemeral: true });
        const embed = new EmbedBuilder().setTitle('📊 License Status').setColor(0x5865F2)
            .addFields(
                { name: 'Status', value: license.blacklisted ? '❌ Blacklisted' : '✅ Active', inline: true },
                { name: 'Expires', value: license.isLifetime ? 'Lifetime' : new Date(license.expiresAt).toDateString(), inline: true },
                { name: 'HWID', value: license.hwid ? '🔒 Locked' : '⚠️ Not set', inline: true }
            );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================
// MODAL HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'redeemModal') return;
    
    const key = interaction.fields.getTextInputValue('key').toUpperCase();
    const license = licenses.find(l => l.key === key);
    
    if (!license) return interaction.reply({ content: '❌ Invalid key!', ephemeral: true });
    if (license.discordId) return interaction.reply({ content: '❌ Key already used!', ephemeral: true });
    
    license.discordId = interaction.user.id;
    license.discordName = interaction.user.tag;
    
    await interaction.reply({ content: `✅ Key redeemed!\nExpires: ${license.isLifetime ? 'Lifetime' : new Date(license.expiresAt).toDateString()}`, ephemeral: true });
});

// ============================================
// ADMIN COMMANDS
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
    
    const { commandName, options } = interaction;
    
    if (commandName === 'whitelist') {
        const user = options.getUser('user');
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        const key = generateKey();
        licenses.push({ key, discordId: user.id, discordName: user.tag, expiresAt });
        await interaction.reply({ content: `✅ Whitelisted ${user.tag}\nKey: \`${key}\``, ephemeral: true });
    }
    
    if (commandName === 'unwhitelist') {
        const user = options.getUser('user');
        licenses = licenses.filter(l => l.discordId !== user.id);
        await interaction.reply({ content: `✅ Removed ${user.tag}`, ephemeral: true });
    }
    
    if (commandName === 'blacklist') {
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'No reason';
        const license = licenses.find(l => l.discordId === user.id);
        if (license) license.blacklisted = true;
        await interaction.reply({ content: `✅ Blacklisted ${user.tag}\nReason: ${reason}`, ephemeral: true });
    }
    
    if (commandName === 'keys') {
        const embed = new EmbedBuilder().setTitle('📋 Keys').setColor(0x5865F2);
        licenses.slice(0, 20).forEach(l => {
            embed.addFields({ name: l.key, value: `User: ${l.discordName || 'Unused'}\nExpires: ${l.expiresAt?.toDateString() || 'Lifetime'}`, inline: false });
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    if (commandName === 'gen') {
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        const key = generateKey();
        licenses.push({ key, expiresAt });
        await interaction.reply({ content: `✅ Generated: \`${key}\``, ephemeral: true });
    }
    
    if (commandName === 'stats') {
        const active = licenses.filter(l => !l.blacklisted && (!l.expiresAt || l.expiresAt > new Date()));
        await interaction.reply({ content: `📊 Total: ${licenses.length} | Active: ${active.length} | Whitelisted: ${licenses.filter(l => l.discordId).length}`, ephemeral: true });
    }
});

// ============================================
// API SERVER (for license verification)
// ============================================
const express = require('express');
const app = express();
app.use(express.json());

app.get('/verify', (req, res) => {
    const { key, hwid } = req.query;
    const license = licenses.find(l => l.key === key);
    if (!license) return res.json({ valid: false, message: 'Invalid key' });
    if (license.blacklisted) return res.json({ valid: false, message: 'Blacklisted' });
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) return res.json({ valid: false, message: 'Expired' });
    if (license.hwid && license.hwid !== hwid) return res.json({ valid: false, message: 'HWID mismatch' });
    if (!license.hwid && hwid) license.hwid = hwid;
    res.json({ valid: true, message: 'License valid' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API on port ${PORT}`));

client.login(process.env.BOT_TOKEN);
