import type { Settings } from './settings'

export function isSentenceStart(text: string) {
  return text.trim() === '' || /[.!?]\s+$/.test(text) || /\n$/.test(text)
}

/** Whether the next typed letter will be uppercase. */
export function nextIsUpper(text: string, letterCase: Settings['letterCase'], shift: boolean) {
  const base = letterCase === 'upper' ? true : letterCase === 'lower' ? false : isSentenceStart(text)
  return shift ? !base : base
}

export function applyCase(word: string, upperFirst: boolean, letterCase: Settings['letterCase']) {
  if (letterCase === 'upper') return word.toUpperCase()
  if (word === 'i' || word.startsWith("i'")) return 'I' + word.slice(1)
  return upperFirst ? word[0].toUpperCase() + word.slice(1) : word
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}
