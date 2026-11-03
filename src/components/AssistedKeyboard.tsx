import { useEffect, useRef, useState } from 'react'
import { gazeService } from '../engine/gazeService'
import { useGazeState } from '../hooks/useGaze'
import { dwell } from '../lib/dwell'
import { navigate } from '../lib/router'
import { useApp } from '../state/AppStore'
import { GazeButton } from './GazeButton'
import { buttonClass } from './ui'

const SYMBOLS = [...'abcdefghijklmnopqrstuvwxyz', 'Space', 'Delete', 'Speak', 'Undo', '.', '?']
const label = (items:string[]) => {
  if(items.length===1)return items[0].toUpperCase()
  if(items.every(value=>/^[a-z]$/.test(value)))return `${items[0].toUpperCase()} – ${items[items.length-1].toUpperCase()}`
  if(/^[a-z]$/.test(items[0]))return `${items[0].toUpperCase()} – Z + actions`
  return 'Actions & punctuation'
}

/** A coarse gaze estimate chooses between two screen-sized groups, not tiny keys.
 * Looking away between steps prevents a resting gaze from descending the tree. */
export function AssistedKeyboard() {
  const {text,composer,speakText,notify} = useApp()
  const state = useGazeState()
  const [items,setItems] = useState(SYMBOLS)
  const [step,setStep] = useState(0)
  const [armed,setArmed] = useState(false)
  const [vertical,setVertical] = useState(false)
  const [fits,setFits] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const error = state.calibration?.fit?.cvErrorPx ?? 200
  useEffect(()=>{
    const node=container.current
    if(!node)return
    const measure=()=>{
      const r=node.getBoundingClientRect(),columns=Math.min((r.width-20)/2,r.height),rows=Math.min(r.width,(r.height-20)/2)
      setVertical(rows>columns)
      setFits(Math.max(columns,rows)>=error*1.8+24)
    }
    const observer=new ResizeObserver(measure);observer.observe(node);measure()
    return()=>observer.disconnect()
  },[error])
  useEffect(()=>{
    dwell.reset();setArmed(false)
    let anchor=gazeService.getGazeCoordinates(),since:number|null=null
    const timer=setInterval(()=>{
      const point=gazeService.getGazeCoordinates()
      if(!point){since=null;return}
      if(!anchor){anchor=point;return}
      const moved=Math.hypot((point.x-anchor.x)*innerWidth,(point.y-anchor.y)*innerHeight)>100
      if(!moved){since=null;return}
      since??=performance.now()
      if(performance.now()-since>=200){setArmed(true);clearInterval(timer)}
    },50)
    return()=>{clearInterval(timer);dwell.reset()}
  },[step])
  const choose=(group:string[])=>{
    dwell.reset();setArmed(false)
    if(group.length===1){
      const value=group[0]
      if(value==='Space')composer.space()
      else if(value==='Delete')composer.backspace()
      else if(value==='Undo')composer.undo()
      else if(value==='Speak')speakText(text)
      else composer.typeChar(value)
      setItems(SYMBOLS)
    }else setItems(group)
    setStep(value=>value+1)
  }
  const middle=Math.ceil(items.length/2)
  const groups=[items.slice(0,middle),items.slice(middle)]
  return <section data-gaze-scope="assisted" data-assisted-step={step} aria-label="Large-target assisted keyboard" className="fixed inset-0 z-50 flex h-dvh min-h-0 flex-col gap-4 overflow-y-auto bg-canvas p-4 sm:p-6">
    <header className="flex shrink-0 flex-wrap items-center gap-3">
      <h1 className="mr-auto text-xl font-bold text-ink">Large-target gaze typing</h1>
      <button type="button" className={buttonClass('secondary','sm')} onClick={()=>{setItems(SYMBOLS);setStep(value=>value+1)}}>Restart choices</button>
      <button type="button" className={buttonClass('secondary','sm')} onClick={()=>navigate('calibrate')}>Recalibrate</button>
      <button type="button" className={buttonClass('secondary','sm')} onClick={()=>{gazeService.resetCalibration();notify('Switched to clicking and physical typing')}}>Use clicks</button>
    </header>
    <div role="textbox" aria-readonly="true" aria-label="Your message" className="max-h-28 shrink-0 overflow-y-auto break-words rounded-2xl border border-line bg-surface p-4 text-2xl text-ink">{text || 'Your message will appear here'}</div>
    <p aria-live="polite" className="shrink-0 text-center text-base font-medium text-ink-2">{!fits?'This window is too small for your tracking estimate. Enlarge the window or use clicks.':!armed?'Look at the centre, then move to your choice.':'Look at the group containing your letter until its ring fills.'} {state.paused?'Tracking is paused.':''}</p>
    <div ref={container} className={`flex min-h-[260px] flex-1 gap-5 ${vertical?'flex-col':'flex-row'}`}>
      {groups.map((group,index)=><GazeButton key={`${step}-${index}`} gazeId={`assisted-${step}-${index}`} data-gaze-assisted="true" data-assisted-values={JSON.stringify(group)} gazeDisabled={!armed||!fits} variant="secondary" dwellScale={1.25} className="h-auto min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5" onActivate={()=>choose(group)}>
        <span className="block text-[clamp(1.4rem,4vw,3.5rem)] font-bold">{label(group)}</span>
        {group.length>1&&<span className="mt-4 block max-w-full break-words text-lg">{group.join(' · ').toUpperCase()}</span>}
      </GazeButton>)}
    </div>
    <p className="shrink-0 text-center text-sm text-ink-2">Assisted mode uses large groups because small-key tracking is uncertain. Space, Delete, Speak and Undo are included in the choices.</p>
  </section>
}
