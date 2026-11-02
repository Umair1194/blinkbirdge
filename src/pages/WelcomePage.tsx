import { ArrowRight, Eye, MousePointer2, SlidersHorizontal, Volume2 } from 'lucide-react'
import { gazeService } from '../engine/gazeService'
import { Logo } from '../components/Logo'
import { buttonClass, cx } from '../components/ui'
import { navigate } from '../lib/router'
import { useApp } from '../state/AppStore'

const FEATURES = [
  { icon: Eye, title: 'Eye-Controlled Typing', body: 'Type letters by simply looking at them.' },
  { icon: SlidersHorizontal, title: 'Personalized Experience', body: 'Adjust your keyboard and tracking preferences.' },
  { icon: Volume2, title: 'Speak Your Words', body: 'Convert written messages into natural speech.' },
]

const STEPS = ['Connect your camera', 'Follow 9 targets with your eyes', 'Start typing']

/** Illustrates dwell selection: a gaze ring resting on a key that's filling. */
function DwellIllustration() {
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
  return (
    <div aria-hidden className="relative rounded-[28px] border border-line bg-surface p-5 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)]">
      <div className="rounded-2xl bg-subtle px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">Your Message</div>
        <div className="mt-1 text-2xl font-medium tracking-tight text-ink">
          I would like some wa<span className="animate-caret ml-0.5 inline-block h-6 w-[3px] translate-y-1 rounded-full bg-brand-2" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {['water', 'walk', 'warm'].map((w, i) => (
          <div key={w} className={cx('flex h-11 flex-1 items-center justify-center rounded-xl border-2 text-base font-semibold', i === 0 ? 'border-brand-soft-2 bg-brand-soft text-brand' : 'border-line text-ink-2')}>
            {w}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r, ri) => (
          <div key={r} className="flex justify-center gap-2" style={{ paddingInline: ri * 14 }}>
            {r.split('').map((c) => {
              const target = c === 'T'
              return (
                <div
                  key={c}
                  className={cx(
                    'relative flex h-12 flex-1 items-center justify-center rounded-xl border-2 text-lg font-semibold',
                    target ? 'border-key-hover-line bg-key-hover text-ink' : 'border-line bg-surface text-ink',
                  )}
                >
                  {target && <span className="dwell-ring" style={{ ['--p' as string]: 0.68 }} />}
                  {c}
                  {target && (
                    <span className="pointer-events-none absolute left-[38%] top-[42%] z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-brand-3 bg-brand-2/15">
                      <span className="size-2.5 rounded-full bg-brand-3" />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="absolute -bottom-4 right-6 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-md">
        Look for 0.8 s to select
      </div>
    </div>
  )
}

export function WelcomePage(){
 const {setOnboarded}=useApp()
 const start=()=>{setOnboarded(true);navigate('setup')}
 const demo=async()=>{setOnboarded(true);await gazeService.startTracking('simulation');navigate('workspace')}
 return <div className="min-h-screen bg-canvas"><div className="mx-auto flex max-w-[1240px] flex-col px-5 py-8 sm:px-8 lg:px-12">
 <header className="flex flex-wrap items-center justify-between gap-3"><Logo/><a href="#/help" className={buttonClass('ghost')}>Help & tutorials</a></header>
 <main className="grid min-w-0 items-center gap-14 pb-12 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20"><div className="min-w-0">
 <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-sm font-semibold text-brand"><span className="size-1.5 shrink-0 rounded-full bg-brand-2"/>Assistive communication</p>
 <h1 className="mt-6 text-[clamp(2.75rem,5vw,4.25rem)] font-bold leading-[1.04] tracking-[-0.03em] text-ink">Your Eyes.<br/>Your Voice.<br/><span className="text-brand">Your Freedom.</span></h1>
 <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink-2">Communicate, type and express yourself using only your eye movements.</p>
 <div className="mt-9 flex flex-wrap gap-3"><button className={buttonClass('primary','lg')} onClick={start}>Get Started <ArrowRight className="size-5"/></button><button className={buttonClass('secondary','lg')} onClick={()=>void demo()}><MousePointer2 className="size-5"/>Explore Demo</button></div>
 <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-2">Demo Mode uses your mouse as simulated gaze — no camera needed. A helper can assist with setup.</p>
 <ol className="mt-10 flex flex-wrap gap-x-6 gap-y-3" aria-label="Setup steps">{STEPS.map((step,index)=><li key={step} className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-brand-soft-2 text-sm text-brand">{index+1}</span>{step}</li>)}</ol>
 </div><div className="hidden lg:block"><DwellIllustration/></div></main>
 <section aria-label="Features" className="grid gap-5 md:grid-cols-3">{FEATURES.map(({icon:Icon,title,body})=><article key={title} className="min-w-0 rounded-3xl border border-line bg-surface p-6"><Icon className="size-6 text-brand" aria-hidden/><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mt-2 text-ink-2">{body}</p></article>)}</section>
 <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm text-ink-2"><span>Camera processing stays on this device.</span><span>Webcam accuracy depends on your setup.</span></footer></div></div>
}
