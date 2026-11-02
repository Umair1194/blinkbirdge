# BlinkBridge recovery — 2 November 2026

The working application was restored to `/Users/apple/Desktop/BlinkBridge` from source snapshots and recorded edits in this task's development history. No intact project backup was found. The cause of the missing source has not been established.

Most application source, including the gaze engine, calibration, keyboard, speech and application state, was recovered from those snapshots and edits. The following support files were reconstructed as compatible implementations because complete original contents were unavailable:

- `src/components/AccessibilitySettings.tsx`
- `src/components/QuickGuide.tsx`
- `src/components/DwellProgress.tsx`
- `src/components/PauseBanner.tsx`
- `src/pages/WelcomePage.tsx` (recovered helpers with reconstructed page layout)
- `src/lib/words.ts`
- `src/lib/sound.ts`
- `src/vite-env.d.ts`
- `public/favicon.svg`

MediaPipe runtime assets were restored from the installed official package, and its face-landmarker model was downloaded from Google's official model storage. Dependencies were reinstalled and a fresh npm lockfile generated. The original pnpm lockfile and unused `logo.heic`, `visual.heic` and `CLAUDE.md` were not recovered. This is a working recovery, not a byte-for-byte copy of every original file.

The partial dependency directory present before restoration is preserved at `.recovery-2026-11-02/original-node_modules`. That recovery directory also contains a source provenance/hash manifest and the edit replay log. Browser local storage was not cleared.

Before restoration, TypeScript and the production build passed, all 18 core tests passed, and automated browser, tracking, precision-selection and calibration suites passed. Browser checks included responsive layouts and mocked speech/tracking flows. These checks do not establish real webcam gaze accuracy; that requires the user's camera and personal calibration.

The recovery initially retained the previous calibration flow. The subsequent nine-point update is documented in `CALIBRATION_NINE_POINT.md`.
