import { ArrowLeft, ArrowRight, Eye, Keyboard, Pause, Volume2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../state/AppStore'
import { GazeButton } from './GazeButton'
import { Modal, buttonClass } from './ui'
const STEPS=[
 {icon:Eye,title:'Look to focus',body:'Keep your head in a comfortable position and move your eyes toward a target. The cursor estimates where you are looking.'},
 {icon:Keyboard,title:'Hold to select',body:'A steady look fills the ring around a key. Look away to cancel. After selecting a key, look away before selecting it again.'},
 {icon:Eye,title:'Choose the exact letter',body:'Precision confirmation opens nearby letters as larger targets. Look at the exact letter to type it. More letters shows the rest of the alphabet.'},
 {icon:Pause,title:'Pause whenever you need',body:'Use Pause tracking to rest. With resume-by-looking enabled, look at Resume when you are ready. Alt + P also pauses or resumes.'},
 {icon:Volume2,title:'Speak your message',body:'Select Speak to hear your message. Stop cancels speech. Your device supplies the available voices.'},
]
export function QuickGuide({open,onClose}:{open:boolean;onClose:()=>void}){
 const {settings}=useApp();const [step,setStep]=useState(0)
 useEffect(()=>{if(open)setStep(0)},[open])
 useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='ArrowRight'){event.preventDefault();setStep(value=>Math.min(STEPS.length-1,value+1))}if(event.key==='ArrowLeft'){event.preventDefault();setStep(value=>Math.max(0,value-1))}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open])
 const current=STEPS[step],Icon=current.icon,last=step===STEPS.length-1
 return <Modal open={open} onClose={onClose} title="Quick guide"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-brand">Step {step+1} of {STEPS.length}</p><button className={buttonClass('ghost','sm')} aria-label="Close quick guide" onClick={onClose}><X className="size-5"/></button></div><div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl bg-brand-soft"><Icon className="size-16 text-brand" aria-hidden/></div><h3 className="mt-5 text-2xl font-bold" aria-live="polite">{current.title}</h3><p className="mt-3 leading-relaxed text-ink-2">{current.body}</p>{step===1&&<p className="mt-2 text-sm text-ink-2">Your hold time is {(settings.dwellMs/1000).toFixed(1)} seconds, after the gaze settles.</p>}<div className="mt-6 flex flex-wrap justify-between gap-3"><GazeButton gazeId="guide-back" icon={ArrowLeft} disabled={step===0} onActivate={()=>setStep(value=>Math.max(0,value-1))}>Back</GazeButton><GazeButton gazeId="guide-next" variant="primary" icon={last?Keyboard:ArrowRight} onActivate={()=>last?onClose():setStep(value=>value+1)}>{last?'Start typing':'Next'}</GazeButton></div></Modal>
}
