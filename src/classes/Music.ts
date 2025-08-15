require("dotenv").config();
import { createWriteStream, createReadStream } from "fs";
import { readdir, unlink } from "node:fs/promises";
import { join } from "path";
import ytdl from "@distube/ytdl-core";
import type {
  VoiceBasedChannel,
  Client,
  TextChannel,
  Message,
  GuildMember,
} from "discord.js";
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
} from "@discordjs/voice";
import { google, youtube_v3 } from "googleapis";

import { EmbedPlayer } from "../embeds/Player";
import { xTrim } from "../utils";

interface MusicInterface {
  player: AudioPlayer;
  skip(): void;
  clearQueue(): void;
  renderQueue(): void;
  play(
    prompt: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextChannel,
    member: GuildMember,
  ): Promise<void>;
}

type Error<T> = {
  message: T;
  [key: string]: T;
};

export class Music implements MusicInterface {
  private ytapi: youtube_v3.Youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_TOKEN,
  });

  private textChannel: TextChannel;
  private voiceConnection: VoiceConnection = null;
  private voiceChannel: VoiceBasedChannel;
  private disconTimer = null;

  public player: AudioPlayer;
  private playerMessage: Message = null;
  private reactButtons: ReactButton[] = [];
  private embedPlayer: EmbedPlayer;
  private queue: Track[] = [];
  private currentTrack: Track;
  private customer: Customer;
  private forceAdded: boolean;

  constructor(private client: Client) {
    this.embedPlayer = new EmbedPlayer();
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    this.reactButtons = [
      {
        action: () => {
          this.player[
            this.player.state.status === AudioPlayerStatus.Paused
              ? "unpause"
              : "pause"
          ]();
        },
        emoji: "⏯️",
      },
      {
        action: () => {
          this.playerMessage.reactions.removeAll();
          const nextTrack = this.queue[0];
          this.textChannel.send(`
          ${this.skip()}.${
            nextTrack
              ? `\nИду по нексилю, гружу [${nextTrack.title}](<${nextTrack.url}>)...`
              : "А все, музыка кончилась"
          }
        `);
        },
        emoji: "⏩",
      },
      {
        action: () => {
          this.textChannel.send("Все, дискотека окончена!");
          this.player.stop();
          this.clearQueue();
        },
        emoji: "⏹️",
      },
    ];
    this.player.on(
      "stateChange",
      async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
        if (
          oldState.status === AudioPlayerStatus.Playing &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          this.playing();
        }
      },
    );
    this.player.on("error", (error) => {
      console.error(
        `Error: ${error.message} with resource ${error.resource.metadata}`,
      );
      this.playing();
    });

    this.client.on("voiceStateUpdate", this.voiceStateUpdateHandler);
    this.client.on("messageReactionAdd", async (reaction, user) => {
      const { emoji, message } = reaction;
      if (user.bot || message.id !== this.playerMessage.id) return;
      const btn = this.reactButtons.find((btn) => btn.emoji === emoji.name);
      btn.action.call(this);
      reaction.users.remove(user.id);
    });
  }

  public async play(
    prompt: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextChannel,
    member: GuildMember,
  ): Promise<void> {
    if (!prompt.trim())
      throw "Ты, другалек, нечего не написал... Чё мне играть то?";
    console.log(`${member.displayName} заказал: ${prompt}`);
    if (/-ф$/.test(prompt)) {
      prompt = xTrim(prompt, "-ф");
      this.forceAdded = true;
    } else this.forceAdded = false;
    this.customer = { name: member.displayName, icon: member.user.avatarURL() };
    try {
      this.connection(voiceChannel);
      this.textChannel = textChannel;
      await this.promptParse(prompt);
      if (this.currentTrack) await this.renderQueue();
      if (this.player.state.status === AudioPlayerStatus.Idle)
        await this.playing();
    } catch (error) {
      throw error;
    }
  }

  public skip() {
    if (this.currentTrack === null) return "Нечего скипать";
    const track: string = `Скипнул трек: [${this.currentTrack.title}](<${this.currentTrack.url}>)`;
    this.player.stop();
    return track;
  }

  private addQueue(track: Track) {
    const maxQueue = 200;
    if (this.queue.length + 1 < maxQueue)
      this.queue[this.forceAdded ? "unshift" : "push"]({
        ...track,
        customer: this.customer,
      });
    else throw `Больше ${maxQueue} треков низя!`;
  }

  public clearQueue() {
    this.queue = [];
  }

  public async renderQueue(): Promise<void> {
    if (this.playerMessage) {
      this.playerMessage.delete();
      this.playerMessage = null;
    }
    this.embedPlayer.updatePlayer(this.currentTrack, this.queue);
    this.playerMessage = await this.textChannel.send({
      embeds: [this.embedPlayer.embed],
    });
    this.reactButtons.forEach((btn) => this.playerMessage.react(btn.emoji));
  }

  private async promptParse(prompt: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(prompt);
    } catch (e) {
      url = null;
    }
    try {
      if (url) {
        const query: URLSearchParams = url.searchParams;
        if (query.has("list")) {
          await this.getYtList(query.get("list"));
        } else await this.getTrackInfo(url.href);
      } else {
        if (/--лист$/.test(prompt)) {
          const { data } = await this.ytapi.search.list({
            part: ["snippet"],
            q: xTrim(prompt, "--лист"),
            maxResults: 1,
            safeSearch: "strict",
            type: ["playlist"],
          });
          if (data.items[0]) await this.getYtList(data.items[0].id.playlistId);
          else throw "Нету плэйлиста";
        } else await this.getYtTrack(prompt);
      }
    } catch (error) {
      throw error.message ? this.getYtdlError(prompt, error) : error;
    }
  }

  private async getYtTrack(q: string): Promise<void> {
    const { data } = await this.ytapi.search.list({
      part: ["snippet"],
      q,
      maxResults: 1,
      safeSearch: "strict",
      type: ["video"],
      videoCategoryId: "10",
      videoSyndicated: "true",
    });
    let errCount = 0;
    for (const item of data.items) {
      if (!item.id?.videoId) continue;
      try {
        const videoDetails = await this.getTrackInfo(item.id.videoId);
        if (errCount)
          await this.textChannel.send(
            `После ${errCount} попыток скачать трек, счакалось это [${videoDetails.title}](<${videoDetails.video_url}>)`,
          );
        break;
      } catch (error) {
        errCount++;
      }
    }
  }
  private async getYtList(id: string): Promise<void> {
    try {
      const { data } = await this.ytapi.playlistItems.list({
        part: ["snippet"],
        playlistId: id,
        maxResults: 50,
      });
      data.items.forEach((item) => {
        this.addQueue({
          url: `https://youtu.be/${item.snippet.resourceId.videoId}`,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url,
          duration: item.contentDetails?.endAt,
        });
      });
    } catch (error) {
      throw error;
    }
  }

  private getYtdlError(prompt: string, reason: Error<string>): string {
    return `Ютуб не дает скачать <${prompt}>, можешь [поискать](<https://www.youtube.com/results?search_query=${encodeURIComponent(
      prompt,
    )}>) другую версию. Причина: ${reason.message || reason}`;
  }

  private async getTrackInfo(href: string): Promise<ytdl.MoreVideoDetails> {
    try {
      const { videoDetails }: ytdl.videoInfo = await ytdl.getBasicInfo(href);
      this.addQueue({
        url: videoDetails.video_url,
        title: videoDetails.title,
        thumbnail: videoDetails.thumbnails[0].url,
        duration: videoDetails.lengthSeconds,
      });
      return videoDetails;
    } catch (error) {
      throw error;
    }
  }

  private async playing(): Promise<AudioResource> {
    if (this.queue[0]) {
      for (const file of await readdir("resources")) {
        await unlink(join("resources/", file));
      }
      try {
        return await this.makeAudioResource();
      } catch (error) {
        await this.textChannel.send(
          this.getYtdlError(this.currentTrack?.title, error),
        );
        await this.playing();
      }
    } else if (this.queue.length === 0 && this.playerMessage) {
      await this.playerMessage.delete();
      this.currentTrack = null;
      this.playerMessage = null;
    }
  }

  private makeAudioResource(): Promise<AudioResource> {
    return new Promise(async (resolve, reject) => {
      try {
        this.currentTrack = this.queue.shift();
        if (!this.currentTrack) return reject("Нету трека");
        const fileName = `resources/${`${Math.random()}`.replace(
          "0.",
          "",
        )}.webm`;
        const ytdlStream = ytdl(this.currentTrack.url.trim(), {
          filter: "audioonly",
        });
        ytdlStream.pipe(createWriteStream(fileName));
        ytdlStream.on("finish", () => {
          const resource: AudioResource = createAudioResource(
            createReadStream(fileName),
            {
              inputType: StreamType.WebmOpus,
              inlineVolume: true,
            },
          );
          this.player.play(resource);
          this.renderQueue();
          resolve(resource);
        });
        ytdlStream.on("error", (err) => reject(err));
      } catch (err) {
        throw err;
      }
    });
  }

  private connection(voiceChannel: VoiceBasedChannel) {
    if (!voiceChannel)
      throw "Ты ебанько? И куда я играть буду?! Го в голос и давай по новой!";
    else if (this.voiceConnection?.joinConfig.channelId === voiceChannel?.id)
      return;
    this.voiceChannel = voiceChannel;
    this.voiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    this.voiceConnection.subscribe(this.player);
  }
  private voiceStateUpdateHandler = () => {
    if (!this.voiceConnection) return;
    if (this.voiceChannel.members.size === 1 && this.disconTimer === null)
      this.disconTimer = setTimeout(
        () => {
          this.player.stop();
          this.voiceConnection.destroy();
          this.queue = [];
          this.disconTimer = null;
          this.voiceConnection = null;
          if (this.playerMessage) {
            this.playerMessage.delete();
            this.currentTrack = null;
            this.playerMessage = null;
          }
        },
        2 * 60 * 1000,
      );
    else {
      clearTimeout(this.disconTimer);
      this.disconTimer = null;
    }
  };
}
