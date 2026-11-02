import { useCallback, useState } from "react"
import { buildLayout, type KeyDef } from "../lib/keyboardLayouts"
import type { Settings } from "../lib/settings"
import { KeyboardKey } from "./KeyboardKey"
import { cx } from "./ui"

export interface KeyboardHandlers {
  onChar: (c: string) => void
  onShift: () => void
  onBackspace: () => void
  onSpace: () => void
  onEnter: () => void
  onClear: () => void
}

interface Props extends KeyboardHandlers {
  scope: string
  settings: Pick<Settings, "keySize" | "keySpacing" | "layout">
  shift: boolean
  upperNext: boolean
  dimmed?: boolean
  onGazeChar?: (def: KeyDef) => void
}

/** Preferred key height per size; rows only shrink below this (never under 3.5rem) when space is short. */
const ROW_HEIGHT_REM: Record<Settings["keySize"], number> = {
  small: 4,
  medium: 5,
  large: 6,
}

const GAP_REM: Record<Settings["keySpacing"], number> = {
  compact: 0.375,
  comfortable: 0.625,
  spacious: 1,
}

/** Smallest height the keyboard may shrink to: four rows of 3.5rem keys plus gaps. */
export function keyboardMinHeight(spacing: Settings["keySpacing"]) {
  return `calc(4 * 3.5rem + 3 * ${GAP_REM[spacing]}rem)`
}

const GAP: Record<Settings["keySpacing"], string> = {
  compact: "gap-1.5",
  comfortable: "gap-2.5",
  spacious: "gap-4",
}

export function VirtualKeyboard({
  scope,
  settings,
  shift,
  upperNext,
  dimmed,
  onChar,
  onShift,
  onBackspace,
  onSpace,
  onEnter,
  onClear,
  onGazeChar,
}: Props) {
  const [mode, setMode] = useState<"letters" | "symbols">("letters")
  const rows = buildLayout(mode, settings.layout)

  const press = useCallback(
    (def: KeyDef) => {
      const a = def.action
      switch (a.type) {
        case "char":
          return onChar(a.value)
        case "shift":
          return onShift()
        case "backspace":
          return onBackspace()
        case "space":
          return onSpace()
        case "enter":
          return onEnter()
        case "clear":
          return onClear()
        case "mode":
          return setMode(a.to)
      }
    },
    [onChar, onShift, onBackspace, onSpace, onEnter, onClear],
  )

  const gap = GAP[settings.keySpacing]
  return (
    <div
      role="group"
      aria-label={
        mode === "letters" ? "Letter keyboard" : "Numbers and symbols keyboard"
      }
      className={cx("virtual-keyboard flex min-h-0 flex-1 flex-col", gap)}
    >
      {rows.map((row, i) => {
        const units = row.reduce((n, k) => n + (k.grow ?? 1), 0)
        const pad = Math.max(0, (10 - units) / 2)
        return (
          <div
            key={`${mode}-${i}`}
            className={cx("flex", gap)}
            style={{
              flex: `0 1 ${ROW_HEIGHT_REM[settings.keySize]}rem`,
              minHeight: "3.5rem",
            }}
          >
            {pad > 0 && (
              <span aria-hidden style={{ flexGrow: pad, flexBasis: 0 }} />
            )}
            {row.map((def) => {
              const isLetter =
                def.action.type === "char" && /[a-z]/.test(def.action.value)
              const label = isLetter
                ? upperNext
                  ? def.label.toUpperCase()
                  : def.label.toLowerCase()
                : def.label
              return (
                <KeyboardKey
                  key={def.id}
                  def={def}
                  label={label}
                  scope={scope}
                  size={settings.keySize}
                  active={def.id === "k-shift" && shift && !def.disabled}
                  dimmed={dimmed}
                  onPress={press}
                  onGazePress={onGazeChar && def.action.type === 'char' && /[a-z]/i.test(def.action.value) ? onGazeChar : undefined}
                />
              )
            })}
            {pad > 0 && (
              <span aria-hidden style={{ flexGrow: pad, flexBasis: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
