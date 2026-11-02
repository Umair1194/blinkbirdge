# Personal eye tracking and precision letters — 1 November 2026

This update addresses the reported false position warning and neighbouring-letter selections. The reference page was inspected through its visible interface; its actual camera accuracy was not measured.

## Corrections

**Position reference.** The previous service compared current measurements with a fixed average from the training run and immediately rejected small deviations. The new reference and tolerance range come from the final accuracy check. A rolling median rejects single-frame pose spikes. A sustained translation, distance change or corroborated rotation is required before marking a position change. Small pose-only variation is insufficient. Genuine sustained movement still pauses selection. The warning now describes changed measurements instead of asserting that the user moved.

**Eye opening and geometry.** A session-specific eyelid-opening baseline replaces the absolute EAR cutoff. A high blink blendshape score alone cannot classify naturally narrow open eyes as closed. New candidate features express iris height relative to each eye's own lid opening. Training-target cross-validation decides whether those features help this person; they are not forced when they perform worse. No demographic or face-category classification is used. The camera still needs enough eye pixels and usable landmarks.

**Cursor speed.** High smoothing limits webcam cursor motion to 320 CSS pixels per second, with stronger response limits at lower smoothing levels as well. Short tracking gaps preserve the prior position rather than immediately snapping to the next estimate. Simulation remains responsive. Calibration measurements bypass the cursor speed limit so intentional display lag does not falsely inflate the accuracy check.

**Precision confirmation.** Eye selection of an alphabet key opens nine nearby letters as enlarged choices, leaving the message unchanged. A deliberate gaze move is required before those choices arm; a panel appearing beneath a resting gaze cannot silently type its newly positioned letter. A second selection types the exact letter. More letters cycles through alphabet groups when the desired letter is outside the nearby choices. Physical clicks type directly. This option can be changed under Keyboard settings.

A coarse first-stage estimate is not used for adaptive model learning. This prevents a mistaken R estimate from teaching the model that the user intended R while they were actually looking at E.

## Verification

- Production build and TypeScript checks pass.
- 18 core tests include narrow-eye opening, eye-opening-relative geometry, pose-only noise, genuine position changes, and bounded movement after large jumps/dropouts.
- Precision browser tests verify use of the final-check posture instead of a different old training average; no character from the initial neighbouring-key estimate; no automatic character from resting on the new panel; intentional E confirmation; and direct physical typing.
- The existing tracking, calibration and general browser suites cover fixation, deliberate blinks, head-movement safety, accuracy rejection, frame capture, independent refinement checks, speech and responsive layouts.

These are simulated-input and software checks. They do not prove pixel-perfect tracking for the user's physical webcam. Enlarged confirmation is an accuracy aid when raw gaze uncertainty overlaps small adjacent keys, not evidence that the camera can resolve every original key directly.

## Use

Fully refresh localhost and run one fresh calibration to collect the new personal measurements. The steadier profile sets high smoothing and at least a 1.2-second hold once for existing installations. Precision confirmation defaults on; an explicit saved off preference is respected.

Look at the approximate keyboard letter, then select the exact letter in the enlarged panel. If no letter highlights, briefly look at the panel heading first. More letters provides the remaining alphabet groups. If tracking is still inaccurate, save the tracking report from calibration; no camera images are included or uploaded automatically.
