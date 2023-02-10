require('dotenv').config()

import { Client, GatewayIntentBits } from "discord.js"
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.login(process.env.DISCORD_TOKEN)