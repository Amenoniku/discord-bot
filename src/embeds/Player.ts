import { APIEmbedField, EmbedBuilder } from 'discord.js'

interface EmbedPlayerInterface {
  updatePlayer(track: Track, list: Track[], customer: Customer): void
}

export class EmbedPlayer implements EmbedPlayerInterface {
  private customer: Customer
  private shownTracks: number = 3
  private embedBuilder: EmbedBuilder
  constructor () {
    this.embedBuilder = new EmbedBuilder({color: 0xffc300})
  }
  public get embed(): EmbedBuilder {
    return this.embedBuilder
  }
  private makeDuration(duration) {
    return duration ? (duration / 60).toFixed(2).replace('.', ':') : '-:--'
  }
  private setTrack(track) {
    this.embedBuilder.setTitle(`${track.title}  ${this.makeDuration(track.duration)}`)
    this.embedBuilder.setURL(track.url)
    this.embedBuilder.setThumbnail(track.thumbnail)
    this.embedBuilder.setAuthor({ name: `${this.customer?.name || 'хуй знает кто'} заказал:`, iconURL: this.customer?.icon })
  }
  private makeMappedList(list: Track[], isLast: boolean) {
    return list.map((track: Track, i) => {
      let itemString: string = `${i + (
        isLast
          ? (list.length - this.shownTracks) + 1
          : 1
      )}.`
      return `${itemString} [${track.title}](<${track.url}>)  ${this.makeDuration(track.duration)}. ${this.customer.name}`
    }).join('\n')
  }
  private setList(list) {
    const limit = (this.shownTracks * 2);
    let mappedList = ''
    if (list.length > limit) {
      const firstChunk = list.slice(0, this.shownTracks);
      const lastChunk = list.slice(-this.shownTracks);
      mappedList = `${this.makeMappedList(firstChunk, false)}\n...\n${this.makeMappedList(lastChunk, true)}`
    } else {
      mappedList = this.makeMappedList(list, false)
    }
    const fields: APIEmbedField[] = [
      { name: 'Плэйлист', value: mappedList }
    ];
    this.embedBuilder.addFields(fields)
  }
  /**
   * updatePlayer
   */
  public updatePlayer(track: Track = null, list: Track[] = [], customer: Customer): void {
    this.customer = customer
    this.setTrack(track)
    this.embedBuilder.spliceFields(0, 1)
    if (list.length) this.setList(list)
  }
}
