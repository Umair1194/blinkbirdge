# Nine-point calibration

The calibration flow now uses nine training locations in a 3×3 grid, followed by one independent five-location accuracy check. It no longer automatically adds training or a second check after an inaccurate result.

Each training dot allows 650 ms to shift attention, then captures at least 1,000 ms and 24 distinct camera samples. Each check dot allows 700 ms to settle and measures for 800 ms. Nominal active time is about 23 seconds; the interface estimates 25–35 seconds to allow for rendering and frame acquisition. Low camera frame rates, capture retries and visibility pauses can take longer. The initial automatic-start countdown is separate.

If eyes disappear long enough to interrupt capture, completed dots are retained. Once a visible, facing, open-eyed face is stable for a second, only the interrupted dot is recaptured. That training group's partial samples are cleared before recapture. Stop, restart and viewport changes cancel the pending run.

The overall progress bar spans both training and checking. Training capture still waits for actual frames. Accuracy thresholds have not been relaxed: failed independent checks keep eye selection off and provide measurements and a downloadable report. A shorter process cannot guarantee accurate single-letter selection on every webcam; the existing enlarged-letter confirmation remains available.

The reference site was inspected again on 2 November 2026. It visibly reports nine calibration points, but its camera preview reported unavailable media and eyes not detected in the test browser. Its real gaze accuracy could not be verified.

Validation: TypeScript, production build and 18 core tests pass. The calibration browser suite covers nine training points, matching visible target coordinates, capture retry, current-dot resume after interruption, a single independent check, both accepted and rejected results, report export, and narrow layouts with enlarged text. Tracking and precision tests use synthetic camera/gaze data; personal real-camera accuracy requires a user trial.

Regression results: tracking, precision keyboard, responsive layout and mocked speech browser checks passed. The precision suite timed out once when run alongside another browser suite, then passed when rerun alone; it is not claimed to be free of timing sensitivity.
