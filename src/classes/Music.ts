require('dotenv').config()
import * as ytdl from 'ytdl-core';
import type { VoiceBasedChannel, Client } from "discord.js"
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
  clearQueue(): void
  renderQueue(): void
  play(prompt: string, voiceChannel: VoiceBasedChannel): Promise<string>
}

type Track = {
  url: string
  title: string
}

export class Music implements MusicInterface {

  private ytapi: youtube_v3.Youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_TOKEN})

  private voiceConnection: VoiceConnection = null
  private voiceChannel: VoiceBasedChannel
  private disconTimer = null

  public player: AudioPlayer
  private queue: Track[] = []
  private playList: string = ''

  constructor(private client: Client) {

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Stop,
      },
    });
    this.player.on('stateChange', (oldState: AudioPlayerState, newState: AudioPlayerState) => {
      if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
        if (this.queue[0]) this.makeAudioResource()
      }
    });
    this.player.on('error', error => {
      console.error(`Error: ${error.message} with resource ${error.resource.metadata}`);
      this.makeAudioResource()
    });

  }

  public async play(prompt: string, voiceChannel: VoiceBasedChannel): Promise<string> {
    console.log('Зажигаю...', prompt)
    try {
      this.connection(voiceChannel)
      await this.promptParse(prompt)
      if (this.player.state.status === AudioPlayerStatus.Idle) {
        await this.makeAudioResource()
      }
      return 'placeholder'
    } catch (error) {
      throw error
    }
  }

  public clearQueue() {
    this.queue = []
  }
  public renderQueue() {
    return `
      ${this.queue.map((item, i) => {
        return `${i++} [${item.title}](<${item.url}>)`
      }).join('\n')}
    `
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
          maxResults: 10
        })
        data.items.forEach(item => {
          this.queue.push({ url: `https://youtu.be/${item.snippet.resourceId.videoId}`, title: item.snippet.title })
        })
      } else return await this.getTrackInfo(url.href)
    } else {
      // нету урла, поиск по промпту
    }
  }

  private async getTrackInfo(href: string) {
    try {
      const { videoDetails }: ytdl.videoInfo = await ytdl.getBasicInfo(href)
      this.queue.push({url: videoDetails.video_url, title: videoDetails.title});
    } catch (error) {
      throw error
    }
  }

  private makeAudioResource (): Promise<AudioResource> {
    return new Promise(async (resolve, reject) => {
      const track: Track = this.queue.shift()
      const ytdlStream = ytdl(track.url, { filter: 'audioonly' })
      const resource: AudioResource = createAudioResource(ytdlStream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true,
      });
      ytdlStream.on('error', err => reject(err));
      this.player.play(resource)
      resolve(resource)
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
      this.voiceConnection.destroy();
      this.queue = []
      this.playList = ''
      this.disconTimer = null
      this.voiceConnection = null
    }, (2 * 60) * 1000);
    else {
      clearTimeout(this.disconTimer)
      this.disconTimer = null
    }
  };
}