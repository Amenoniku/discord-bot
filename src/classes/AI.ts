require("dotenv").config();

import { cutMessage } from "../utils";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ModelMessage, streamText } from "ai";

interface AIInterface {
  context: Context;
  clearContext(): void;
  think(
    prompt: string,
    channelId: ChannelId,
    onChunk: (chunk: string) => Promise<void>,
    // draw(prompt: string): Promise<string>;
  ): Promise<void>;
}

type ChannelId = string;
type Role = "system" | "user" | "assistant";

type Context = {
  [key: ChannelId]: ModelMessage[];
};

type ContextItem = {
  role: Role;
  content: string;
};

export class AI implements AIInterface {
  private apiKey: string = process.env.OPENROUTER_KEY;
  private modelName: string = "openai/gpt-oss-20b:free";
  private maxTokens: number = 2048;
  private model = createOpenRouter({ apiKey: this.apiKey }).chat(
    this.modelName,
  );
  public context: Context = {};
  private channelId: ChannelId = "";

  constructor() {}

  // public async draw(prompt: string): Promise<string> {
  //   console.log("drawing...");
  //   try {
  //     return await this.imageRequest(prompt);
  //   } catch (error) {
  //     throw error;
  //   }
  // }
  // private async imageRequest(prompt: string): Promise<string> {
  //   try {
  //     const response = await this.api.images.generate({
  //       model: "dall-e-3",
  //       prompt,
  //       n: 1,
  //       size: "1024x1024",
  //     });
  //     return response.data[0].url;
  //   } catch (error) {
  //     throw `Сорян но такую хуйню не рисую! ${error.error.message}`;
  //   }
  // }

  public async think(
    prompt: string,
    channelId: ChannelId,
    onChunk: (chunk: string) => Promise<void>,
  ): Promise<void> {
    this.channelId = channelId;
    this.addContextItem(prompt, "user");
    try {
      const fullText = await this.textRequest(onChunk);
      this.addContextItem(fullText, "assistant");
    } catch (error) {
      throw error;
    }
  }
  private async textRequest(
    onChunk: (chunk: string) => Promise<void>,
  ): Promise<string> {
    try {
      const { textStream } = streamText({
        model: this.model,
        messages: this.context[this.channelId],
      });
      let fullText = "";
      for await (const delta of textStream) {
        fullText += delta;
        await onChunk(delta);
      }
      return fullText;
    } catch (error) {
      throw `Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй! ${error.error.message}`;
    }
  }

  private addContextItem(content: string, role?: Role) {
    const channelContext = this.context[this.channelId] || [];
    if (channelContext.length === 0)
      channelContext.push({
        role: "system",
        content: "Ты быдло гопник и по возможности отвечай панаскими цитатами",
      });
    const encode = (text: string) => Buffer.from(text).toString("base64");
    const currentTokens = encode(
      [content, channelContext.map((it) => it.content).join()].join(),
    ).length;
    while (currentTokens > this.maxTokens) {
      channelContext.splice(1, 1);
    }
    channelContext.push({ role, content });
    this.context[this.channelId] = channelContext;
  }

  public clearContext() {
    delete this.context[this.channelId];
  }
}
