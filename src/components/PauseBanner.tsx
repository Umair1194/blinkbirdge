import { Play } from 'lucide-react'
import { gazeService } from '../engine/gazeService'
import { useGazeState } from '../hooks/useGaze'
import { GazeButton } from './GazeButton'
export function PauseBanner(){
 const state=useGazeState()
 if(!state.paused)return null
 return <section role="status" className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"><div><h2 className="font-semibold text-ink">Tracking paused</h2><p className="text-sm text-ink-2">{state.pausedKeepsGaze?'Look at Resume when you are ready to continue.':'Select Resume to restart tracking.'}</p></div><GazeButton gazeId="pause-resume" allowWhenPaused icon={Play} variant="primary" onActivate={()=>gazeService.resumeTracking()}>Resume</GazeButton></section>
}
