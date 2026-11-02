import type { ValidationResult } from './types'

/** These are safety thresholds, not a claim of individual-key accuracy. */
export function calibrationUsable(validation: ValidationResult | null) {
  return !!validation && validation.targets >= 5 && validation.validSamples >= 30
    && Number.isFinite(validation.meanErrorPx) && validation.meanErrorPx <= 100
    && Number.isFinite(validation.medianErrorPx) && validation.medianErrorPx <= 75
    && Number.isFinite(validation.p90ErrorPx) && validation.p90ErrorPx! <= 180
}
