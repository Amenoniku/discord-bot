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
  if (loading) return
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

  switch (messageToGPT) {
    case 'сменим тему':
    case 'смени тему':
    case 'тему смени':
    case 'тема':
      context = []
      await message.reply('Ааа, ну давай...')
      return
  }
  loading = await message.reply('Падажжи, думаю...')
  context.push({role: context.length ? 'user' : 'system', content: `${messageToGPT}`})
  const sendRequest = async () => {
    try {
      const options = {
        model: "gpt-3.5-turbo",
        messages: context,
        max_tokens: maxTokens,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      }
      const gptResponce = await openai.createChatCompletion(options)
      // const gptResponce = await openai.createCompletion(options)
      loading.delete()
      const resMessage = `${gptResponce.data.choices[0].message.content}`
      if (!resMessage) return loading.edit('Чет сервак молчит...')
      console.log(gptResponce.data)
      context.push({role: 'assistant', content: resMessage})
      //if there are more than 2000 characters in resMessage, then it is broken into pieces of 2000 characters each
      if (resMessage.length > 2000) {
        const maxLength = 2000;
        const numPieces = Math.ceil(resMessage.length / maxLength);
        const messagePieces = [];
        for (let i = 0; i < numPieces; i++) {
          const start = i * maxLength;
          const end = start + maxLength;
          const piece = resMessage.substring(start, end);
          message.reply(piece);
        }   
      } else message.reply(resMessage)
    } catch (error) {
      console.log(error);
      loading.edit(`Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй! ${error.response.statusText}`)
      context = []
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