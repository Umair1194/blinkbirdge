// Exercises the calibration UI state machine with simulated camera data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert=require('node:assert/strict')
const BASE=process.env.APP_URL || 'http://127.0.0.1:8443'
;(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})})
  try {
    for(const recover of [true,false]) {
      const page=await browser.newPage({viewport:{width:1280,height:900}})
      const errors=[];page.on('pageerror',e=>errors.push(e.message))
      await page.addInitScript(()=>{localStorage.setItem('gesture-playground:onboarded','true');localStorage.setItem('gesture-playground:guideSeen','true')})
      await page.goto(BASE+'/#/calibrate')
      await page.evaluate(async recover=>{
        const module=await import(performance.getEntriesByType('resource').find(entry=>entry.name.includes('/src/engine/gazeService.ts')).name)
        const service=module.gazeService
        service.stopTracking()
        window.calibrationTest={service,train:[],checks:[],fits:0,captureRetried:false}
        service.set({mode:'webcam',engine:'running',camera:'off',faceDetected:true})
        const geometry=(target)=>{
          const element=document.querySelector('.calibration-page [aria-current="step"]')
          if(!element)throw Error('No visible calibration target')
          const rect=element.getBoundingClientRect()
          if(Math.abs(rect.left+rect.width/2-target.x*innerWidth)>1 || Math.abs(rect.top+rect.height/2-target.y*innerHeight)>1)throw Error('Training label does not match the visible dot')
          if(document.querySelectorAll('.calibration-page [aria-current="step"]').length!==1)throw Error('Multiple active dots')
        }
        service.calibrate=async(target,opts)=>{
          geometry(target);calibrationTest.train.push({target,group:opts.group})
          if(!calibrationTest.captureRetried){calibrationTest.captureRetried=true;throw new module.CalibrationCaptureError()}
          opts.onProgress?.(1,true);return 30
        }
        service.fitCalibration=()=>{calibrationTest.fits++;return{samples:400,points:13,cvErrorPx:40,modelName:'simulated'}}
        service.validate=async(target,opts)=>{
          geometry(target);const index=calibrationTest.checks.length
          const error=index<5?127:recover?30:127
          calibrationTest.checks.push(target)
          service.validationDetails.push({...target,meanErrorPx:error,biasX:error,biasY:0,spreadPx:5,frames:12})
          opts.onProgress?.(1,true);return Array(12).fill(error)
        }
      },recover)
      await page.getByRole('button',{name:'Start calibration',exact:true}).click()
      await page.getByRole('heading',{name:recover?'Calibration complete':'Calibration needs improvement',exact:true}).waitFor()
      const result=await page.evaluate(()=>({train:calibrationTest.train,checks:calibrationTest.checks,fits:calibrationTest.fits,state:calibrationTest.service.getState()}))
      assert.equal(result.train.length,19,'13 initial targets, one capture retry and five refinement targets')
      assert.equal(result.checks.length,10,'both checks have five targets')
      assert.equal(result.fits,2)
      assert.equal(result.state.calibration.refined,true)
      assert.equal(result.state.calibrated,recover)
      assert.equal(result.state.calibration.validation.meanErrorPx,recover?30:127)
      for(const target of result.checks.slice(5))assert.equal(result.train.some(item=>Math.hypot(item.target.x-target.x,item.target.y-target.y)<.001),false,'final check locations must remain outside training')
      await page.getByText(/Largest error:/).waitFor()
      if(!recover) {
        const pending=page.waitForEvent('download')
        await page.getByRole('button',{name:'Save tracking report'}).click()
        const download=await pending
        assert.equal(download.suggestedFilename(),'blinkbridge-tracking-report.json')
        const report=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'))
        assert.equal(report.version,2)
        assert.equal(report.calibration.validation.meanErrorPx,127)
      }
      // Keep this synthetic completed result visible for layout checks only.
      // The separate tracking suite verifies real viewport invalidation.
      await page.evaluate(()=>{calibrationTest.service.checkViewport=()=>{}})
      await page.setViewportSize({width:320,height:900})
      await page.evaluate(()=>{document.documentElement.style.fontSize='150%'})
      await page.waitForTimeout(100)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'calibration results must fit a narrow viewport at enlarged text')
      assert.deepEqual(errors,[])
      await page.close()
    }
    const capturePage=await browser.newPage()
    await capturePage.goto(BASE+'/#/calibrate')
    const capture=await capturePage.evaluate(async()=>{
      const module=await import(performance.getEntriesByType('resource').find(entry=>entry.name.includes('/src/engine/gazeService.ts')).name)
      const service=new module.GazeService()
      let frames=0,target=null,produce=true
      service.adapter={setCalibrationTarget(value){target=value},calibrationSampleCount(){return frames},clearCalibrationGroup(){frames=0},stop(){}}
      service.set({mode:'webcam',engine:'running'})
      const timer=setInterval(()=>{
        service.handleMetrics({ear:.3,blink:0,yawDeg:0,pitchDeg:0,cx:.5,cy:.5,size:.3,eyesClosed:false,glare:false})
        if(target && produce)frames++
      },40)
      try {
        const started=performance.now()
        const captured=await service.calibrate({x:.5,y:.5},{group:0,settleMs:0,durationMs:100})
        const elapsed=performance.now()-started
        produce=false
        let timedOut=false
        try {await service.calibrate({x:.5,y:.5},{group:1,settleMs:0,durationMs:25})} catch(error) {timedOut=error instanceof module.CalibrationCaptureError}
        return {captured,elapsed,timedOut,released:target===null}
      } finally {clearInterval(timer);service.stopTracking()}
    })
    assert.ok(capture.captured>=24)
    assert.ok(capture.elapsed>700,'capture must wait for frames rather than only the 100 ms timer')
    assert.equal(capture.timedOut,true)
    assert.equal(capture.released,true)
    await capturePage.close()
    console.log('PASS: rendered target coordinates, frame-capture retry, 13-point training, automatic refinement, fresh holdout check, recovery and rejection')
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
