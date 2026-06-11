const { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store data
let licenses = [];
let activePanels = new Map();
let panelNames = new Map(); // Store panel name per server

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
    { name: 'setpanel', description: 'Create the control panel in this channel', options: [{ name: 'name', description: 'Panel name (e.g., FLASH TP)', type: 3, required: true }] },
    { name: 'whitelist', description: 'Whitelist a user', options: [{ name: 'user', type: 6, required: true }, { name: 'days', type: 4, required: false }] },
    { name: 'unwhitelist', description: 'Remove user from whitelist', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'blacklist', description: 'Blacklist a user', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: false }] },
    { name: 'keys', description: 'List all active keys' },
    { name: 'gen', description: 'Generate a license key', options: [{ name: 'days', type: 4, required: false }] },
    { name: 'stats', description: 'View bot statistics' }
];

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✅ Registered ${commands.length} slash commands`);
    } catch (error) {
        console.error(error);
    }
});

// ============================================
// CREATE PANEL (Asks for name)
// ============================================

async function createPanel(channel, panelName) {
    panelNames.set(channel.guild.id, panelName);
    
    const embed = new EmbedBuilder()
        .setTitle(`⚡ ${panelName} Control Panel`)
        .setDescription(`This control panel is for the project: **${panelName}**\nIf you're a buyer, click the buttons below to redeem your key, get the script or reset your HWID`)
        .setColor(0x5865F2)
        .setFooter({ text: 'Made with ❤️ - Support: discord.gg/support' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('redeem').setLabel('🎫 Redeem Key').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('script').setLabel('📜 Get Script').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('resethwid').setLabel('🔄 Reset HWID').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('status').setLabel('📊 My Status').setStyle(ButtonStyle.Secondary)
        );

    const message = await channel.send({ embeds: [embed], components: [row] });
    activePanels.set(channel.guild.id, message.id);
    return message;
}

// ============================================
// BUTTON HANDLERS
// ============================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    const { customId, user, guild } = interaction;
    let license = licenses.find(l => l.discordId === user.id);
    const panelName = panelNames.get(guild.id) || 'Lunr';
    
    // ========== REDEEM KEY BUTTON ==========
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
    
    // ========== GET SCRIPT BUTTON ==========
    if (customId === 'script') {
        if (!license || license.blacklisted) {
            return interaction.reply({ content: '❌ No active license found! Use "Redeem Key" first.', ephemeral: true });
        }
        
        const isExpired = license.expiresAt && new Date(license.expiresAt) < new Date();
        if (isExpired && !license.isLifetime) {
            return interaction.reply({ content: '❌ Your license has expired!', ephemeral: true });
        }
        
        // REAL LOADER SCRIPT
        const script = `-- ${panelName} Loader
-- Licensed to: ${user.tag}
-- Expires: ${license.isLifetime ? 'Lifetime' : new Date(license.expiresAt).toDateString()}

local key = "${license.key}"
local hwid = game:GetService("Players").LocalPlayer.UserId

local function verifyLicense()
    local url = "https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-api.railway.app'}/verify?key=" .. key .. "&hwid=" .. hwid
    local success, response = pcall(function()
        return game:GetService("HttpService"):JSONDecode(game:HttpGet(url))
    end)
    
    if not success then
        return { valid = false, message = "API Error - Contact support" }
    end
    return response
end

local result = verifyLicense()

if result.valid then
    print("✅ " .. result.message)
    -- Load your actual script here
    loadstring(game:HttpGet("https://your-script-url.lua"))()
else
    game:GetService("StarterGui"):SetCore("SendNotification", {
        Title = "${panelName} - License Error",
        Text = result.message,
        Duration = 10
    })
end`;
        
        try {
            await user.send({ 
                content: `📜 **Your ${panelName} Loader Script**\nCopy the code below into your executor:`, 
                files: [{ attachment: Buffer.from(script), name: `${panelName.toLowerCase()}_loader.lua` }] 
            });
            await interaction.reply({ content: '✅ Script sent to your DMs!', ephemeral: true });
        } catch(e) {
            await interaction.reply({ content: '❌ I couldn\'t DM you! Please enable DMs from server members.', ephemeral: true });
        }
    }
    
    // ========== RESET HWID BUTTON ==========
    if (customId === 'resethwid') {
        if (!license) {
            return interaction.reply({ content: '❌ No license found! Use "Redeem Key" first.', ephemeral: true });
        }
        
        const lastReset = license.lastHwidReset;
        const cooldownDays = 7;
        
        if (lastReset) {
            const daysSince = (Date.now() - new Date(lastReset)) / (1000 * 60 * 60 * 24);
            if (daysSince < cooldownDays) {
                const remaining = Math.ceil(cooldownDays - daysSince);
                return interaction.reply({ content: `⏰ HWID reset on cooldown! Try again in ${remaining} days.`, ephemeral: true });
            }
        }
        
        license.hwid = null;
        license.lastHwidReset = new Date();
        license.hwidResetCount = (license.hwidResetCount || 0) + 1;
        
        await interaction.reply({ content: '🔄 Your HWID has been reset! You can now activate on a new device.', ephemeral: true });
    }
    
    // ========== STATUS BUTTON ==========
    if (customId === 'status') {
        if (!license) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setTitle('📊 License Status').setDescription('No license found. Use "Redeem Key" to activate.').setColor(0xED4245)],
                ephemeral: true 
            });
        }
        
        const isExpired = license.expiresAt && new Date(license.expiresAt) < new Date();
        const isActive = !license.blacklisted && !isExpired;
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${panelName} - License Status`)
            .setColor(isActive ? 0x57F287 : 0xED4245)
            .addFields(
                { name: 'Status', value: isActive ? '✅ ACTIVE' : (license.blacklisted ? '❌ BLACKLISTED' : '❌ EXPIRED'), inline: true },
                { name: 'Expires', value: license.isLifetime ? '👑 Lifetime' : (license.expiresAt ? new Date(license.expiresAt).toDateString() : 'Unknown'), inline: true },
                { name: 'HWID', value: license.hwid ? '🔒 Locked' : '⚠️ Not set', inline: true },
                { name: 'Key', value: `\`${license.key}\``, inline: false }
            );
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================
// MODAL HANDLER (Redeem Key)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'redeemModal') return;
    
    const key = interaction.fields.getTextInputValue('key').toUpperCase();
    const user = interaction.user;
    const panelName = panelNames.get(interaction.guildId) || 'Lunr';
    
    const license = licenses.find(l => l.key === key);
    
    if (!license) {
        return interaction.reply({ content: '❌ Invalid license key!', ephemeral: true });
    }
    
    if (license.discordId && license.discordId !== user.id) {
        return interaction.reply({ content: '❌ This key is already linked to another Discord account!', ephemeral: true });
    }
    
    if (license.blacklisted) {
        return interaction.reply({ content: '❌ This key has been blacklisted!', ephemeral: true });
    }
    
    if (!license.isLifetime && license.expiresAt && new Date(license.expiresAt) < new Date()) {
        return interaction.reply({ content: '❌ This key has expired!', ephemeral: true });
    }
    
    license.discordId = user.id;
    license.discordName = user.tag;
    license.redeemedAt = new Date();
    
    const embed = new EmbedBuilder()
        .setTitle(`✅ ${panelName} - Key Redeemed!`)
        .setDescription(`Your license is now linked to **${user.tag}**`)
        .setColor(0x57F287)
        .addFields(
            { name: 'Expires', value: license.isLifetime ? 'Lifetime' : new Date(license.expiresAt).toDateString(), inline: true },
            { name: 'Key', value: `\`${license.key}\``, inline: false }
        );
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
});

// ============================================
// SLASH COMMANDS (Admin)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName, options, member, channel } = interaction;
    const isAdmin = member.permissions.has('Administrator');
    
    // ========== SETPANEL (with name) ==========
    if (commandName === 'setpanel') {
        if (!isAdmin) return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
        const panelName = options.getString('name');
        await createPanel(channel, panelName);
        await interaction.reply({ content: `✅ Control panel created with name: **${panelName}**`, ephemeral: true });
    }
    
    if (!isAdmin) return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
    
    // ========== WHITELIST ==========
    if (commandName === 'whitelist') {
        const user = options.getUser('user');
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        let license = licenses.find(l => l.discordId === user.id);
        if (license) {
            license.expiresAt = expiresAt;
            license.blacklisted = false;
            await interaction.reply({ content: `✅ Updated ${user.tag}'s license! Expires in ${days} days.`, ephemeral: true });
        } else {
            const key = generateKey();
            licenses.push({ key, discordId: user.id, discordName: user.tag, expiresAt, hwid: null, blacklisted: false });
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
    
    // ========== KEYS ==========
    if (commandName === 'keys') {
        const activeKeys = licenses.filter(l => !l.blacklisted);
        const embed = new EmbedBuilder().setTitle('📋 Active Keys').setDescription(`Total: ${activeKeys.length} keys`).setColor(0x5865F2);
        activeKeys.slice(0, 20).forEach(k => {
            embed.addFields({ name: k.key, value: `User: ${k.discordName || 'Unused'}\nExpires: ${k.expiresAt?.toDateString() || 'Lifetime'}`, inline: false });
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // ========== GEN ==========
    if (commandName === 'gen') {
        const days = options.getInteger('days') || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        const key = generateKey();
        licenses.push({ key, expiresAt, hwid: null, blacklisted: false });
        await interaction.reply({ content: `✅ New key generated!\n\`${key}\`\nExpires in ${days} days`, ephemeral: true });
    }
    
    // ========== STATS ==========
    if (commandName === 'stats') {
        const activeKeys = licenses.filter(l => !l.blacklisted && (!l.expiresAt || l.expiresAt > new Date()));
        const embed = new EmbedBuilder().setTitle('📊 Bot Statistics').setColor(0x5865F2)
            .addFields(
                { name: 'Total Keys', value: `${licenses.length}`, inline: true },
                { name: 'Active Keys', value: `${activeKeys.length}`, inline: true },
                { name: 'Whitelisted Users', value: `${licenses.filter(l => l.discordId).length}`, inline: true }
            );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// ============================================
// EXPRESS API (for license verification)
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
    
    res.json({ valid: true, message: 'License valid', expires: license.expiresAt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API on port ${PORT}`));

client.login(process.env.BOT_TOKEN);
