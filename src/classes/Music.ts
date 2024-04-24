require('dotenv').config()
import { createWriteStream, createReadStream } from "fs";
import { readdir, unlink } from "node:fs/promises";
import { join } from "path";
import * as ytdl from '@distube/ytdl-core';

import type { VoiceBasedChannel, Client, TextChannel, Message } from "discord.js"
import {
  joinVoiceChannel,
  VoiceConnection,
  createAudioPlayer,
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  createAudioResource,
  AudioResource,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice"
import { google, youtube_v3 } from 'googleapis';

interface MusicInterface {
  player: AudioPlayer
  skip(): void
  clearQueue(): void
  renderQueue(): void
  play(prompt: string, voiceChannel: VoiceBasedChannel, textChannel: TextChannel): Promise<void>
}

type Track = {
  url: string
  title: string
}

export class Music implements MusicInterface {

  private ytapi: youtube_v3.Youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_TOKEN})

  private textChannel: TextChannel
  private voiceConnection: VoiceConnection = null
  private voiceChannel: VoiceBasedChannel
  private disconTimer = null

  public player: AudioPlayer
  private queue: Track[] = []
  private currentTrack: Track
  private playListMessage: Message = null

  constructor(private client: Client) {

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });
    this.player.on('stateChange', async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
      if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
        this.currentTrack = null
        for (const file of await readdir('resources')) {
          await unlink(join('resources/', file));
        }
        if (this.queue[0]) this.makeAudioResource()
        else this.playListMessage.delete()
      }
    });
    this.player.on('error', error => {
      console.error(`Error: ${error.message} with resource ${error.resource.metadata}`);
      this.makeAudioResource()
    });

    this.client.on('voiceStateUpdate', this.voiceStateUpdateHandler)
  }

  public async play(prompt: string, voiceChannel: VoiceBasedChannel, textChannel: TextChannel): Promise<void> {
    console.log('Зажигаю...', prompt)
    try {
      this.connection(voiceChannel)
      this.textChannel = textChannel
      await this.promptParse(prompt)
      if (this.currentTrack) this.renderQueue()
      if (this.player.state.status === AudioPlayerStatus.Idle) await this.makeAudioResource()
    } catch (error) {
      throw error
    }
  }

  public skip() {
    if (this.currentTrack === null) return 'Нечего скипать'
    const track: string = `Скипнул трек: [${this.currentTrack.title}](<${this.currentTrack.url}>)`
    this.player.stop()
    return track
  }

  private addQueue(track: Track) {
    const maxQueue = 200
    if ((this.queue.length + 1) < maxQueue ) this.queue.push(track)
  }

  public clearQueue() {
    this.queue = []
  }
  public async renderQueue() {
    if (this.playListMessage) {
      this.playListMessage.delete()
      this.playListMessage = null
    }
    const shownTracks = 3
    const limit = (shownTracks * 2);
    let playlistText = ''
    const mapper = (arr: Track[], isLast: boolean = false): string => arr
      .map((item, i) => `${i + (
        isLast
          ? (this.queue.length - shownTracks) + 1
          : 1
      )}. ${item.title}`)
      .join('\n')
    if (this.queue.length > limit) {
      const firstChunk = this.queue.slice(0, shownTracks);
      const lastChunk = this.queue.slice(-shownTracks);
      playlistText = `${mapper(firstChunk)}\n...\n${mapper(lastChunk, true)}`
    } else playlistText = mapper(this.queue)
    this.playListMessage = await this.textChannel.send(`\`\`\`Играет: ${this.currentTrack.title}${playlistText ? `\n\nПлейлист:\n${playlistText}` : ''}\`\`\``)
  }

  private async promptParse(prompt) {
    let url: URL
    try {
      url = new URL(prompt)
    } catch (e) {
      url = null
    }
    if (url) {
      const query: URLSearchParams = url.searchParams
      if (query.has('list')) {
        const { data } = await this.ytapi.playlistItems.list({
          part: ['snippet'],
          playlistId: query.get('list'),
          maxResults: 50
        })
        data.items.forEach(item => {
          this.addQueue({ url: `https://youtu.be/${item.snippet.resourceId.videoId}`, title: item.snippet.title })
        })
      } else return await this.getTrackInfo(url.href)
    } else {
      try {
        const { data } = await this.ytapi.search.list({
          part: ['snippet'],
          q: prompt,
          maxResults: 1,
          type: ['music']
        })
        const searchTrack = data.items[0]
        if (searchTrack) this.addQueue({ url: `https://youtu.be/${searchTrack.id.videoId}`, title: searchTrack.snippet.title })
        else throw 'Трек не найден';
      } catch (error) {
        throw 'Трек не найден';
      }
      
    }
  }

  private async getTrackInfo(href: string) {
    try {
      const { videoDetails }: ytdl.videoInfo = await ytdl.getBasicInfo(href)
      this.addQueue({url: videoDetails.video_url, title: videoDetails.title});
    } catch (error) {
      throw error
    }
  }

  private makeAudioResource (): Promise<AudioResource> {
    return new Promise(async (resolve, reject) => {
      this.currentTrack = this.queue.shift()
      if (!this.currentTrack) return reject('Нету трека')
      const fileName = `resources/${`${Math.random()}`.replace('0.', '')}.webm`
      let ytdlStream
      try {
        ytdlStream = ytdl(this.currentTrack.url.trim(), { filter: 'audioonly' })
      } catch (error) {
        throw reject(error);
      }
      ytdlStream.pipe(createWriteStream(fileName))
      ytdlStream.on('finish', () => {
        const resource: AudioResource = createAudioResource(createReadStream(fileName), {
          inputType: StreamType.WebmOpus,
          inlineVolume: true,
        });
        this.player.play(resource)
        this.renderQueue()
        resolve(resource)
      });
      ytdlStream.on('error', err => reject(err))
    })
  }

  private connection(voiceChannel: VoiceBasedChannel) {
    if (!voiceChannel) throw 'Ты ебанько? И куда я играть буду?! Го в голос и давай по новой!'
    else if (this.voiceConnection?.joinConfig.channelId === voiceChannel?.id) return
    this.voiceChannel = voiceChannel
    this.voiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    this.voiceConnection.subscribe(this.player)
  }
  private voiceStateUpdateHandler = () => {
    if (!this.voiceConnection) return
    if (this.voiceChannel.members.size === 1 && this.disconTimer === null) this.disconTimer = setTimeout(() => {
      this.player.stop()
      this.voiceConnection.destroy();
      this.queue = []
      this.disconTimer = null
      this.voiceConnection = null
    }, (2 * 60) * 1000);
    else {
      clearTimeout(this.disconTimer)
      this.disconTimer = null
    }
  };
}