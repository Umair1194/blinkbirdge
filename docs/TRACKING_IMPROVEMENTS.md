# Eye tracking changes — 1 November 2026

**Calibration has since been enhanced further.** See [Calibration v2](CALIBRATION_V2.md) for the current 13-point flow and automatic refinement. The nine-point timing below describes the earlier change.

The previous build could turn noisy estimates into rapid cursor motion and could reinforce mistaken selections. This update addresses those behaviors. It does not establish pixel-perfect accuracy from a conventional webcam; the real user's calibration and camera still determine which screen positions can be distinguished.

## Changes

- **Calmer cursor:** a five-frame median rejects isolated spikes. Smoothing uses the change between consecutive measurements instead of the gap between the measurement and the delayed cursor. Responsiveness is capped, so jitter cannot keep accelerating the cursor indefinitely. Brief missing frames do not immediately discard filter history; longer gaps reset it.
- **Fixation before clicking:** camera input must remain spatially stable for at least 220 ms across distinct camera frames before dwell starts. This is checked against raw predictions, not just the smoothed cursor. The fixation centre must be inside the highlighted target. Widely scattered raw predictions cannot qualify merely because their average appears steady.
- **Slower defaults:** high smoothing, large keys and a 1.2-second dwell. A stable fixation precedes the dwell, so an eye selection normally takes longer than 1.2 seconds. Existing default-speed preferences migrate once to the steadier profile; deliberately different speed/smoothing settings remain available. Automatic learning is turned off during that migration.
- **Less neighbour snapping:** direct hits take priority, and assist extends only over a small fraction of the target size. Assist-off requires a direct hit. A previous key cannot keep winning just because an excessively wide assist region overlaps its neighbour.
- **Conservative learning:** off by default. If enabled, learning rejects scattered samples and large corrections, uses low-weight examples and limits drift correction to 48 px. It does not learn while tracking is unsuitable for selections.
- **Better camera input:** request 1280×720 video at up to 30 fps, subject to device capabilities. Increase face/tracking confidence thresholds and reject tiny eye frames, gross disagreement between eye estimates and invalid predictions.
- **Safer head movement:** selections stop if head position, distance or rotation differs significantly from the calibrated reference. The UI asks the user to reposition. A substantial viewport resize invalidates calibration because the model predicts viewport pixels. Resizing during calibration stops that run.
- **More careful calibration:** start in the centre, alternate target positions, allow 1.1 seconds to settle at each target, and collect for 1.8 seconds. All nine targets need adequate usable data. Allow roughly 45 seconds including the check.
- **Independent check:** validation counts distinct camera estimates and excludes closed-eye samples. Its targets do not train or refit the model. The UI reports mean, median and 90th-percentile error.
- **Poor calibration does not enable eye clicks:** require all five check targets, at least 30 check estimates, mean error at most 100 px, median at most 75 px and 90th-percentile error at most 180 px. These are minimum safety thresholds, not a guarantee that small adjacent keys can be resolved. The workspace separately warns when mean error exceeds half a key's smaller dimension.

## Verification

`npm run check` checks TypeScript and the production build. `npm test` includes synthetic jitter, spike rejection, intentional motion, fixation at multiple frame rates and calibration rejection cases, alongside the earlier core tests.

`npm run test:tracking` uses synthetic camera traces through the live browser app and the actual gaze/dwell controllers. It checks migration from the old profile, stable single-key selection, an intentional move to the next key, no automatic repeat while holding a key, no clicks during scattered estimates or head movement or closed eyes, deliberate blink selection, rejection of poor calibration and invalidation on viewport resize. It does not request a real camera or measure the user's eye-tracking error.

The existing `npm run test:browser` suite checks the general application flows and enlarged-text responsive layouts. Browser scripts accept `APP_URL`, `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` for an existing Playwright installation.

## Try the updated app

1. Fully reload the localhost page so the updated defaults initialize.
2. Open Camera setup and allow access. Use steady, even front lighting and position the camera close to screen centre, around arm's length away.
3. Run a fresh calibration. Look at the small centre dot of each target and keep the head in the same comfortable position.
4. Review the accuracy summary. If it asks for another calibration, eye clicks remain off; clicking and physical typing still work.
5. In the workspace, look at one key, wait for a stable highlight and let its progress ring finish. Look away before selecting that same key again.

If the cursor is steady but consistently highlights the wrong key, that is a calibration/position error rather than a need for even slower animation. Recalibrate and compare the reported error with the visible key size. Actual webcam accuracy, lighting, glasses, head motion and device performance must still be checked by the user. Dedicated eye-tracking hardware may be needed when a webcam cannot distinguish neighbouring keys reliably.
