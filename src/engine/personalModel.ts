import { fitRidge, predictRidge, type RidgeModel, type TrainingSample } from './ridge'

export interface PersonalModel {
  indices: number[]
  ridge: RidgeModel
  alpha: number
  cvErrorPx: number
  name: string
}

const CANDIDATES = [
  { name: 'iris average', indices: [8, 9] },
  { name: 'eye opening normalised', indices: [8, 27] },
  { name: 'both eye openings', indices: [0, 4, 25, 26] },
  { name: 'both eyes', indices: [0, 1, 4, 5] },
  { name: 'iris curve', indices: [8, 9, 20, 21, 22] },
  { name: 'eyes and lids', indices: [0, 1, 3, 4, 5, 7] },
  { name: 'iris and gaze cues', indices: [8, 9, 10, 11, 12, 13] },
  { name: 'eyes lids and gaze cues', indices: [8, 9, 3, 7, 10, 11, 12, 13] },
]
const ALPHAS = [.0001, .001, .01, .1, 1]
const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]

function groupsOf(samples: TrainingSample[]) {
  const groups = new Map<string, TrainingSample[]>()
  for (const sample of samples) {
    // Repeated visits to the same screen location belong to the same CV fold.
    const key = `${Math.round(sample.x)}:${Math.round(sample.y)}`
    const group = groups.get(key) ?? []
    group.push(sample)
    groups.set(key, group)
  }
  return [...groups.values()]
}

function project(features: Float64Array, indices: number[]) {
  return Float64Array.from(indices.map(index => features[index]))
}

/** Balance targets irrespective of camera FPS. Robust target centres preserve
 * positional signal; individual frames keep noisy features from gaining huge slopes. */
function balanced(groups: TrainingSample[][], indices: number[]): TrainingSample[] {
  return groups.flatMap(group => {
    const weight = group.reduce((sum, sample) => sum + sample.weight, 0) / group.length
    const centre: TrainingSample = {
      ...group[0],
      features: Float64Array.from(indices.map(index => median(group.map(sample => sample.features[index])))),
      weight,
    }
    return [centre, ...group.map(sample => ({...sample, features: project(sample.features, indices), weight: sample.weight / group.length}))]
  })
}

export function predictPersonal(model: PersonalModel, features: Float64Array) {
  return predictRidge(model.ridge, project(features, model.indices))
}

/** Use only training-target cross-validation to choose feature family and penalty.
 * Standardisation is refitted inside every fold. The independent screen check
 * remains untouched and is the final authority for enabling selections. */
export function fitPersonal(samples: TrainingSample[], floors: Float64Array): PersonalModel | null {
  const groups = groupsOf(samples)
  if (groups.length < 5) return null
  let best: PersonalModel | null = null
  for (const candidate of CANDIDATES) {
    if (candidate.indices.length >= groups.length - 1 || candidate.indices.some(index => index >= samples[0].features.length)) continue
    const scaleFloors = Float64Array.from(candidate.indices.map(index => floors[index]))
    for (const alpha of ALPHAS) {
      let score = 0
      let complete = true
      for (let held = 0; held < groups.length; held++) {
        const train = balanced(groups.filter((_, index) => index !== held), candidate.indices)
        const ridge = fitRidge(train, alpha, scaleFloors)
        if (!ridge) { complete = false; break }
        const errors = groups[held].map(sample => {
          const point = predictRidge(ridge, project(sample.features, candidate.indices))
          return Math.hypot(point.x - sample.x, point.y - sample.y)
        })
        score += errors.reduce((sum, error) => sum + error, 0) / errors.length
      }
      if (!complete) continue
      score /= groups.length
      // Prefer a simpler, steadier model when the CV difference is marginal.
      if (!Number.isFinite(score) || (best && score >= best.cvErrorPx * .97)) continue
      const ridge = fitRidge(balanced(groups, candidate.indices), alpha, scaleFloors)
      if (ridge) best = {...candidate, ridge, alpha, cvErrorPx: score}
    }
  }
  return best
}

export function refitPersonal(model: PersonalModel, samples: TrainingSample[], floors: Float64Array) {
  const ridge = fitRidge(balanced(groupsOf(samples), model.indices), model.alpha,
    Float64Array.from(model.indices.map(index => floors[index])))
  return ridge ? {...model, ridge} : model
}
