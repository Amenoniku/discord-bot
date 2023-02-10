import { client } from "./Discord";

interface BotInterface {

}

export class Bot implements BotInterface {
  private context: string[] = []
  constructor() {
    client.on('ready', () => {
      console.log(`Logged in as ${client.user.tag}!`)
      // const channel = client.channels.cache.find(ch => ch.id == '436386682594525184')
      // channel.send('Усак на связи!')
    })
    // client.on('messageCreate', ()  => {})
  }
}

