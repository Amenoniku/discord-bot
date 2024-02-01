export function xTrim(str: string, word: string = ''): string {
  return str.replace(word, '').trim()
}

export function cutMessage(message: string = '', maxLength: number): string[] {
  const arrayStrings = [];
  const numPieces = Math.ceil(message.length / maxLength);
  for (let i = 0; i < numPieces; i++) {
    const start = i * maxLength;
    const end = start + maxLength;
    const piece = message.substring(start, end);
    arrayStrings.push(piece);
  }
  return arrayStrings;
}