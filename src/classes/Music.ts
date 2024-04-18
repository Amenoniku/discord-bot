import type { Client } from "discord.js"

interface MusicInterface {
  play(prompt: string): void
}

export class Music implements MusicInterface {
  constructor(private client: Client) {}

  public play(prompt: string) {
    console.log('Играю...', prompt)
  }
}