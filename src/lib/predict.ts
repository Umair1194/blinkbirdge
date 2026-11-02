import { NEXT_WORDS, WORDS } from "./words"

const RANK = new Map<string, number>()
WORDS.forEach((w, i) => {
  if (!RANK.has(w)) RANK.set(w, i)
})

/** Words the user has typed this session or saved in phrases get a boost. */
const learned = new Map<string, number>()

export function clearLearnedWords() {
  learned.clear()
}

export function learnWords(text: string) {
  for (const w of text.toLowerCase().match(/[a-z']{2,}/g) ?? []) {
    learned.set(w, (learned.get(w) ?? 0) + 1)
  }
}

export function currentPartial(text: string) {
  return text.match(/[A-Za-z']+$/)?.[0] ?? ""
}

export function previousWord(text: string) {
  const before = text.slice(0, text.length - currentPartial(text).length)
  if (/[.!?\n]\s*$/.test(before) || before.trim() === "") return ""
  return before.match(/([A-Za-z']+)\s*$/)?.[1]?.toLowerCase() ?? ""
}

function score(word: string) {
  const rank = RANK.get(word) ?? 2000
  const boost = learned.get(word) ?? 0
  return rank - boost * 150
}

/**
 * Local, deterministic prediction: completes the unfinished word by prefix
 * (frequency + personal usage), or suggests likely next words after a space.
 */
export function suggest(text: string, limit = 5): string[] {
  const partial = currentPartial(text).toLowerCase()
  if (!partial) {
    const prev = previousWord(text)
    const next = NEXT_WORDS[prev] ?? []
    const fill = prev ? WORDS.slice(0, 40) : (NEXT_WORDS[""] ?? [])
    return dedupe([...next, ...fill]).slice(0, limit)
  }
  const candidates = new Set<string>()
  for (const w of [...RANK.keys(), ...learned.keys()]) {
    if (w.startsWith(partial) && w !== partial) candidates.add(w)
  }
  const ranked = [...candidates].sort(
    (a, b) => score(a) - score(b) || a.length - b.length,
  )
  // Offer the exact word too if it's a known word, so users can confirm it.
  if (RANK.has(partial) || learned.has(partial)) ranked.unshift(partial)
  return dedupe(ranked).slice(0, limit)
}

function dedupe(list: string[]) {
  const seen = new Set<string>()
  return list.filter((w) => {
    const k = w.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
