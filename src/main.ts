import { Client, GatewayIntentBits, Collection } from "discord.js"

require('dotenv').config()

import { Bot } from "./classes/Bot";
import ping from "./commands/utility/ping";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
})

// client.commands = new Collection();
// client.commands.set('ping', ping)

client.login(process.env.DISCORD_TOKEN)

const bot = new Bot(client, process.env.BOT_NAME)
bot.start()
