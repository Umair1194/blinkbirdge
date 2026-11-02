# Single-pass nine-dot calibration

Calibration now has exactly nine target locations in one pass. There is no additional accuracy-check dot sequence and no automatic refinement round. Each dot has 650 ms to settle, followed by at least 1,000 ms and 24 distinct camera frames. Nominal capture time is about 15 seconds; the interface estimates 15–25 seconds, excluding its initial countdown. Slow cameras or visibility pauses can take longer.

Completed dots survive a visibility interruption. Only the interrupted dot is recaptured after eyes become visible and steady. A capture failure may retry the current dot once. Stop, restart and screen-size changes cancel the pending run.

Readiness is now based on the gaze model's leave-one-target-out training cross-validation estimate, with nine captured target groups and enough retained frames. This uses the same nine-dot dataset and also helps choose the model, so it is a model-consistency estimate, not an independent accuracy measurement. The result screen labels it accordingly. Incomplete, non-finite or high-error model fits keep eye selection disabled. Enlarged-letter confirmation remains available.

## Tracking responsiveness

The resting filter still uses a five-frame median and bounded smoothing to reject isolated spikes. Three agreeing recent frames can confirm a sustained gaze shift; while following it, the filter uses an 8 Hz cutoff and a maximum speed of 1,800 CSS pixels/second, returning to the resting profile near the target or when measurements disagree. This removes the previous permanent 320 pixels/second travel bottleneck while keeping one-frame jumps filtered.

Synthetic testing verifies that a sustained approximately 1,100-pixel shift settles within 30 pixels in under 800 ms at 30 FPS and that an isolated spike is rejected. This measures the filter, not physical webcam accuracy or end-to-end camera latency. Dwell and stable-fixation requirements remain deliberate to avoid accidental typing.

## Reference and verification

The reference site was revisited. It visibly uses nine dots, a filling ring and a single-target presentation. It reported eyes not detected and unavailable camera media in the test browser, so its physical gaze accuracy could not be verified or used as an accuracy benchmark.

TypeScript, production build and all 20 core tests passed. The updated calibration browser suite verifies nine groups, no validation visits, current-dot recovery, pass/fail model consistency, report export and narrow enlarged-text layouts. Real camera accuracy remains dependent on the user's camera, lighting, posture and calibration samples.
