import type { CalibrationFit, ValidationResult } from './types'

/** These are safety thresholds, not a claim of individual-key accuracy. */
export function calibrationUsable(validation: ValidationResult | null) {
  return !!validation && validation.targets >= 5 && validation.validSamples >= 30
    && Number.isFinite(validation.meanErrorPx) && validation.meanErrorPx <= 100
    && Number.isFinite(validation.medianErrorPx) && validation.medianErrorPx <= 75
    && Number.isFinite(validation.p90ErrorPx) && validation.p90ErrorPx! <= 180
}

/** One-pass readiness uses held-out-target training folds, not a second dot pass.
 * This is a model-consistency gate, not independently measured accuracy. */
export function calibrationFitUsable(fit: CalibrationFit | undefined) {
  return !!fit && fit.points >= 9 && fit.samples >= 108
    && typeof fit.cvErrorPx === 'number' && Number.isFinite(fit.cvErrorPx)
    && fit.cvErrorPx >= 0 && fit.cvErrorPx <= 100
}
