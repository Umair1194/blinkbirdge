# Calibration mapping follow-up — 3 November 2026

The reported session captured 265 frames across nine dots but had a 301 px cross-validation estimate. That is a completed, rejected calibration, not a frozen progress screen. The screenshot does not contain the session's feature samples, so its exact underlying cause cannot be reproduced from the image alone.

Changes:

- Compare separate horizontal and vertical feature models against the existing joint model using the same held-out-target folds. Different axes can choose different eye/iris/lid cues, avoiding a forced common feature family when one cue is weak. The combined model is used only when its cross-validation score improves. Targets retain equal influence at different camera frame rates.
- Require a five-frame stable iris window before accepting a labelled calibration frame. Moving, invalid, closed-eye and facing-away frames reset or fail that window. Existing frame-count and outlier checks remain.
- For single-pass calibration, anchor the head-position reference to the final 48 capture frames instead of the whole session. The legacy independent-check path still uses its observed check reference.
- Include the current single-pass model fit in diagnostics and add a camera-setup action on rejected results.

The nine-dot single pass, 100 px readiness threshold, fixation requirements, and enlarged-letter confirmation remain. No second target sequence was introduced and no inaccurate result is silently marked ready.

Verification: TypeScript and production build pass; 22 core tests pass, including noisy mixed-axis cues and transition-frame rejection. All four browser suites passed: calibration, tracking, precision selection, and responsive/speech flows. Speech and camera/gaze input are mocked in those browser checks.

On a controlled synthetic dataset with a reliable horizontal blendshape and vertical aperture cue, the previous shared-feature model scored approximately 274 px; separate-axis selection scored below 1 px. This demonstrates the model limitation and regression coverage, not real-world webcam accuracy or a measured improvement to the user's 301 px session. A fresh personal camera trial is required. If it still fails, the saved tracking report can show the selected model, frame rate, capture count and consistency estimate without camera images.
