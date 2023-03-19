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
let loading = false

client.on('messageCreate', async message => {
  const channelId = message.channelId
  const usakRegExp = /^усак/i
  const callToBot = usakRegExp.test(message.content)
  if (
    message.author.bot ||
    (message.author.bot && callToBot) ||
    (!message.author.bot && !callToBot)
  ) return
  const messageToGPT = message.content.replace(usakRegExp, '').trim()
  if (!messageToGPT && loading) return

  if (/^нарисуй/i.test(messageToGPT)) {
    loading = await message.reply('Падажжи, рисую...')
    try {
      const response = await openai.createImage({
        prompt: messageToGPT.replace(/^нарисуй/i, '').trim(),
        n: 1,
        size: "1024x1024",
      });
      loading.delete()
      console.log(response.data);
      const image = response.data.data[0].url;
      message.reply(image);
    } catch (error) {
      loading.edit(`Сорян но такую хуйню не рисую! ${error.response.statusText}`)
    } finally {
      loading = false
    }
    return
  }
  if (/^контекст/i.test(messageToGPT)) {
    message.reply(JSON.stringify(context))
  }
  switch (messageToGPT) {
    case 'сменим тему':
    case 'смени тему':
    case 'тему смени':
    case 'тема':
      context[channelId] = []
      await message.reply('Ааа, ну давай...')
      return
  }
  loading = await message.reply('Падажжи, думаю...')
  context[channelId] = context[channelId] || []
  context[channelId].push({role: context[channelId].length ? 'user' : 'system', content: `${messageToGPT}`})
  const sendRequest = async () => {
    console.log(context);
    try {
      const options = {
        model: "gpt-3.5-turbo",
        messages: context[channelId],
        max_tokens: maxTokens,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      }
      const gptResponce = await openai.createChatCompletion(options)
      loading.delete()
      const resMessage = `${gptResponce.data.choices[0].message.content}`
      if (!resMessage) return loading.edit('Чет сервак молчит...')
      // console.log(gptResponce.data)
      context[channelId].push({role: 'assistant', content: resMessage})
      const maxMessageLength = 2000;
      if (resMessage.length > maxMessageLength) {
        const numPieces = Math.ceil(resMessage.length / maxMessageLength);
        for (let i = 0; i < numPieces; i++) {
          const start = i * maxMessageLength;
          const end = start + maxMessageLength;
          const piece = resMessage.substring(start, end);
          message.reply(piece);
        }   
      } else message.reply(resMessage)
    } catch (error) {
      loading.edit(`Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй! ${error.response.statusText}`)
      context[channelId] = []
    } finally {
      loading = false
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