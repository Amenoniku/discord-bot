require('dotenv').config()
import { Client, GatewayIntentBits } from "discord.js"
import OpenAI from 'openai'

import { Bot } from "./classes/Bot";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const configuration = {
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_KEY
}

const openai = new OpenAI(configuration)

client.login(process.env.DISCORD_TOKEN)

const bot = new Bot(client, openai)
bot.start()