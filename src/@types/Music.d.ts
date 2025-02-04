type Track = {
  url: string
  title: string,
  duration?: string,
  thumbnail? : string
}

type Customer = {
  name: string,
  icon?: string
}

type ReactButton = {
  action(): void,
  emoji: EmojiResolvable
}