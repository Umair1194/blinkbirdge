import { BookOpen, Camera, Eye, Keyboard, MessageSquareText, RotateCcw, ShieldCheck, Sparkles, Trash2, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { gazeService } from '../engine/gazeService'
import { useGazeState } from '../hooks/useGaze'
import { clearAll } from '../lib/storage'
import { DWELL_OPTIONS, type Settings } from '../lib/settings'
import { navigate } from '../lib/router'
import { useApp } from '../state/AppStore'
import { RateSlider, VoiceSelect } from './SpeechControls'
import { Modal, Segmented, SettingRow, Toggle, buttonClass } from './ui'

export const SETTINGS_SECTIONS: {id:string;label:string;icon:LucideIcon}[] = [
 {id:'eye-tracking',label:'Eye tracking',icon:Eye}, {id:'keyboard',label:'Keyboard',icon:Keyboard},
 {id:'communication',label:'Communication',icon:MessageSquareText}, {id:'comfort',label:'Comfort',icon:Sparkles}, {id:'privacy',label:'Privacy',icon:ShieldCheck},
]
const cap=(value:string)=>value[0].toUpperCase()+value.slice(1)
export function Section({id,icon:Icon,title,description,children}:{id:string;icon:LucideIcon;title:string;description:string;children:ReactNode}){
 return <section id={id} aria-labelledby={`${id}-title`} className="min-w-0 scroll-mt-28 rounded-3xl border border-line bg-surface px-5 pt-6 pb-2 lg:px-8"><div className="flex items-start gap-4 border-b border-line pb-5"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon aria-hidden className="size-5"/></div><div className="min-w-0"><h2 id={`${id}-title`} className="text-xl font-bold tracking-tight text-ink">{title}</h2><p className="mt-1 text-sm text-ink-2">{description}</p></div></div>{children}</section>
}
export function DwellField(){
 const {settings,updateSettings}=useApp()
 return <SettingRow title="Dwell duration" description={`How long a steady look takes to select a target. Currently ${(settings.dwellMs/1000).toFixed(1)} seconds.`}><Segmented label="Dwell duration" value={settings.dwellMs} options={DWELL_OPTIONS} onChange={value=>updateSettings({dwellMs:value})} format={value=>`${value} ms`}/></SettingRow>
}
export function KeyboardSettingsFields(){
 const {settings,updateSettings}=useApp()
 const set=<K extends keyof Settings>(key:K)=>(value:Settings[K])=>updateSettings({[key]:value} as Partial<Settings>)
 return <>
 <SettingRow title="Key size" description="Larger keys give you more room to aim."><Segmented label="Key size" value={settings.keySize} options={['small','medium','large'] as const} onChange={set('keySize')} format={cap}/></SettingRow>
 <SettingRow title="Key spacing" description="Separate neighbouring keys to make them easier to distinguish."><Segmented label="Key spacing" value={settings.keySpacing} options={['compact','comfortable','spacious'] as const} onChange={set('keySpacing')} format={cap}/></SettingRow>
 <SettingRow title="Keyboard layout"><Segmented label="Keyboard layout" value={settings.layout} options={['qwerty','abc'] as const} onChange={set('layout')} format={value=>value==='qwerty'?'QWERTY':'ABC order'}/></SettingRow>
 <SettingRow title="Letter case"><Segmented label="Letter case" value={settings.letterCase} options={['sentence','lower','upper'] as const} onChange={set('letterCase')} format={value=>value==='sentence'?'Sentence case':value==='lower'?'lowercase':'UPPERCASE'}/></SettingRow>
 <SettingRow title="Confirm letters with large targets" description="Eye typing opens enlarged nearby letters before committing a character. Physical clicks type directly."><Toggle label="Confirm letters with large targets" checked={settings.precisionMode} onChange={set('precisionMode')}/></SettingRow>
 <SettingRow title="High contrast mode" description="Yellow on black with solid outlines."><Toggle label="High contrast mode" checked={settings.highContrast} onChange={set('highContrast')}/></SettingRow>
 </>
}
export function AccessibilitySettings(){
 const {settings,updateSettings,resetSettings,resetAllLocal,notify,speech,openGuide}=useApp()
 const gaze=useGazeState()
 const [confirmClear,setConfirmClear]=useState(false)
 const set=<K extends keyof Settings>(key:K)=>(value:Settings[K])=>updateSettings({[key]:value} as Partial<Settings>)
 return <div className="min-w-0 space-y-6">
 <Section id="eye-tracking" icon={Eye} title="Eye tracking" description="Control how gaze turns into selections.">
 <SettingRow title="Selection gesture" description="Hold a steady gaze, close your eyes deliberately to select, or use either method. Ordinary quick blinks are ignored."><Segmented label="Selection gesture" value={settings.selectionMethod} options={['dwell','both','blink'] as const} onChange={set('selectionMethod')} format={value=>value==='dwell'?'Look & hold':value==='both'?'Hold or blink':'Blink only'}/></SettingRow>
 <DwellField/>
 <SettingRow title="Gaze smoothing" description="Steadies and slows the cursor. High limits webcam movement to about 320 pixels per second."><Segmented label="Gaze smoothing" value={settings.smoothing} options={['off','low','medium','high'] as const} onChange={set('smoothing')} format={cap}/></SettingRow>
 <SettingRow title="Show gaze cursor"><Toggle label="Show gaze cursor" checked={settings.showGazeCursor} onChange={set('showGazeCursor')}/></SettingRow>
 <SettingRow title="Target assist" description="Help focus targets across small gaps between their borders."><Toggle label="Target assist" checked={settings.targetAssist} onChange={set('targetAssist')}/></SettingRow>
 <SettingRow title="Learn from my typing" description="Off by default. Opt in to small corrections from stable selections. Leave this off while checking calibration."><Toggle label="Learn from my typing" checked={settings.adaptiveLearning} onChange={set('adaptiveLearning')}/></SettingRow>
 <SettingRow title="Pause behaviour" description="Keep gaze active to resume by looking, or stop tracking until a helper resumes it."><Segmented label="Pause behaviour" value={settings.pauseBehavior} options={['gaze','manual'] as const} onChange={set('pauseBehavior')} format={value=>value==='gaze'?'Resume by looking':'Resume manually'}/></SettingRow>
 <SettingRow title="Calibration" description={gaze.calibrated?'Calibrated for this session. Recheck if tracking drifts.':'Calibrate after connecting your camera.'}><div className="flex flex-wrap gap-2"><button className={buttonClass('secondary')} onClick={()=>navigate('calibrate')}>Recalibrate</button><button className={buttonClass('ghost')} disabled={!gaze.calibrated} onClick={()=>{gazeService.resetCalibration();notify('Calibration reset','info')}}><RotateCcw className="size-4"/>Reset</button></div></SettingRow>
 <SettingRow title="Quick guide"><button className={buttonClass('secondary')} onClick={openGuide}><BookOpen className="size-4"/>Open quick guide</button></SettingRow>
 </Section>
 <Section id="keyboard" icon={Keyboard} title="Keyboard" description="Size, spacing and layout of the on-screen keyboard."><KeyboardSettingsFields/></Section>
 <Section id="communication" icon={MessageSquareText} title="Communication" description="Prediction, correction and speech output.">
 <SettingRow title="Word suggestions"><Toggle label="Word suggestions" checked={settings.suggestions} onChange={set('suggestions')}/></SettingRow>
 <SettingRow title="Autocorrection" description="Correct common typos when a word ends. Undo can reverse a correction."><Toggle label="Autocorrection" checked={settings.autocorrect} onChange={set('autocorrect')}/></SettingRow>
 <SettingRow title="Text-to-speech" description={speech.supported?'Read messages aloud with your device’s voices.':'Speech is unavailable in this browser.'}><Toggle label="Text-to-speech" checked={settings.speechEnabled} onChange={set('speechEnabled')}/></SettingRow>
 <SettingRow title="Voice" description="Voices come from your operating system and browser."><div className="w-72 max-w-full"><VoiceSelect/></div></SettingRow>
 <SettingRow title="Speech speed" htmlFor="settings-rate"><div className="w-72 max-w-full"><RateSlider id="settings-rate"/></div></SettingRow>
 <SettingRow title="Keep history of spoken messages" description="Off by default to protect private conversations."><Toggle label="Keep history of spoken messages" checked={settings.keepHistory} onChange={set('keepHistory')}/></SettingRow>
 </Section>
 <Section id="comfort" icon={Sparkles} title="Comfort" description="Make the app more comfortable for longer sessions.">
 <SettingRow title="Break reminders"><Segmented label="Break reminders" value={settings.breakReminderMin} options={[0,15,20,30,45] as const} onChange={set('breakReminderMin')} format={value=>value===0?'Off':`${value} min`}/></SettingRow>
 <SettingRow title="Reduced motion"><Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={set('reducedMotion')}/></SettingRow>
 <SettingRow title="Sound feedback"><Toggle label="Sound feedback" checked={settings.soundFeedback} onChange={set('soundFeedback')}/></SettingRow>
 <SettingRow title="Interface size"><Segmented label="Interface size" value={settings.uiScale} options={[100,112,125,150] as const} onChange={set('uiScale')} format={value=>`${value}%`}/></SettingRow>
 <SettingRow title="Typeface" description="Atkinson Hyperlegible is an alternative intended to improve character recognition."><Segmented label="Typeface" value={settings.font} options={['inter','atkinson'] as const} onChange={set('font')} format={value=>value==='inter'?'Inter':'Atkinson Hyperlegible'}/></SettingRow>
 </Section>
 <Section id="privacy" icon={ShieldCheck} title="Privacy" description="Your camera and locally saved data.">
 <SettingRow title="Camera permission" description="Managed by the browser. Camera access starts only after you allow it."><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-ink-2">{gaze.camera==='connected'?'Camera connected':'Camera off'}</span><button className={buttonClass('secondary')} disabled={gaze.camera!=='connected'} onClick={()=>{gazeService.stopTracking();notify('Camera stopped','info')}}><Camera className="size-4"/>Stop camera</button></div></SettingRow>
 <SettingRow title="Local processing" description="Camera frames are analysed in this browser. The app does not record or upload video. Browser speech voices and font downloads may use a network connection."><span className="rounded-full bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">On-device camera processing</span></SettingRow>
 <SettingRow title="Clear locally saved data" description="Removes saved phrases, history and settings, and clears the current session."><button className={buttonClass('danger')} onClick={()=>setConfirmClear(true)}><Trash2 className="size-4"/>Clear data</button></SettingRow>
 </Section>
 <div className="flex justify-end pb-4"><button className={buttonClass('ghost')} onClick={()=>{resetSettings();notify('Settings restored to defaults','info')}}><RotateCcw className="size-4"/>Restore default settings</button></div>
 <Modal open={confirmClear} onClose={()=>setConfirmClear(false)} title="Clear all locally saved data?" description="Saved phrases, typing history and settings will be removed from this device. This can’t be undone."><div className="flex flex-wrap justify-end gap-2"><button className={buttonClass('secondary','lg')} onClick={()=>setConfirmClear(false)}>Cancel</button><button className={buttonClass('danger','lg')} onClick={()=>{clearAll();resetAllLocal();setConfirmClear(false);notify('Local data cleared','info')}}>Clear data</button></div></Modal>
 </div>
}
