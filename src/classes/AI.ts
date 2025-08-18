require("dotenv").config();

import { cutMessage } from "../utils";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ModelMessage, streamText } from "ai";
import { GuildMember } from "discord.js";
import { readFileSync } from "fs";
import { join } from "path";

interface AIInterface {
  context: Context;
  clearContext(): void;
  think(
    prompt: string,
    channelId: ChannelId,
    member: GuildMember,
    onChunk: (chunk: string) => Promise<void>,
    // draw(prompt: string): Promise<string>;
  ): Promise<string>;
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

interface ModelData {
  id: string;
  context_length: number;
}

interface ModelsResponse {
  data?: ModelData[];
}

export class AI implements AIInterface {
  private apiKey: string = process.env.OPENROUTER_KEY;
  private modelName: string = "moonshotai/kimi-k2:free";
  private maxTokens: number = 2048;
  private model = createOpenRouter({ apiKey: this.apiKey }).chat(
    this.modelName,
  );
  public context: Context = {};
  private channelId: ChannelId = "";
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = this.loadSystemPrompt(); // По умолчанию русский
    this.getModelContextLength();
  }

  public async think(
    prompt: string,
    channelId: ChannelId,
    member: GuildMember,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    this.channelId = channelId;
    this.addContextItem(`${member.displayName}: ${prompt}`, "user");
    try {
      const fullText = await this.textRequest(onChunk);
      this.addContextItem(fullText, "assistant");
      return fullText;
    } catch (error) {
      console.error(error);
      throw `Бля чел, я заебался! Спроси ченить попроще... И вообще, иди на хуй! ${error}`;
    }
  }
  private async textRequest(onChunk: (chunk: string) => void): Promise<string> {
    try {
      const { textStream } = streamText({
        model: this.model,
        messages: this.context[this.channelId],
      });
      let fullText = "";
      for await (const delta of textStream) {
        fullText += delta;
        onChunk(delta);
      }
      return fullText;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private addContextItem(content: string, role?: Role) {
    const channelContext = this.context[this.channelId] || [];
    if (channelContext.length === 0)
      channelContext.push({
        role: "system",
        content: this.systemPrompt,
      });

    // Добавляем новое сообщение
    channelContext.push({ role, content });

    // Приблизительный подсчет токенов (4 символа ≈ 1 токен)
    const estimateTokens = (content: string | any) => {
      if (typeof content === "string") {
        return Math.ceil(content.length);
      }
      // Для сложных типов контента возвращаем приблизительную оценку
      return Math.ceil(JSON.stringify(content).length);
    };

    // Подсчитываем общее количество токенов в контексте
    let totalTokens = channelContext.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0,
    );

    // Удаляем старые сообщения (кроме системного), если превышен лимит
    while (totalTokens > this.maxTokens && channelContext.length > 2) {
      channelContext.splice(1, 1); // Удаляем второе сообщение (первое после системного)
      totalTokens = channelContext.reduce(
        (sum, msg) => sum + estimateTokens(msg.content),
        0,
      );
    }

    this.context[this.channelId] = channelContext;
  }

  public clearContext() {
    delete this.context[this.channelId];
  }

  private async getModelContextLength(): Promise<void> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("Failed to fetch model info, using default maxTokens");
        return;
      }

      const data: ModelsResponse = await response.json();
      const modelInfo = data.data?.find((model) => model.id === this.modelName);

      if (modelInfo && modelInfo.context_length) {
        this.maxTokens = modelInfo.context_length;
        console.log(
          `Model ${this.modelName} context length: ${this.maxTokens} tokens`,
        );
      } else {
        console.warn(
          `Model ${this.modelName} not found or no context_length info, using default maxTokens`,
        );
      }
    } catch (error) {
      console.error("Error fetching model context length:", error);
    }
  }

  private loadSystemPrompt(): string {
    try {
      const fileName = "system.txt";
      const promptPath = join(__dirname, "../../prompts", fileName);
      return readFileSync(promptPath, "utf-8");
    } catch (error) {
      console.error("Error loading system prompt:", error);
      return "You are a helpful AI assistant.";
    }
  }
}
