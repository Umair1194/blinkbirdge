// Synthetic eye input verifies the enhanced letter confirmation and final-check reference.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const assert=require('node:assert/strict')
const BASE=process.env.APP_URL||'http://127.0.0.1:8443'
;(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{localStorage.setItem('gesture-playground:onboarded','true');localStorage.setItem('gesture-playground:guideSeen','true');localStorage.setItem('gesture-playground:settings',JSON.stringify({precisionMode:true,smoothing:'high',dwellMs:1200,soundFeedback:false}))})
  await page.goto(BASE+'/#/workspace');await page.locator('[data-gaze-id="ws-k-r"]').waitFor()
  await page.evaluate(async()=>{
   const {gazeService:service}=await import(performance.getEntriesByType('resource').find(entry=>entry.name.includes('/src/engine/gazeService.ts')).name)
   service.stopTracking();service.set({mode:'webcam',engine:'running',camera:'connected',faceDetected:true})
   service.referenceSamples=Array.from({length:60},()=>({cx:.35,cy:.5,size:.3,yaw:0,pitch:0}))
   service.finalReferenceSamples=Array.from({length:60},()=>({cx:.5,cy:.5,size:.3,yaw:0,pitch:0}))
   service.completeCalibration({points:13,samples:400,simulated:false,validation:{meanErrorPx:35,medianErrorPx:30,p90ErrorPx:60,targets:5,validSamples:80}})
   window.precisionTrace={service,target:{x:0,y:0},timer:null}
  })
  const target=async selector=>{
   const rect=await page.locator(selector).boundingBox();assert.ok(rect)
   await page.evaluate(point=>{precisionTrace.target=point},{x:rect.x+rect.width/2,y:rect.y+rect.height/2})
  }
  await target('[data-gaze-id="ws-k-r"]')
  await page.evaluate(()=>{precisionTrace.timer=setInterval(()=>{
   const t=precisionTrace,s=t.service
   s.handleMetrics({ear:.05,blink:.7,yawDeg:0,pitchDeg:8,cx:.5,cy:.5,size:.3,eyesClosed:false,glare:false})
   s.handleRawGaze(t.target)
  },33)})
  await page.getByRole('dialog',{name:'Choose your letter'}).waitFor({timeout:7000})
  assert.match(await page.getByRole('textbox').innerText(),/Your words/,'the first eye selection must not commit the estimated neighbour')
  assert.equal(await page.evaluate(()=>precisionTrace.service.getState().movedSinceCalibration),false,'a different old training average must not trigger a false head warning')
  await page.waitForTimeout(1700)
  assert.match(await page.getByRole('textbox').innerText(),/Your words/,'a new dialog under a resting gaze must not automatically commit a letter')
  await page.screenshot({path:'/tmp/blink-precision-confirmation.png',fullPage:true})
  await target('[data-gaze-id="precision-k-e"]')
  await page.waitForFunction(()=>document.querySelector('[role="textbox"]')?.textContent.trim()==='E',{timeout:8000})
  await page.evaluate(()=>{clearInterval(precisionTrace.timer);precisionTrace.service.stopTracking()})
  await page.locator('[data-gaze-id="ws-k-w"]').click()
  assert.equal((await page.getByRole('textbox').innerText()).trim(),'Ew','physical clicks still type directly')
  assert.deepEqual(errors,[])
  console.log('PASS: final-check posture baseline, no automatic neighbouring letter, enlarged E confirmation and direct physical typing')
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)})
