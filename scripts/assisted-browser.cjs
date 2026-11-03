const {chromium}=require('playwright'),assert=require('node:assert/strict')
;(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{localStorage.setItem('gesture-playground:onboarded','true');localStorage.setItem('gesture-playground:guideSeen','true');localStorage.setItem('gesture-playground:settings',JSON.stringify({soundFeedback:false,dwellMs:800}))})
  await page.addInitScript(()=>{
   window.assistedSpeech=[]
   Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},resume(){},speak(u){assistedSpeech.push(u.text);u.onstart?.()}}})
  })
  await page.goto((process.env.APP_URL||'http://127.0.0.1:8443')+'/#/workspace')
  await page.evaluate(async()=>{
   const {gazeService:service}=await import(performance.getEntriesByType('resource').find(entry=>entry.name.includes('/src/engine/gazeService.ts')).name)
   service.stopTracking();service.set({mode:'webcam',engine:'running',camera:'connected',faceDetected:true})
   service.referenceSamples=Array.from({length:48},()=>({cx:.5,cy:.5,size:.3,yaw:0,pitch:0}))
   service.completeCalibration({points:9,samples:229,simulated:false,validation:null,fit:{points:9,samples:229,cvErrorPx:148}})
   window.assistedTest={service,point:{x:innerWidth/2,y:innerHeight/2}}
   assistedTest.timer=setInterval(()=>{service.handleMetrics({ear:.3,blink:0,yawDeg:0,pitchDeg:0,cx:.5,cy:.5,size:.3,eyesClosed:false,glare:false});service.handleRawGaze(assistedTest.point)},33)
  })
  await page.getByRole('heading',{name:'Large-target gaze typing',exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>assistedTest.service.getState().calibrated),true,'148 px no longer blocks assisted typing')
  assert.equal(await page.locator('[data-gaze-assisted="true"]').count(),2,'only two large choices')
  const chooseByGaze=async(letter)=>{
   const step=await page.locator('[data-assisted-step]').getAttribute('data-assisted-step')
   await page.evaluate(()=>{assistedTest.point={x:innerWidth/2,y:innerHeight/2}})
   await page.waitForTimeout(900)
   const choices=page.locator('[data-assisted-values]'),values=await choices.evaluateAll(nodes=>nodes.map(node=>JSON.parse(node.dataset.assistedValues)))
   const index=values.findIndex(group=>group.includes(letter));assert.ok(index>=0)
   const rect=await choices.nth(index).boundingBox()
   await page.evaluate(point=>assistedTest.point=point,{x:rect.x+rect.width/2+148,y:rect.y+rect.height/2})
   await page.waitForFunction(previous=>document.querySelector('[data-assisted-step]').dataset.assistedStep!==previous,step,{timeout:9000})
  }
  await chooseByGaze('e')
  const firstStep=await page.locator('[data-assisted-step]').getAttribute('data-assisted-step')
  await page.waitForTimeout(2300)
  assert.equal(await page.locator('[data-assisted-step]').getAttribute('data-assisted-step'),firstStep,'resting gaze must not cascade through groups')
  for(let i=0;i<4;i++)await chooseByGaze('e')
  assert.equal((await page.getByRole('textbox',{name:'Your message'}).innerText()).trim(),'E','gaze group selections must type E')
  await page.screenshot({path:'/private/tmp/blinkbridge-assisted-keyboard.png',fullPage:true})
  await page.evaluate(()=>clearInterval(assistedTest.timer))
  const clickValue=async(value)=>{
   for(let depth=0;depth<5;depth++){
    const nodes=page.locator('[data-assisted-values]'),groups=await nodes.evaluateAll(elements=>elements.map(el=>JSON.parse(el.dataset.assistedValues)))
    const index=groups.findIndex(group=>group.includes(value));assert.ok(index>=0);await nodes.nth(index).click()
   }
  }
  await clickValue('Space');await clickValue('b')
  assert.equal((await page.getByRole('textbox',{name:'Your message'}).innerText()).trim(),'E b')
  await clickValue('Delete');assert.equal((await page.getByRole('textbox',{name:'Your message'}).innerText()).trim(),'E')
  await clickValue('Undo');assert.equal((await page.getByRole('textbox',{name:'Your message'}).innerText()).trim(),'E b')
  await clickValue('Speak');assert.equal(await page.evaluate(()=>assistedSpeech.at(-1)),'E b')
  // Even registered ordinary buttons must be excluded in assisted mode.
  await page.evaluate(async()=>{
   const {dwell}=await import(performance.getEntriesByType('resource').find(entry=>entry.name.includes('/src/lib/dwell.ts')).name)
   const button=document.createElement('button');button.dataset.gazeId='unsafe-small-key';button.textContent='Small key';button.style.cssText='position:fixed;left:10px;top:10px;width:180px;height:40px;z-index:80'
   document.querySelector('[data-gaze-scope="assisted"]').appendChild(button)
   assistedTest.unsafeSelected=false
   assistedTest.unregister=dwell.register('unsafe-small-key',{onSelect:()=>assistedTest.unsafeSelected=true})
   assistedTest.timer=setInterval(()=>{const service=assistedTest.service;service.handleMetrics({ear:.3,blink:0,yawDeg:0,pitchDeg:0,cx:.5,cy:.5,size:.3,eyesClosed:false,glare:false});service.handleRawGaze({x:100,y:30})},33)
  })
  await page.waitForTimeout(2300)
  assert.equal(await page.evaluate(()=>assistedTest.unsafeSelected),false,'ordinary small buttons must not arm in assisted mode')
  await page.evaluate(()=>{clearInterval(assistedTest.timer);assistedTest.unregister();document.querySelector('[data-gaze-id="unsafe-small-key"]').remove()})
  // Small windows must not silently arm undersized gaze choices.
  await page.evaluate(()=>assistedTest.service.checkViewport=()=>{})
  await page.setViewportSize({width:320,height:900})
  await page.evaluate(()=>document.documentElement.style.fontSize='150%')
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
  await page.getByText(/This window is too small/).waitFor()
  assert.equal(await page.locator('[data-gaze-assisted][data-gaze-disabled="true"]').count(),2)
  await page.evaluate(()=>assistedTest.service.stopTracking())
  assert.deepEqual(errors,[])
  console.log('PASS: 148 px assisted readiness, two large targets, gaze typing E with 148 px offset, no cascade, Space/Delete/Undo/Speak and narrow-layout protection')
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)})
