import type { FaceMetrics } from './types'

type Position = {cx:number;cy:number;size:number;yaw:number;pitch:number}
const median=(values:number[])=>values.sort((a,b)=>a-b)[values.length>>1]
const quantile=(values:number[],p:number)=>values.sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]
export function headPosition(face:FaceMetrics):Position {
  return {cx:face.cx,cy:face.cy,size:face.size,yaw:face.yawDeg,pitch:face.pitchDeg}
}

/** Use the posture range actually observed during the final accuracy check.
 * Pose-only jitter is not sufficient evidence that somebody moved away. */
export class HeadStability {
  private reference:Position|null=null
  private tolerance={cx:.05,cy:.06,size:Math.log(1.18),yaw:12,pitch:14}
  private recent:{position:Position;t:number}[]=[]
  private since:number|null=null
  private backSince:number|null=null
  private deviation={translation:0,distance:0,rotation:0}
  diagnostics(){return {...this.deviation,moved:this.moved,selectionSafe:this.selectionSafe}}
  moved=false
  selectionSafe=true
  calibrate(samples:Position[]) {
    this.reset()
    samples=samples.filter(sample=>Object.values(sample).every(Number.isFinite)&&sample.size>0)
    if(samples.length<8)return
    this.reference={cx:median(samples.map(s=>s.cx)),cy:median(samples.map(s=>s.cy)),size:median(samples.map(s=>s.size)),yaw:median(samples.map(s=>s.yaw)),pitch:median(samples.map(s=>s.pitch))}
    const ref=this.reference
    const spread=(key:'cx'|'cy'|'yaw'|'pitch',floor:number,cap:number)=>Math.min(cap,Math.max(floor,quantile(samples.map(s=>Math.abs(s[key]-ref[key])),.95)*1.6))
    this.tolerance={cx:spread('cx',.05,.09),cy:spread('cy',.06,.1),yaw:spread('yaw',12,20),pitch:spread('pitch',14,22),size:Math.min(Math.log(1.3),Math.max(Math.log(1.18),quantile(samples.map(s=>Math.abs(Math.log(s.size/ref.size))),.95)*1.6))}
  }
  reset(){this.reference=null;this.recent=[];this.since=null;this.backSince=null;this.moved=false;this.selectionSafe=true;this.deviation={translation:0,distance:0,rotation:0}}
  push(face:FaceMetrics|null,t:number){
    if(!face||!this.reference||face.eyesClosed)return this.moved
    const position=headPosition(face)
    if(!Object.values(position).every(Number.isFinite)||position.size<=0)return this.moved
    this.recent.push({position,t});while(this.recent.length&&t-this.recent[0].t>300)this.recent.shift()
    if(this.recent.length<3)return this.moved
    const cur:Position={cx:median(this.recent.map(s=>s.position.cx)),cy:median(this.recent.map(s=>s.position.cy)),size:median(this.recent.map(s=>s.position.size)),yaw:median(this.recent.map(s=>s.position.yaw)),pitch:median(this.recent.map(s=>s.position.pitch))}
    const ref=this.reference,tol=this.tolerance
    const translation=Math.hypot((cur.cx-ref.cx)/tol.cx,(cur.cy-ref.cy)/tol.cy)
    const distance=Math.abs(Math.log(cur.size/ref.size))/tol.size
    const rotation=Math.max(Math.abs(cur.yaw-ref.yaw)/tol.yaw,Math.abs(cur.pitch-ref.pitch)/tol.pitch)
    this.deviation={translation,distance,rotation}
    const changed=translation>1.35||distance>1.35||(rotation>1.5&&translation>.7)||rotation>2.5
    if(changed){this.backSince=null;this.since??=t;if(t-this.since>=900)this.moved=true}
    else {this.since=null;if(this.moved&&translation<.8&&distance<.8&&rotation<1){this.backSince??=t;if(t-this.backSince>=600)this.moved=false}else this.backSince=null}
    this.selectionSafe=!this.moved&&!(changed&&(translation>2||distance>2||(this.since!==null&&t-this.since>=200)))
    return this.moved
  }
}
