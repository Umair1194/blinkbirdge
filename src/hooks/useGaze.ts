import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { gazeService, trackingStatusOf } from '../engine/gazeService'
import { dwell } from '../lib/dwell'

export function useGazeState() {
  return useSyncExternalStore(gazeService.subscribe, gazeService.getState)
}

export function useTrackingStatus() {
  return trackingStatusOf(useGazeState())
}

interface GazeTargetOptions {
  disabled?: boolean
  allowWhenPaused?: boolean
  dwellScale?: number
  /** Confirmed selections of this target help the gaze model learn (keys, word suggestions). */
  learn?: boolean
}

/** Registers an element as a dwell-selectable target and returns its live state. */
export function useGazeTarget(id: string, onSelect: () => void, opts: GazeTargetOptions = {}) {
  const handler = useRef(onSelect)
  useEffect(() => {
    handler.current = onSelect
  })
  const { disabled, allowWhenPaused, dwellScale } = opts
  useEffect(() => {
    if (disabled) return
    return dwell.register(id, { onSelect: () => handler.current(), allowWhenPaused, dwellScale })
  }, [id, disabled, allowWhenPaused, dwellScale])

  const state = useSyncExternalStore(dwell.subscribe, () => dwell.stateFor(id))
  const [selected, setSelected] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const off = dwell.onSelected((sid) => {
      if (sid !== id) return
      setSelected(true)
      clearTimeout(t)
      t = setTimeout(() => setSelected(false), 360)
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [id])

  return {
    progress: disabled ? 0 : Math.max(0, state),
    hovered: !disabled && state >= 0,
    selected,
    targetProps: {
      'data-gaze-id': id,
      'data-gaze-disabled': disabled ? 'true' : undefined,
      'data-gaze-learn': opts.learn ? 'true' : undefined,
    },
  }
}
