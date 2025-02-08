type Track = {
  url: string
  title: string,
  duration?: string,
  thumbnail? : string
  customer?: Customer
}

type Customer = {
  name: string,
  icon?: string
}

type ReactButton = {
  action(): void,
  emoji: EmojiResolvable
}
