import { Client } from "discord.js"
import type { Message } from "discord.js"

import { AI } from "./AI";
import { Music } from "./Music";

import { xTrim } from "../utils"

interface BotInterface {
  start(): void
}

type MessageToBot = string | false
type ChannelId = string

export class Bot implements BotInterface {

  private loading: boolean = false
  private loadingMessage: Message
  private botName: string = 'Ус'
  private channelId: ChannelId = ''
  private ai: AI
  private music: Music

  constructor(
    private client: Client,
    api,
    botName?: string
  ) {
    if (botName) this.botName = botName
    this.ai = new AI(api)
    this.music = new Music(client)
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
    try {
      switch (messageToBot.match(/^\S+/)?.[0]) {

        case 'го':
          await this.loadingOn(message, 'ща запою...')
          this.music.play(xTrim(messageToBot, 'го'))
          break

        case 'контекст': message.reply(JSON.stringify(this.ai.context)); break

        case 'нарисуй':
          await this.loadingOn(message, 'рисую...')
          message.reply(await this.ai.draw(xTrim(messageToBot, 'нарисуй')))
          break

        case 'тема':
          this.ai.clearContext()
          await message.reply('Ааа, ну давай...')
          break

        default:
          await this.loadingOn(message, 'думаю...')
          const cuttedMessage = await this.ai.think(messageToBot, this.channelId)
          cuttedMessage.forEach((chunk) => message.reply(chunk))
          break
      }
    } catch (error) {
      this.loadingError(error)
    } finally {
      this.loadingOff()
    }
  }

}
