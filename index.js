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

const contexts = {}

client.on('messageCreate', async message => {
  const usakRegExp = /^усак/i
  const callToBot = usakRegExp.test(message.content)
  if (
    message.author.bot ||
    (message.author.bot && callToBot) ||
    (!message.author.bot && !callToBot)
  ) return
  const authorId = message.author.id
  const messageToGPT = message.content.replace(usakRegExp, '').trim()
  console.log(messageToGPT);
  switch (messageToGPT) {
    case 'сменим тему':
    case 'смени тему':
    case 'тему смени':
      contexts[authorId] = ''
      await message.reply('Ааа, ну давай...')
      return
      }
      contexts[authorId] = contexts[authorId] || ''
      contexts[authorId] += `${messageToGPT}\n`
      let loading = await message.reply('Падажжи, думаю...')
  try {
    const gptResponce = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: contexts[authorId],
      temperature: 0.9,
      max_tokens: 3500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    })
    loading.delete()
    const resMessage = `${gptResponce.data.choices[0].text}\n`
    contexts[authorId] += resMessage
    message.reply(resMessage)
  } catch (error) {
    loading.delete()
    message.reply('Бля чел, че доебался то? Спроси ченить попроще... И вообще, иди на хуй!')
    contexts[authorId] = ''
  }
})

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  const channel = client.channels.cache.find(ch => ch.id == '436386682594525184')
  channel.send('Усак на связи!')
});

client.login(process.env.DISCORD_TOKEN)