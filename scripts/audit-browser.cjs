// Run with a local preview server; install a browser with npx playwright install chromium.
const BASE = process.env.APP_URL || "http://127.0.0.1:8443"
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")
const assert = require("node:assert/strict")
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem("gesture-playground:onboarded", "true")
    localStorage.setItem("gesture-playground:guideSeen", "true")
    window.testSpeech = { utterances: [], cancelled: 0 }
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          { voiceURI: "test", name: "Test Voice", lang: "en-US" },
        ],
        addEventListener() {},
        removeEventListener() {},
        cancel() {
          window.testSpeech.cancelled++
        },
        resume() {},
        speak(u) {
          window.testSpeech.utterances.push(u)
          u.onstart?.()
        },
      },
    })
  })
  await page.goto(BASE + "/#/workspace")
  await page.keyboard.type("hello")
  assert.match(await page.getByRole("textbox").innerText(), /Hello/)
  await page.getByRole("button", { name: "Speak", exact: true }).click()
  assert.equal(
    await page.evaluate(() => testSpeech.utterances.at(-1).text),
    "Hello",
  )
  await page.getByRole("button", { name: "Stop speaking" }).click()
  await page.getByRole("button", { name: "Speak", exact: true }).click()
  await page.evaluate(() => testSpeech.utterances[0].onend())
  assert.equal(
    await page.getByRole("button", { name: "Stop speaking" }).count(),
    1,
  )
  await page.evaluate(() =>
    testSpeech.utterances.at(-1).onerror({ error: "not-allowed" }),
  )
  await page.getByRole("alert").first().waitFor()
  assert.equal(
    await page.getByRole("button", { name: "Speak", exact: true }).count(),
    1,
  )
  await page.getByRole("button", { name: "Save as phrase" }).click()
  await page.getByRole("button", { name: "Save to history" }).click()
  await page.getByRole("button", { name: "Clear", exact: true }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.waitFor()
  for (let i = 0; i < 7; i++) await page.keyboard.press("Tab")
  assert.equal(
    await page.evaluate(
      () => !!document.activeElement.closest('[role="dialog"]'),
    ),
    true,
  )
  await page.getByRole("button", { name: "Yes, clear" }).click()
  assert.match(await page.getByRole("textbox").innerText(), /Your words/)
  await page.getByRole("button", { name: "Undo", exact: true }).first().click()
  assert.match(await page.getByRole("textbox").innerText(), /Hello/)
  await page.goto(BASE + "/#/phrases")
  assert.equal(await page.getByText("Hello", { exact: true }).count(), 1)
  await page.goto(BASE + "/#/history")
  assert.equal(await page.getByText("Hello", { exact: true }).count(), 1)
  await page.goto(BASE + "/#/workspace")
  await page.getByRole("button", { name: "Quick guide" }).click()
  await page.getByRole("dialog").waitFor()
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab")
  assert.equal(
    await page.evaluate(
      () => !!document.activeElement.closest('[role="dialog"]'),
    ),
    true,
  )
  await page.keyboard.press("Escape")
  // Corrupt persisted state must recover to safe defaults without a render crash.
  await page.evaluate(() => {
    localStorage.setItem(
      "gesture-playground:settings",
      JSON.stringify({
        layout: "broken",
        speechRate: null,
        keySize: "invalid",
        uiScale: 900,
      }),
    )
    localStorage.setItem("gesture-playground:phrases", "null")
    localStorage.setItem(
      "gesture-playground:history",
      '[{"id":"bad","createdAt":null}]',
    )
  })
  await page.reload()
  await page.getByRole("group", { name: "Letter keyboard" }).waitFor()
  const overflow = []
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of [
      "welcome",
      "workspace",
      "settings",
      "keyboard",
      "help",
      "phrases",
      "history",
      "setup",
      "calibrate",
    ]) {
      await page.goto(BASE + "/#/" + route)
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "150%"),
      )
      await page.waitForTimeout(100)
      const dims = await page.evaluate(() => ({
        w: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      if (dims.scroll > dims.w + 1) overflow.push({ width, route, ...dims })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(BASE + "/#/workspace")
  await page.getByRole("button", { name: "Start Demo Mode" }).click()
  await page.locator('[data-gaze-id="ws-k-q"]').hover()
  await page.waitForTimeout(1400)
  assert.match(await page.getByRole("textbox").innerText(), /Q/)
  const beforePause = await page.getByRole("textbox").innerText()
  await page.keyboard.press("Alt+p")
  await page.locator('[data-gaze-id="ws-k-w"]').hover()
  await page.waitForTimeout(1400)
  assert.equal(await page.getByRole("textbox").innerText(), beforePause)
  await page.keyboard.press("Alt+p")
  await page.mouse.move(0, 0)
  const cameraCancellation = await page.evaluate(async () => {
    const { GazeService } = await import("/src/engine/gazeService.ts")
    const service = new GazeService()
    const devices = navigator.mediaDevices
    const original = devices.getUserMedia
    let resolveRequest
    let released = false
    devices.getUserMedia = () =>
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    try {
      const pending = service.initializeCamera()
      service.stopTracking()
      resolveRequest({
        getTracks: () => [
          {
            stop() {
              released = true
            },
          },
        ],
      })
      await pending
      return { released, camera: service.getState().camera }
    } finally {
      devices.getUserMedia = original
      service.stopTracking()
    }
  })
  assert.deepEqual(cameraCancellation, { released: true, camera: "off" })
  await page.screenshot({
    path: "/tmp/blink-desktop-final.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(BASE + "/#/setup")
  await page.screenshot({ path: "/tmp/blink-camera-final.png", fullPage: true })
  assert.deepEqual(overflow, [], "Enlarged-text layouts must fit the viewport")
  assert.deepEqual(errors, [], "No runtime errors")
  console.log(
    JSON.stringify(
      {
        functional: "passed",
        speech: "mocked lifecycle, cancellation race, error recovery passed",
        enlargedTextOverflow: overflow,
        errors,
      },
      null,
      2,
    ),
  )
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
