/** Learn open-eye proportions per session. No universal eyelid-height cutoff:
 * a naturally narrow open eye must not be classified as a permanent blink. */
export class EyeOpenness {
  private samples:{ear:number;blink:number|null}[]=[]
  private baseline:number|null=null
  reset(){this.samples=[];this.baseline=null}
  update(ear:number,blink:number|null){
    if(!Number.isFinite(ear)||ear<=0)return true
    if(this.samples.length<45){
      this.samples.push({ear,blink})
      const sorted=this.samples.map(s=>s.ear).sort((a,b)=>a-b)
      this.baseline=sorted[Math.floor((sorted.length-1)*.85)]
    }
    const baseline=this.baseline??ear
    const ratio=ear/Math.max(.003,baseline)
    // Very strong lid closure is sufficient. Moderate closure requires the
    // independent blink cue too; a high blendshape score by itself isn't.
    const closed=ratio<.28||(ratio<.55&&blink!==null&&blink>.55)
    if(!closed&&this.samples.length>=45&&ear>baseline*.7&&ear<baseline*1.6)this.baseline=baseline+(ear-baseline)*.006
    return closed
  }
  getBaseline(){return this.baseline}
}
