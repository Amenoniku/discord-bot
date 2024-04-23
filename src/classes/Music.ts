import * as ytdl from 'ytdl-core';
import type { VoiceBasedChannel, Client, VoiceState, GuildBasedChannel } from "discord.js"
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


interface MusicInterface {
  player: AudioPlayer
  play(prompt: string, voiceChannel: VoiceBasedChannel): Promise<string>
}

type Track = ytdl.MoreVideoDetails

export class Music implements MusicInterface {

  public player: AudioPlayer
  private voiceConnection: VoiceConnection
  private voiceChannel: VoiceBasedChannel
  private queue: Track[] = []
  private playList: string = ''
  private disconTimer = null

  constructor(private client: Client) {
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
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

    this.client.on('voiceStateUpdate', this.voiceStateUpdateHandler);
  }

  public async play(prompt: string, voiceChannel: VoiceBasedChannel): Promise<string> {
    console.log('Зажигаю...', prompt)
    try {
      this.connection(voiceChannel)
      const track: Track = await this.getTrackInfo(prompt)
      if (this.player.state.status === AudioPlayerStatus.Idle) {
        await this.makeAudioResource()
      }
      return track.title
    } catch (error) {
      throw error
    }
  }

  private async getTrackInfo(prompt): Promise<Track> {
    try {
      const info: ytdl.videoInfo = await ytdl.getBasicInfo(prompt)
      this.queue.push(info.videoDetails);
      return info.videoDetails
    } catch (error) {
      throw error
    }
  }

  private makeAudioResource (): Promise<AudioResource> {
    return new Promise(async (resolve, reject) => {
      const track: Track = this.queue.shift()
      const ytdlStream = ytdl(track.video_url, { filter: 'audioonly' })
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
  private disconnection() {
    this.voiceConnection.destroy();
  }
  private voiceStateUpdateHandler = (oldState: VoiceState, newState: VoiceState) => {
    const currentChannelId = this.voiceConnection?.joinConfig.channelId
    if (!currentChannelId) return
    if (this.voiceChannel.members.size === 1 && this.disconTimer === null) this.disconTimer = setTimeout(() => {
        this.disconnection()
        this.queue = []
        this.playList = ''
        this.disconTimer = null
      }, (2 * 60) * 1000);
    else {
      clearTimeout(this.disconTimer)
      this.disconTimer = null
    }
  };
}