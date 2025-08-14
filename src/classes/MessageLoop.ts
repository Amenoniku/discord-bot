import { Message } from "discord.js";

interface MessageLoopInterface {
  addChunk(chunk: string): void;
}

type MessageObject = {
  text: string;
  message: Message | null;
};

export class MessageLoop implements MessageLoopInterface {
  private messageText: string = "";
  private messageArray: MessageObject[] = [
    {
      text: "",
      message: null,
    },
  ];
  private isLooping: boolean = false;
  private MAX_MESSAGE_LENGTH: number = 2000;

  constructor(private message: Message) {}

  public addChunk(chunk: string): void {
    this.messageText += chunk;
    const messageIndex = Math.floor(
      this.messageText.length / this.MAX_MESSAGE_LENGTH,
    );
    if (!this.messageArray[messageIndex]) {
      this.messageArray.push({
        text: "",
        message: null,
      });
    }
    this.messageArray[messageIndex].text += chunk;
    if (!this.isLooping) {
      this.isLooping = true;
      setTimeout(() => {
        this.loop();
      }, 1000);
    }
  }

  private async loop(): Promise<void> {
    const snapshot = this.messageText;
    await this.sendMessage();
    if (this.messageText !== snapshot) {
      await this.loop();
    }
  }

  private async sendMessage(): Promise<void> {
    for await (const messageObj of this.messageArray) {
      if (messageObj.text.length === 0) continue;
      if (messageObj.message) {
        await messageObj.message.edit(messageObj.text);
      } else {
        console.log(`Sending message: ${messageObj.text}`);
        messageObj.message = await this.message.reply(messageObj.text);
      }
    }
  }
}
