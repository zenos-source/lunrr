const { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

const License = mongoose.model('License', new mongoose.Schema({ key: String, discordId: String, hwid: String, expiresAt: Date, blacklisted: Boolean }));

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} online`);
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: [{ name: 'setpanel', description: 'Create control panel', options: [{ name: 'name', type: 3, required: true }] }] });
});

client.on('interactionCreate', async (i) => {
  if (!i.isCommand()) return;
  if (i.commandName === 'setpanel') {
    const embed = new EmbedBuilder().setTitle(`⚡ ${i.options.getString('name')} Panel`).setDescription('Click buttons below').setColor(0x5865F2);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('redeem').setLabel('🎫 Redeem').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('script').setLabel('📜 Script').setStyle(ButtonStyle.Success)
    );
    await i.channel.send({ embeds: [embed], components: [row] });
    await i.reply({ content: '✅ Panel created!', ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);
