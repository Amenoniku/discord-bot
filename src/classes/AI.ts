import OpenAI from 'openai'
import { encode } from "gpt-3-encoder"

require('dotenv').config()

import { cutMessage } from "../utils"

interface AIInterface {
  context: Context,
  clearContext(): void,
  think(prompt: string, channelId: ChannelId): Promise<string[]>
  draw(prompt: string): Promise<string>
}

type ChannelId = string
type Role = 'system' | 'user' | 'assistant'

type Context = {
  [key: ChannelId]: ContextItem[]
}

type ContextItem = {
  role: Role,
  content: string
}

export class AI implements AIInterface {

  private maxTokens: number = 2048
  private api: OpenAI
  public context: Context = {}
  private channelId: ChannelId = ''

  constructor() {
    this.api = new OpenAI({apiKey: process.env.OPENAI_KEY})
  }

  public async draw(prompt: string): Promise<string> {
    console.log('drawing...');
    try {
      return await this.imageRequest(prompt)
    } catch (error) {
      throw error
    }
  }
  private async imageRequest(prompt: string): Promise<string> {
    try {
      const response = await this.api.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      })
      return response.data[0].url
    } catch (error) {
      throw (`Сорян но такую хуйню не рисую! ${error.error.message}`)
    }
  }

  public async think(prompt: string, channelId: ChannelId ): Promise<string[]> {
    this.channelId = channelId
    this.addContextItem(prompt, 'user')
    try {
      const text = await this.textRequest()
      this.addContextItem(text, 'assistant')
      return cutMessage(text, 2000)
    } catch (error) {
      throw error;
    }
  }
  private async textRequest(): Promise<string> {
    try {
      const gptResponce = await this.api.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: this.context[this.channelId],
        max_tokens: this.maxTokens,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
      return gptResponce.choices[0].message.content
    } catch (error) {
      throw `Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй! ${error.error.message}`
    }
  }

  private addContextItem(content: string, role?: Role) {
    const channelContext = this.context[this.channelId] || []
    if (channelContext.length === 0) channelContext.push({
      role: 'system',
      content: 'Ты быдло гопник и по возможности отвечай панаскими цитатами'
    })
    const currentTokens = encode([
      content,
      channelContext.map(it => it.content).join()
    ].join()).length
    while (currentTokens > this.maxTokens) {
      channelContext.splice(1, 1)
    }
    channelContext.push({role, content})
    this.context[this.channelId] = channelContext
  }

  public clearContext() {
    delete this.context[this.channelId]
  }
  private purgeContext() {
    this.context = {}
  }

}
