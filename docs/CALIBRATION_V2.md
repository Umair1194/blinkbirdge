# Calibration v2 — 1 November 2026

Implemented after repeated real-user check failures, including reported mean errors of 548 px and 127 px. Those screenshots establish that the earlier version failed; they do not identify a single proven hardware or algorithmic cause. The changes below address specific weaknesses in the implementation without relaxing the existing acceptance thresholds.

## Model fitting

`personalModel.ts` evaluates six feature families, from averaged iris positions to combinations of both eyes, eyelids and gaze cues. It chooses a feature family and ridge penalty using leave-one-screen-location-out cross-validation. Means and feature scaling are fitted inside each fold. Repeated visits to the same location share a fold, and targets have balanced weight regardless of how many camera frames they contributed.

Robust per-target feature medians help preserve positional signal, while individual frames penalize models that amplify within-target noise. A simpler model wins when the score difference is marginal. Head position is not allowed to become an accidental proxy for screen position in these candidates; the existing head-motion selection gate remains in effect. This is a model-selection strategy, not proof that any particular family will improve this user's camera measurements.

## Capture and refinement

- Train on 13 locations, including four interior locations that the earlier 3×3 grid did not sample.
- Show only one active dot. Read its rendered viewport position after the UI commits and use that position for training/check labels.
- Allow 1.2 seconds to settle and at least 2 seconds to collect. Require 24 usable frames at the dot, extending collection when necessary. A bounded timeout retries that dot once rather than immediately discarding the entire run.
- Check five independent locations after the initial fit.
- If the check fails, collect five explicit additional training visits and refit once.
- Evaluate the refined model at five different check locations that were not used for training. Only the fresh check controls the final result.
- Keep the existing mean, median, percentile, target-count and frame-count acceptance thresholds. A failed final check keeps eye selection disabled.

Allow about 60 seconds initially, or about 90 seconds when refinement is required. Slow or interrupted capture can take longer.

## Feedback

The result reports the worst screen region and distinguishes consistent displacement from variation at that target. It also states when refinement was attempted. On failure, **Save tracking report** downloads JSON containing error measurements, model/engine diagnostics, browser identity and viewport information. It includes no camera frames, video or raw eye feature vectors. No report is uploaded automatically.

## Verification

- `npm run check`: TypeScript and production build.
- `npm test`: 13 tests, including generalisation to unseen synthetic locations with nuisance features and a nonlinear iris mapping.
- `npm run test:calibration`: rendered-dot coordinate agreement; capture retry; 13-point training plus five refinement visits; a fresh final holdout; both recovery and continued rejection; actual frame-count waiting and timeout cleanup; report export; narrow enlarged-text results layout.
- `npm run test:tracking`: stable fixation, target changes, repeat lock, rejection of scattered estimates/head movement/closed eyes, deliberate blink selection, failed calibration and viewport invalidation.
- `npm run test:browser`: general app flows and responsive layouts.

Browser tests use simulated eye input or mocked camera-facing methods. They do not measure the user's real eye-tracking accuracy. The next useful real-device test is one complete new calibration after a full refresh. If it still fails, the tracking report provides substantially more evidence for the next investigation than a single average-error screenshot.
