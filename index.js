require('dotenv').config()

const { Client, GatewayIntentBits } = require('discord.js')
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_KEY
})

const openai = new OpenAIApi(configuration)

const maxTokens = 2048
let context = []

client.on('messageCreate', async message => {
  const usakRegExp = /^усак/i
  const callToBot = usakRegExp.test(message.content)
  if (
    message.author.bot ||
    (message.author.bot && callToBot) ||
    (!message.author.bot && !callToBot)
  ) return
  const messageToGPT = message.content.replace(usakRegExp, '').trim()
  if (!messageToGPT) return
  console.log(messageToGPT);
  switch (messageToGPT) {
    case 'сменим тему':
    case 'смени тему':
    case 'тему смени':
    case 'тема':
      context = []
      await message.reply('Ааа, ну давай...')
      return
  }
  // context.push(`${messageToGPT}`)
  // while (context.join().length >= (maxTokens - 300)) context.shift()
  let loading = await message.reply('Падажжи, думаю...')
  const sendRequest = async () => {
    try {
      const gptResponce = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: context.join('\n').trim(),
        temperature: 0.2,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      loading.delete()
      const resMessage = `${gptResponce.data.choices[0].text}`
      context.push(resMessage)
      if (resMessage) message.reply(resMessage)
    } catch (error) {
      loading.edit('Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй!')
      context = []
    }
  }
  sendRequest()
})

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  const channel = client.channels.cache.find(ch => ch.id == '436386682594525184')
  // channel.send('Усак на связи!')
});

client.login(process.env.DISCORD_TOKEN)