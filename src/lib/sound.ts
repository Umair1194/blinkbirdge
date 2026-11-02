let context:AudioContext|null=null
export function playSelectSound(kind:'select'|'soft'='select'){
 try{
  context??=new AudioContext()
  if(context.state==='suspended')void context.resume().catch(()=>{})
  const oscillator=context.createOscillator(),gain=context.createGain(),time=context.currentTime
  oscillator.type='sine';oscillator.frequency.value=kind==='select'?880:520
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.12,time+.01);gain.gain.exponentialRampToValueAtTime(.0001,time+.12)
  oscillator.connect(gain).connect(context.destination);oscillator.start(time);oscillator.stop(time+.13)
 }catch{/* Visual feedback remains available. */}
}
