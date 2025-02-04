require('dotenv').config()
import { Client, GatewayIntentBits } from "discord.js"

import { Bot } from "./classes/Bot";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
})

discordClient.login(process.env.DISCORD_TOKEN)

const bot = new Bot(discordClient, process.env.BOT_NAME)
bot.start()
