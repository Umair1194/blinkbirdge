// Synthetic camera traces exercise selection safety, not physical webcam accuracy.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const BASE = process.env.APP_URL || 'http://127.0.0.1:8443'
;(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})})
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}})
    const errors=[];page.on('pageerror',error=>errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('gesture-playground:onboarded','true')
      localStorage.setItem('gesture-playground:guideSeen','true')
      localStorage.setItem('gesture-playground:settings',JSON.stringify({smoothing:'medium',dwellMs:800,keySize:'medium',adaptiveLearning:true,soundFeedback:false,precisionMode:false}))
    })
    await page.goto(BASE+'/#/workspace')
    await page.locator('[data-gaze-id="ws-k-q"]').waitFor()
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gesture-playground:settings')).dwellMs === 1200)
    assert.deepEqual(await page.evaluate(()=>{const settings=JSON.parse(localStorage.getItem('gesture-playground:settings'));return {smoothing:settings.smoothing,dwellMs:settings.dwellMs,keySize:settings.keySize,adaptiveLearning:settings.adaptiveLearning}}),{smoothing:'high',dwellMs:1200,keySize:'large',adaptiveLearning:false})
    await page.evaluate(async () => {
      const {gazeService:service}=await import(performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/engine/gazeService.ts')).name)
      service.stopTracking()
      window.trace={service,timer:null,tick:0,target:{x:0,y:0},scanning:false,closed:false,moved:false}
      service.set({mode:'webcam',engine:'running',calibrated:true,camera:'connected',faceDetected:true,calibration:{simulated:false,points:9,samples:200,completedAt:Date.now(),validation:{meanErrorPx:20,medianErrorPx:18,p90ErrorPx:30,targets:5,validSamples:80}}})
      service.reference={cx:.5,cy:.5,size:.3,yaw:0,pitch:0}
      service.headStability.calibrate(Array.from({length:20},()=>({cx:.5,cy:.5,size:.3,yaw:0,pitch:0})))
    })
    const target = async key => {
      const box=await page.locator(`[data-gaze-id="ws-k-${key}"]`).boundingBox()
      assert.ok(box)
      await page.evaluate(({x,y})=>{trace.target={x,y}}, {x:box.x+box.width/2,y:box.y+box.height/2})
    }
    await target('q')
    await page.evaluate(()=>{
      trace.timer=setInterval(()=>{
        const t=trace,service=t.service;t.tick++
        service.handleMetrics({ear:.3,blink:0,yawDeg:0,pitchDeg:0,cx:t.moved?.6:.5,cy:.5,size:.3,eyesClosed:t.closed,glare:false})
        const dx=t.scanning?180*Math.sin(t.tick*1.9):2*Math.sin(t.tick)
        service.handleRawGaze({x:t.target.x+dx,y:t.target.y+(t.scanning?100*Math.cos(t.tick*1.7):Math.cos(t.tick))})
      },33)
    })
    await page.waitForTimeout(1900)
    assert.match(await page.getByRole('textbox').innerText(),/^Q/)
    const first=await page.getByRole('textbox').innerText()
    await page.waitForTimeout(1200)
    assert.equal(await page.getByRole('textbox').innerText(),first,'holding a key must not repeat it')
    await target('w');await page.waitForTimeout(2400)
    assert.match(await page.getByRole('textbox').innerText(),/^Qw/)
    const before=await page.getByRole('textbox').innerText()
    await page.evaluate(()=>{trace.scanning=true});await page.waitForTimeout(2500)
    assert.equal(await page.getByRole('textbox').innerText(),before,'scattered estimates must not click')
    await page.evaluate(()=>{trace.scanning=false;trace.moved=true});await target('e');await page.waitForTimeout(2200)
    assert.equal(await page.getByRole('textbox').innerText(),before,'head movement must block selections')
    await page.evaluate(()=>{trace.moved=false;trace.closed=true});await target('r');await page.waitForTimeout(2000)
    assert.equal(await page.getByRole('textbox').innerText(),before,'closed eyes must not accumulate dwell')
    await page.evaluate(async()=>{
      trace.closed=false;trace.moved=false
      const {dwell}=await import(performance.getEntriesByType('resource').find(entry => entry.name.includes('/src/lib/dwell.ts')).name)
      dwell.config.method='blink';dwell.reset()
    })
    await target('t');await page.waitForTimeout(1100)
    await page.evaluate(()=>{trace.closed=true});await page.waitForTimeout(550)
    await page.evaluate(()=>{trace.closed=false});await page.waitForTimeout(200)
    assert.equal((await page.getByRole('textbox').innerText()).length,before.length+1,'a deliberate blink after fixation should still select')
    const rejected=await page.evaluate(()=>{
      clearInterval(trace.timer)
      trace.service.completeCalibration({points:9,samples:200,simulated:false,validation:{meanErrorPx:160,medianErrorPx:140,p90ErrorPx:240,targets:5,validSamples:80}})
      return trace.service.getState().calibrated
    })
    assert.equal(rejected,false,'bad calibration must remain disabled')
    await page.goto(BASE+'/#/calibrate')
    const accepted=await page.evaluate(()=>{
      trace.service.completeCalibration({points:9,samples:200,simulated:false,validation:{meanErrorPx:25,medianErrorPx:20,p90ErrorPx:40,targets:5,validSamples:80}})
      return trace.service.getState().calibrated
    });assert.equal(accepted,true)
    await page.setViewportSize({width:1200,height:1000});await page.waitForTimeout(100)
    assert.equal(await page.evaluate(()=>trace.service.getState().calibrated),false,'resizing must invalidate a pixel-coordinate calibration')
    assert.deepEqual(errors,[])
    await page.evaluate(()=>trace.service.stopTracking())
    console.log('PASS: stable fixation, intended target change, repeat lock, scattered estimates, head movement, closed eyes, deliberate blink, calibration rejection and viewport invalidation')
  } finally { await browser.close() }
})().catch(error=>{console.error(error);process.exit(1)})
