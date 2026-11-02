/** Small, conservative list of common typos and contractions. */
const CORRECTIONS: Record<string, string> = {
  i: 'I',
  im: "I'm",
  ive: "I've",
  id: "I'd",
  ill: "I'll",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  wasnt: "wasn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  shouldnt: "shouldn't",
  thats: "that's",
  whats: "what's",
  youre: "you're",
  theyre: "they're",
  teh: 'the',
  adn: 'and',
  taht: 'that',
  thier: 'their',
  recieve: 'receive',
  wierd: 'weird',
  becuase: 'because',
  beacuse: 'because',
  freind: 'friend',
  untill: 'until',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  definately: 'definitely',
  seperate: 'separate',
  wich: 'which',
  waht: 'what',
  hte: 'the',
  knwo: 'know',
  plz: 'please',
  pls: 'please',
  thx: 'thanks',
}

/** Returns a corrected version of the last word in `text`, or null. */
export function correctLastWord(text: string): { from: string; to: string; text: string } | null {
  const m = text.match(/([A-Za-z']+)$/)
  if (!m) return null
  const word = m[1]
  const fix = CORRECTIONS[word.toLowerCase()]
  if (!fix) return null
  const capital = word[0] === word[0].toUpperCase()
  const to = capital && !fix.startsWith('I') ? fix[0].toUpperCase() + fix.slice(1) : fix
  if (to === word) return null
  return { from: word, to, text: text.slice(0, -word.length) + to }
}
