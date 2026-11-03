# Assisted gaze after the nine-dot pass

The reported 148 px consistency estimate is improved from the earlier screenshot's 301 px, but does not establish small-letter accuracy. Previously any estimate over 100 px led to the same rejection page. The reference was reviewed again: it exposes its keyboard after calibration/Skip even when its camera says eyes not detected. That confirms its navigation behavior, not its physical eye-tracking accuracy.

The new flow keeps exactly nine dots. Accepted results open the keyboard automatically. Fits up to 100 px use the existing keyboard; complete nine-target fits over 100 and up to 200 px use an explicitly labelled large-target assisted keyboard. Higher-error, missing or incomplete fits remain disabled. These are interface-specific heuristics, not independently validated accuracy guarantees.

Assisted mode is a fallback, not a claim that a 148 px model can accurately select small keys. It offers two large groups, narrowing to a chosen character in five selections. Space, Delete, Undo and Speak are included. Between selections, gaze must deliberately move at least 100 pixels and remain displaced for 200 ms before choices arm again; fixation, dwell, blink and head-position safeguards still apply. It is slower than direct letter selection.

Ordinary gaze targets are excluded while assisted mode is active. Target size is measured and gaze choices stay disabled when the window is too small for the model estimate. Physical clicks remain available. This gives the completed-but-coarse capture a usable route without silently enabling the normal small keyboard.

Verification covers the user's 148 px case and a simulated constant 148 px horizontal offset. This is a software test of the interface and model-status handling, not an observation of the user's real webcam. Real camera behavior still requires a fresh session.
