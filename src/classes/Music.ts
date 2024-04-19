import { createReadStream } from "fs";
import { join } from "path";
import type { Client, VoiceBasedChannel } from "discord.js"
import {
  joinVoiceChannel,
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
  StreamType,
  createAudioResource,
  AudioResource,
  generateDependencyReport,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from "@discordjs/voice"

interface MusicInterface {
  player: AudioPlayer
  play(prompt: string, voiceChannel: VoiceBasedChannel): void
}

export class Music implements MusicInterface {

  private voiceChannel: VoiceBasedChannel
  private voiceConnection: VoiceConnection
  public player: AudioPlayer
  private resource: AudioResource

  constructor(private client: Client) {
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    this.player.on(AudioPlayerStatus.Idle, () => {
      console.log('idle!');
    });
    this.player.on(AudioPlayerStatus.Buffering, () => {
      console.log('Buffering!');
    });
    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      console.log('AutoPaused!');
    });
    this.player.on(AudioPlayerStatus.Paused, () => {
      console.log('Paused!');
    });
    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log('The audio player has started playing!');
    });
    this.player.on('error', error => {
      console.error(`Error: ${error.message} with resource ${error.resource.metadata}`);
      // this.player.play(getNextResource());
    });
  }

  public async play(prompt: string, voiceChannel: VoiceBasedChannel) {
    console.log('Зажигаю...', prompt)
    this.resource = createAudioResource(join(__dirname, 'test.mp3'));
    this.voiceChannel = voiceChannel
    try {
      this.connection()
      this.voiceConnection.subscribe(this.player)
      this.player.play(this.resource)
    } catch (error) {
      throw error
    }
  }

  private connection() {
    if (!this.voiceChannel) throw 'Ты ебанько? И куда я играть буду?! Го в голос и давай по новой!'
    this.voiceConnection = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.voiceChannel.guild.id,
      adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
    });
  }
  private disconnection() {
    this.voiceConnection.destroy();
  }
}