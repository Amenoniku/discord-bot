import { Client } from "discord.js"
import type { Message } from "discord.js"
import { OpenAIApi } from 'openai'
// gpt-3-encoder
import { encode } from "gpt-3-encoder"

import { xTrim, cutMessage } from "../utils"

interface BotInterface {
  start(): void
}

type MessageToBot = string | false
type ChannelId = string
type Role = 'system' | 'user' | 'assistant'

type Context = {
  [key: ChannelId]: ContextItem[]
}

type ContextItem = {
  role: Role,
  content: string
}

export class Bot implements BotInterface {

  private loading: boolean = false
  private loadingMessage: Message
  private maxTokens: number = 2048
  private botName: string = 'Ус'
  private context: Context = {}
  private channelId: ChannelId = ''

  constructor(
    private client: Client,
    private api: OpenAIApi,
    botName?: string
  ) {
    if (botName) this.botName = botName
  }

  public start() {
    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user.tag}!`)
      // const channel = this.client.channels.cache.find(ch => ch.id == '436386682594525184')
      // channel.send('Усак на связи!')
    })
    this.client.on('messageCreate', this.messageProcessing.bind(this))
  }

  private async loadingOn(message: Message, reply: string) {
    this.loading = true
    this.loadingMessage = await message.reply(`Падажжи, ${reply}...`)
    return this.loadingMessage
  }
  private loadingOff() {
    if (!this.loading) return
    this.loadingMessage.delete()
    this.loading = false
  }
  private loadingError(msg: string) {
    this.loadingMessage.edit(msg)
    this.loading = false
  }

  private callToBot(message: Message): MessageToBot {
    const botNameRegExp = new RegExp(`^${this.botName} `, 'i');
    const botNameTest = botNameRegExp.test(message.content)
    const isCallToBot = message.author.bot === false && botNameTest
    if (isCallToBot) return message.content.replace(botNameRegExp, '').trim()
    else return false
  }

  private async messageProcessing(message: Message) {
    this.channelId = message.channel.id
    let messageToBot: MessageToBot = this.callToBot(message)
    if (this.loading || (!this.loading && !messageToBot)) return
    messageToBot = messageToBot.toString()
    switch (messageToBot.match(/^\S+/)?.[0]) {
      case 'контекст': message.reply(JSON.stringify(this.context)); break
      case 'нарисуй': this.draw(messageToBot, message); break
      case 'тема':
        this.clearContext()
        await message.reply('Ааа, ну давай...')
      default: this.think(message, messageToBot); break
    }
  }

  private async draw(prompt: string, message: Message) {
    console.log('drawing...');
    await this.loadingOn(message, 'рисую...')
    const imageUrl = await this.imageRequest(xTrim(prompt, 'нарисуй'))
    if (imageUrl) message.reply(imageUrl);
    this.loadingOff()
  }
  private async imageRequest(prompt: string): Promise<string> {
    try {
      const response = await this.api.createImage({
        prompt,
        n: 1,
        size: "1024x1024",
      })
      return response.data.data[0].url
    } catch (error) {
      this.loadingError(`Сорян но такую хуйню не рисую! ${error.response.statusText}`)
    }
  }

  private async think(message: Message, prompt: string ) {
    console.log('thinking...');
    await this.loadingOn(message, 'думаю...')
    this.addContextItem(prompt, 'user')
    const text = await this.textRequest()
    if (!text) return this.loadingError(`
         Чет меня поплавило... Давай, ебашь, по новой!
      `)
    this.addContextItem(text, 'assistant')
    this.loadingOff()
    for (const textPart of cutMessage(text, 2000)) {
      message.reply(textPart)
    }
  }
  private async textRequest(): Promise<string> {
    try {
      const gptResponce = await this.api.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: this.context[this.channelId],
        max_tokens: this.maxTokens,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      console.log(Object.values(gptResponce.data.choices[0]));
      
      return `${gptResponce.data.choices[0].message.content}`
    } catch (error) {
      this.loadingError(`
        Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй!
        ${error.response.statusText}
      `)
      this.clearContext()
    }
  }

  private addContextItem(content: string, role?: Role) {
    const channelContext = this.context[this.channelId] || []
    const currentTokens = encode([
      content,
      channelContext.map(it => it.content).join()
    ].join()).length
    while (currentTokens > this.maxTokens) {
      channelContext.shift()
    }
    channelContext.push({
      role: role === 'user' ?
        channelContext.length ? 'user' : 'system'
      : 'assistant',
      content
    })
    this.context[this.channelId] = channelContext
  }

  private clearContext() {
    delete this.context[this.channelId]
  }
  private purgeContext() {
    this.context = {}
  }

}
