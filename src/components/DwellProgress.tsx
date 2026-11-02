import type { CSSProperties } from 'react'
export function DwellProgress({progress}:{progress:number}) {
  if(progress<=0)return null
  return <span aria-hidden className="dwell-ring" style={{'--p':Math.min(1,Math.max(0,progress))} as CSSProperties}/>
}
