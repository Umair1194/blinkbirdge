const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
// Load pure TypeScript modules without adding a separate test transpiler.
const cache = new Map()
function source(relative) {
  const file = path.resolve(__dirname, "..", relative)
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  new Function("require", "module", "exports", code)(
    (id) =>
      id.startsWith(".")
        ? source(
            path.relative(
              path.resolve(__dirname, ".."),
              path.resolve(path.dirname(file), id + ".ts"),
            ),
          )
        : require(id),
    module,
    module.exports,
  )
  return module.exports
}
const { sanitizeSettings, DEFAULT_SETTINGS } = source("src/lib/settings.ts")
test("invalid persisted settings recover safely", () => {
  for (const input of [null, [], "wrong", 42])
    assert.deepEqual(sanitizeSettings(input), DEFAULT_SETTINGS)
  const safe = sanitizeSettings({
    layout: "invalid",
    keySize: null,
    speechRate: Infinity,
    uiScale: 900,
    speechEnabled: "yes",
  })
  assert.deepEqual(safe, DEFAULT_SETTINGS)
})
test("valid accessibility settings survive validation", () => {
  const patch = {
    layout: "abc",
    smoothing: "off",
    uiScale: 150,
    speechRate: 1.8,
    speechEnabled: false,
    dwellMs: 1500,
  }
  assert.deepEqual(sanitizeSettings(patch), { ...DEFAULT_SETTINGS, ...patch })
})
test("storage failures do not stop the app or local reset", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage disabled")
    },
  })
  const storage = source("src/lib/storage.ts")
  assert.equal(storage.load("test", "fallback"), "fallback")
  assert.doesNotThrow(() => storage.save("test", 1))
  assert.doesNotThrow(() => storage.clearAll())
  delete globalThis.localStorage
})
test("word predictions complete prefixes and remain unique", () => {
  const { suggest, learnWords, clearLearnedWords } =
    source("src/lib/predict.ts")
  learnWords("zebra")
  assert.ok(suggest("zeb").includes("zebra"))
  clearLearnedWords()
  for (const text of ["", "hel", "I would "]) {
    const words = suggest(text)
    assert.ok(words.length <= 5)
    assert.equal(words.length, new Set(words).size)
  }
})
test("sentence case and shift obey explicit preferences", () => {
  const { nextIsUpper } = source("src/lib/composer.ts")
  assert.equal(nextIsUpper("", "sentence", false), true)
  assert.equal(nextIsUpper("Hello. ", "sentence", false), true)
  assert.equal(nextIsUpper("Hello ", "sentence", false), false)
  assert.equal(nextIsUpper("Hello ", "upper", true), false)
})
test("ridge calibration recovers a known screen mapping", () => {
  const { fitRidge, predictRidge } = source("src/engine/ridge.ts")
  const samples = Array.from({ length: 60 }, (_, i) => {
    const a = i % 10,
      b = Math.floor(i / 10)
    return {
      features: new Float64Array([a, b]),
      x: 50 + 80 * a,
      y: 30 + 90 * b,
      weight: 1,
      group: i % 9,
    }
  })
  const model = fitRidge(samples, 0.0001)
  assert.ok(model)
  const point = predictRidge(model, new Float64Array([4, 2]))
  assert.ok(Math.abs(point.x - 370) < 1)
  assert.ok(Math.abs(point.y - 210) < 1)
})

test('camera filtering rejects isolated spikes and reduces resting jitter at different frame rates', () => {
  const { GazeFilter } = source('src/engine/smoothing.ts')
  for (const fps of [15, 30, 60]) {
    const filter = new GazeFilter(); filter.setLevel('high')
    let rawEnergy=0, filteredEnergy=0
    for (let i=0;i<fps*4;i++) {
      const noise=35*Math.sin(i*2.1)+12*Math.sin(i*.73)
      const point=filter.push(500+noise,300-noise*.6,i*1000/fps)
      if(i>fps) {rawEnergy+=noise*noise;filteredEnergy+=(point.x-500)**2}
    }
    assert.ok(filteredEnergy<rawEnergy*.15, `jitter attenuation at ${fps} fps`)
  }
  const filter=new GazeFilter()
  for(let i=0;i<20;i++)filter.push(500,300,i*33)
  const spike=filter.push(1300,800,660)
  assert.ok(Math.hypot(spike.x-500,spike.y-300)<1)
})

test('filter follows an intentional gaze change without perpetual output-lag acceleration', () => {
  const {GazeFilter}=source('src/engine/smoothing.ts');const filter=new GazeFilter()
  for(let i=0;i<30;i++)filter.push(400,300,i*33)
  let point
  // The requested slow cursor now has an explicit speed limit; allow 1.15 s to settle.
  for(let i=30;i<65;i++)point=filter.push(600,300,i*33)
  assert.ok(Math.abs(point.x-600)<15, `settled position ${point.x}`)
  assert.equal(point.y,300)
  assert.ok(Number.isFinite(filter.push(NaN,Infinity,2000).x))
})

test('fixation requires distinct stable frames and rejects scanning between targets', () => {
  const {FixationTracker}=source('src/engine/fixation.ts');const fixation=new FixationTracker()
  for(let i=0;i<20;i++)assert.equal(fixation.push(100,100,0,30),false)
  let stable=false
  for(let i=1;i<=9;i++)stable=fixation.push(100+Math.sin(i)*5,100,i*33,30)
  assert.equal(stable,true)
  fixation.reset()
  for(let i=0;i<20;i++)assert.equal(fixation.push(i*30,100,i*33,30),false)
  fixation.reset()
  assert.equal(fixation.push(100,100,2000,30),false)
})

test('incomplete or poor independent calibration never enables eye selections', () => {
  const {calibrationUsable}=source('src/engine/trackingQuality.ts')
  const good={meanErrorPx:35,medianErrorPx:30,p90ErrorPx:60,targets:5,validSamples:60}
  assert.equal(calibrationUsable(good),true)
  for(const patch of [{targets:4},{validSamples:20},{meanErrorPx:150},{medianErrorPx:90},{p90ErrorPx:250},{meanErrorPx:NaN}])assert.equal(calibrationUsable({...good,...patch}),false)
  assert.equal(calibrationUsable(null),false)
})

test('fixation remains usable at ten distinct camera frames per second', () => {
  const {FixationTracker}=source('src/engine/fixation.ts');const fixation=new FixationTracker()
  let stable=false
  for(let i=0;i<5;i++)stable=fixation.push(100+Math.sin(i),100,i*100,30)
  assert.equal(stable,true)
})

test('personal gaze model ignores nuisance features and generalises to unseen targets', () => {
  const {fitPersonal,predictPersonal}=source('src/engine/personalModel.ts')
  const {FEATURE_SCALE_FLOORS}=source('src/engine/faceMetrics.ts')
  const locations=[[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1],[-.5,-.5],[.5,.5],[-.5,.5],[.5,-.5]]
  const make=(u,v,noise=0)=>{
    const f=new Float64Array(25)
    for(let j=0;j<f.length;j++)f[j]=Math.sin(j*1.7+u*3-v*2+noise*31)*.2
    f[8]=u*.1+noise;f[9]=v*.07+noise*.5
    f[20]=f[8]**2;f[21]=f[9]**2;f[22]=f[8]*f[9]
    return f
  }
  const samples=locations.flatMap(([u,v],group)=>Array.from({length:24},(_,i)=>({features:make(u,v,.001*Math.sin(i*2.1)),x:700+400*u,y:450+250*v,group,weight:1})))
  const started=performance.now();const model=fitPersonal(samples,FEATURE_SCALE_FLOORS)
  assert.ok(model);assert.ok(model.indices.length<=5)
  for(const [u,v] of [[.3,-.3],[-.7,.6],[.8,.2]]){
    const predicted=predictPersonal(model,make(u,v))
    assert.ok(Math.hypot(predicted.x-(700+400*u),predicted.y-(450+250*v))<15)
  }
  assert.ok(performance.now()-started<5000,'model search should remain practical')
})

test('personal calibration can select a nonlinear iris mapping without using check targets', () => {
  const {fitPersonal,predictPersonal}=source('src/engine/personalModel.ts')
  const {FEATURE_SCALE_FLOORS}=source('src/engine/faceMetrics.ts')
  const make=(u,v)=>{const f=new Float64Array(25);f[8]=u*.1;f[9]=v*.1;f[20]=f[8]**2;f[21]=f[9]**2;f[22]=f[8]*f[9];return f}
  const screen=(u,v)=>({x:700+350*u+100*u*v,y:450+230*v+90*u*u})
  const samples=[];let group=0
  for(const u of [-1,-.5,0,.5,1])for(const v of [-1,0,1]){
    for(let i=0;i<12;i++)samples.push({features:make(u,v),...screen(u,v),weight:1,group})
    group++
  }
  const model=fitPersonal(samples,FEATURE_SCALE_FLOORS);assert.ok(model)
  const predicted=predictPersonal(model,make(.3,-.4)),expected=screen(.3,-.4)
  assert.ok(Math.hypot(predicted.x-expected.x,predicted.y-expected.y)<10)
})

test('narrow open eyes learn their own baseline without being treated as closed', () => {
  const {EyeOpenness}=source('src/engine/eyeOpenness.ts');const profile=new EyeOpenness()
  for(let i=0;i<60;i++)assert.equal(profile.update(.045+Math.sin(i)*.002,.75),false)
  assert.ok(profile.getBaseline()<.06)
  assert.equal(profile.update(.006,.95),true)
  assert.equal(profile.update(.045,.75),false)
})

test('head position uses the observed final-check range and ignores pose-only noise', () => {
  const {HeadStability}=source('src/engine/headStability.ts');const stability=new HeadStability()
  const face=(patch={})=>({cx:.5,cy:.5,size:.3,yawDeg:0,pitchDeg:0,eyesClosed:false,...patch})
  stability.calibrate(Array.from({length:60},(_,i)=>({cx:.5+.005*Math.sin(i),cy:.5,size:.3,yaw:0,pitch:Math.sin(i)*8})))
  for(let i=0;i<100;i++){stability.push(face({pitchDeg:9+Math.sin(i)*2,cx:.505}),i*33);assert.equal(stability.moved,false);assert.equal(stability.selectionSafe,true)}
  for(let i=100;i<150;i++)stability.push(face({cx:.65}),i*33)
  assert.equal(stability.moved,true);assert.equal(stability.selectionSafe,false)
  for(let i=150;i<190;i++)stability.push(face(),i*33)
  assert.equal(stability.moved,false)
})

test('high smoothing bounds camera motion across a large jump and a short dropout', () => {
  const {GazeFilter}=source('src/engine/smoothing.ts');const filter=new GazeFilter()
  filter.push(200,200,0)
  let previous={x:200,y:200}
  for(let i=1;i<25;i++){const point=filter.push(1200,700,i*33);assert.ok(Math.hypot(point.x-previous.x,point.y-previous.y)<=1800*.033+.001);previous=point}
  const recovered=filter.push(1200,700,1400)
  assert.ok(Math.hypot(recovered.x-previous.x,recovered.y-previous.y)<=180.001)
})

test('iris height is normalised to each eye opening rather than a universal eye shape', () => {
  const {gazeFeatures}=source('src/engine/faceMetrics.ts')
  const make=opening=>{
    const p=Array.from({length:478},()=>({x:0,y:0}))
    p[33]={x:100,y:100};p[133]={x:140,y:100};p[362]={x:200,y:100};p[263]={x:240,y:100}
    p[159]={x:120,y:100-opening/2};p[145]={x:120,y:100+opening/2}
    p[386]={x:220,y:100-opening/2};p[374]={x:220,y:100+opening/2}
    p[468]={x:122,y:100+opening*.3};p[473]={x:222,y:100+opening*.3}
    return gazeFeatures(p,[],{yaw:0,pitch:0,roll:0},{cx:.5,cy:.5,size:.3})
  }
  const narrow=make(2.4),wide=make(12);assert.ok(narrow&&wide)
  assert.ok(Math.abs(narrow[27]-wide[27])<1e-8)
  assert.ok(Math.abs(narrow[27]-.3)<1e-8)
})

test('accuracy measurement can bypass the display speed limit without changing the slow cursor profile', () => {
  const {GazeFilter}=source('src/engine/smoothing.ts');const displayed=new GazeFilter(),measured=new GazeFilter()
  displayed.push(100,100,0);measured.push(100,100,0)
  let visual,measurement
  for(let i=1;i<=40;i++){visual=displayed.push(1000,100,i*33,true);measurement=measured.push(1000,100,i*33,false)}
  assert.ok(visual.x>980,'a sustained gaze shift should reach the new fixation without seconds of lag')
  assert.ok(measurement.x>980,'the check should assess settled model error rather than intentional cursor lag')
})

 test('one-pass calibration requires all nine targets and a finite model-consistency estimate',()=>{
 const {calibrationFitUsable}=source('src/engine/trackingQuality.ts')
 const fit={points:9,samples:216,cvErrorPx:50}
 assert.equal(calibrationFitUsable(fit),true)
 for(const patch of [{points:8},{samples:50},{cvErrorPx:null},{cvErrorPx:NaN},{cvErrorPx:180}])assert.equal(calibrationFitUsable({...fit,...patch}),false)
 })
 test('confirmed gaze shifts settle quickly without allowing isolated spikes',()=>{
 const {GazeFilter}=source('src/engine/smoothing.ts');const f=new GazeFilter()
 for(let i=0;i<10;i++)f.push(200,200,i*33)
 const spike=f.push(1200,700,330);assert.ok(Math.hypot(spike.x-200,spike.y-200)<1)
 let point
 for(let i=11;i<35;i++)point=f.push(1200,700,i*33)
 assert.ok(Math.hypot(point.x-1200,point.y-700)<30,'settle a 1,100 px shift in under 800 ms')
 })
