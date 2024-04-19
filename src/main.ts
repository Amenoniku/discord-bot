require('dotenv').config()
import { Client, GatewayIntentBits } from "discord.js"

import { Bot } from "./classes/Bot";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.login(process.env.DISCORD_TOKEN)

const bot = new Bot(client, process.env.BOT_NAME)
bot.start()
