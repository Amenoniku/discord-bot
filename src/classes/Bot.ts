import { Client } from "discord.js"
import type { Message } from "discord.js"
import { OpenAIApi } from 'openai'

import { xTrim } from "../utils"

interface BotInterface {
  start(): void
}

export class Bot implements BotInterface {

  private loading: boolean = false
  private loadingMessage: Message
  private maxTokens: number = 2048
  private context: string[] = []
  private botName: string = 'Ус'

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
    return this.loading
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

  private callToBot(message: Message): string | false {
    const botNameRegExp = new RegExp(`^${this.botName}`, 'i');
    const botNameTest = botNameRegExp.test(message.content)
    const isNotCallToBot = !message.author.bot && !botNameTest
    if (isNotCallToBot) return false
    return message.content.replace(botNameRegExp, '').trim()
  }

  private async messageProcessing(message: Message) {
    let messageToGPT = this.callToBot(message)
    if (!messageToGPT && !this.loading) return
    messageToGPT = messageToGPT.toString()
    switch (messageToGPT.match(/^\S+/)[0]) {
      case 'контекст':
        message.reply(JSON.stringify(this.context))
        break;
      case 'нарисуй':
        await this.loadingOn(message, 'рисую...')
        const imageUrl = await this.imageRequest(xTrim(messageToGPT, 'нарисуй'))
        if (imageUrl) message.reply(imageUrl);
        this.loadingOff()
        break;
      default:
        break;
    }
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
}
