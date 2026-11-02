# BlinkBridge app audit — 31 October 2026

## Outcome and scope

Reviewed the React shell, all nine routes, settings and persistence, typing and prediction, speech synthesis, camera permissions and device switching, MediaPipe startup and cleanup, calibration, gaze selection, modal interactions, and responsive styling. Implemented the corrections below and added repeatable checks. This is a source review and Chromium browser audit, not a certification that every browser, device or assistive technology has no defects.

The existing voice feature is **text-to-speech**: it reads typed or saved messages aloud. It does not record the microphone or transcribe speech.

## Findings corrected

| Area | Finding | Correction |
| --- | --- | --- |
| Speech | An old utterance could clear the speaking state of a newer message after cancellation. | Retain the current utterance and ignore stale callbacks; invalidate it before Stop. |
| Speech | Browser audio errors were invisible. | Show actionable errors in the speech panel and global notifications, including direct-click guidance when audio is blocked. |
| Speech | A synthesis exception could escape the handler. | Catch synthesis startup errors and return to an actionable state. |
| Speech | Voice lists can arrive asynchronously; saved voices may no longer exist. | Listen for voice changes, retry loading, resolve the voice against the live list, and fall back to the system voice. |
| Speech | Persisted speed could be invalid. | Validate stored speed and clamp the synthesis rate to the supported UI range. |
| History | The opt-in history setting promised to save spoken messages but only covered the composer. | Apply the preference consistently to messages spoken from workspace, saved phrases and history. |
| Speech | Turning speech off did not stop an utterance already playing. | Stop speech when disabled and cancel synthesis on provider cleanup. |
| Mobile navigation | The desktop sidebar consumed much of a narrow viewport. | Use a horizontally scrollable icon navigation bar on mobile, with accessible names on every link. |
| Workspace | Fixed-height layout, notices and action groups overflowed small screens. | Allow document scrolling on mobile, wrap actions, and reduce keyboard spacing while preserving the existing layout. |
| Enlarged text | Settings rows, control groups, headings and header actions exceeded the viewport. | Constrain control widths, stack settings rows earlier, wrap controls and headers, and allow long headings to break. |
| Camera setup | The placeholder overlay could clip instructions and the permission button inside a fixed video aspect ratio. | Put the placeholder in normal document flow; reserve video framing for the live preview. |
| Help/calibration | FAQ rows and calibration result screens could clip larger content. | Use expandable row height and scrollable calibration content. |
| Dialogs | Keyboard focus could leave modal dialogs; background scrolling remained possible. | Trap Tab and Shift+Tab, preserve focus on close, lock body scrolling, and constrain dialog height. Apply equivalent handling to the quick guide. |
| Keyboard access | Segmented radio controls lacked arrow-key navigation. | Add roving tab focus, arrows, Home and End. Add a skip-to-content link. |
| Physical typing | Composition events and typing behind a modal could affect the composer. | Ignore composition/default-prevented events and physical composer input while a modal is open. |
| Persistence | JSON was trusted based on TypeScript casts. Invalid settings or malformed messages could crash rendering. | Validate settings, message records, history source and dates, and persisted booleans at startup. |
| Privacy/reset | Clearing local data left the current message, undo stack, session statistics, learned words and active camera/speech in memory. | Reset those states and release tracking and speech resources. Handle browsers that deny localStorage access. |
| Camera lifecycle | A permission request resolving after Stop or a mode switch could reacquire the camera. | Invalidate older requests and immediately stop late streams. |
| Camera switching | Stopping an adapter during camera switching left the engine marked running, preventing restart. | Set the stopped webcam engine to idle before restarting with the new stream. |
| MediaPipe lifecycle | Asynchronous model loading or engine recreation could finish after Stop. | Check generation tokens and close resources from obsolete startup/recreation work. |
| Calibration | Delay abort listeners accumulated; unexpected calibration errors could escape. | Remove listeners after delays resolve and present a recoverable calibration failure. |
| Gaze selection | Stale targets could select during a tracking interruption; hidden-tab selection was possible. | Require a live, matching gaze target for dwell activation, suspend activation in hidden documents, check blink target visibility/lock, and clear stale learning/selection state on reset. |
| Local development | The Figma-only site configuration file was absent, blocking builds. | Use hosted configuration when present and provide a local metadata fallback. Replace deprecated Vite configuration path handling. |
| Motion | The operating-system reduced-motion preference covered only two animations. | Apply the preference to animations and transitions throughout the UI. |

## Verification

- `npm run check`: TypeScript validation and optimized Vite production build.
- `npm test`: six regression tests covering malformed settings, valid accessibility preferences, unavailable storage, prediction uniqueness, sentence/shift rules, and recovery of a known coordinate mapping by the calibration regression model.
- Browser page sweep: all nine routes at 320, 375, 768, 1024 and 1440 pixels at normal text size, with no document horizontal overflow or JavaScript page errors.
- Browser enlarged-text sweep: the same nine routes and five widths at 150% root text size, with no document horizontal overflow or JavaScript page errors.
- Browser functional checks: physical typing; phrase/history saving and reading; clear/undo; modal focus containment; guide close; recovery from corrupt persisted data; speech lifecycle and error recovery using a mocked synthesis engine; demo gaze selection and paused selection prevention; late camera-request stream cleanup using a mocked camera request.
- Visual inspection of mobile workspace, mobile camera setup and desktop workspace captures.
- Dependency audit during installation reported zero known vulnerabilities in the installed dependency set. This does not establish that all dependency code is safe.

## Running checks

Use `npm run check` and `npm test` for checks that do not need a browser. For the optional browser suite, provide Playwright in your development environment and install its Chromium browser, start the local app, then run `npm run test:browser`.

The browser script accepts `APP_URL`, `PLAYWRIGHT_MODULE`, and `BROWSER_EXECUTABLE` for environments with an existing automation runtime. It uses isolated browser storage and mocked speech/camera requests; it does not request access to the real camera.

The pinned `oxfmt@0.2.x` formatter produced invalid TypeScript for compact object types during this audit. Those changes were repaired and all source checks pass. Upgrade and validate the formatter before running broad automatic formatting; it is not part of the successful verification commands above.

No additional runtime dependency is required by these fixes. The existing pnpm lockfile is preserved. An attempted lockfile verification was blocked by the environment's minimum-release-age policy for the project's existing `lucide-react@1.66.0` version; that policy was not weakened. No browser dependency was added to the manifest as a result.

## Remaining real-device validation

1. **Audible output:** In a supported browser on the target device, type a short and then a long message. Click Speak, listen through the intended output device, Stop, switch voices and rates, and retry through saved phrases/history. Repeat using gaze after a direct audio-enabling click. Available voices and audio permission behavior belong to the browser/operating system.
2. **Webcam tracking:** Allow and deny camera access; verify calibration, deliberate blink selection, face loss, reconnect, camera switching and repeated setup/stop cycles with real hardware. Test glasses, lighting, device movement and slower devices. Synthetic math and lifecycle tests do not measure a person's actual gaze accuracy.
3. **Browser/device matrix:** Repeat core flows in Safari/iOS Safari, Firefox, Android Chrome and the Figma embedded preview. Embedded camera policies and speech activation may differ. This run used desktop Chromium with emulated viewports, not physical mobile devices.
4. **Assistive technology:** Check screen-reader announcements and switch/keyboard operation with the users' actual setup. A narrow portrait keyboard necessarily offers smaller targets than the desktop eye-tracking layout. Configuration, phrase editing and document scrolling still have some helper-operated native controls; the app does not implement complete hands-free gaze scrolling or gaze operation of native selects/sliders.
5. **Offline and voice privacy:** UI fonts are requested from Google Fonts and fall back to system fonts when unavailable. Some browser/OS speech voices may use a network service. Camera frames and the app's calibration processing remain local, but those facts do not imply every selected speech voice is offline.

Do not treat simulated gaze, mocked synthesis, emulated viewport checks or synthetic regression accuracy as evidence of audible output or hardware gaze precision.
