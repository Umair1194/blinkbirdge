/**
 * Weighted ridge regression from eye-image features to screen coordinates.
 * Pure math with no DOM access, so it can be tested in isolation.
 */

export interface TrainingSample {
  features: Float64Array
  x: number
  y: number
  weight: number
  /** Calibration target this sample belongs to (used for cross-validation). */
  group: number
}

export interface RidgeModel {
  mean: Float64Array
  /** Per-feature spread used for standardisation. */
  scale: Float64Array
  /** Length = feature count + 1; the last entry is the (unpenalised) intercept. */
  coefX: Float64Array
  coefY: Float64Array
}

interface Normal {
  G: Float64Array // upper triangle of ZᵀWZ, (d+1)²
  bx: Float64Array
  by: Float64Array
}

export const DEFAULT_ALPHAS = [1e-4, 3e-4, 1e-3, 3e-3, 1e-2, 3e-2, 1e-1, 3e-1, 1]

/** Largest standardised value used at prediction time (guards against extrapolation). */
const Z_LIMIT = 6

function featureStats(samples: TrainingSample[], d: number, floors?: Float64Array) {
  const mean = new Float64Array(d)
  const scale = new Float64Array(d)
  let wsum = 0
  for (const s of samples) {
    wsum += s.weight
    for (let j = 0; j < d; j++) mean[j] += s.weight * s.features[j]
  }
  if (wsum > 0) for (let j = 0; j < d; j++) mean[j] /= wsum
  for (const s of samples) {
    for (let j = 0; j < d; j++) {
      const dv = s.features[j] - mean[j]
      scale[j] += s.weight * dv * dv
    }
  }
  for (let j = 0; j < d; j++) {
    const sd = wsum > 0 ? Math.sqrt(scale[j] / wsum) : 0
    scale[j] = Math.max(sd, floors?.[j] ?? 0) || 1
  }
  return { mean, scale }
}

function accumulate(samples: TrainingSample[], mean: Float64Array, scale: Float64Array): Normal {
  const d = mean.length
  const D = d + 1
  const G = new Float64Array(D * D)
  const bx = new Float64Array(D)
  const by = new Float64Array(D)
  const z = new Float64Array(D)
  for (const s of samples) {
    const w = s.weight
    for (let j = 0; j < d; j++) z[j] = (s.features[j] - mean[j]) / scale[j]
    z[d] = 1
    for (let i = 0; i < D; i++) {
      const wzi = w * z[i]
      if (wzi === 0) continue
      const row = i * D
      for (let j = i; j < D; j++) G[row + j] += wzi * z[j]
      bx[i] += wzi * s.x
      by[i] += wzi * s.y
    }
  }
  return { G, bx, by }
}

/** In-place Cholesky factorisation (lower triangle). Returns false if not positive definite. */
function cholesky(A: Float64Array, n: number) {
  for (let j = 0; j < n; j++) {
    let sum = A[j * n + j]
    for (let k = 0; k < j; k++) sum -= A[j * n + k] * A[j * n + k]
    if (!(sum > 0)) return false
    const ljj = Math.sqrt(sum)
    A[j * n + j] = ljj
    for (let i = j + 1; i < n; i++) {
      let s = A[i * n + j]
      for (let k = 0; k < j; k++) s -= A[i * n + k] * A[j * n + k]
      A[i * n + j] = s / ljj
    }
  }
  return true
}

function cholSolve(L: Float64Array, b: Float64Array, n: number) {
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k]
    y[i] = s / L[i * n + i]
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k]
    x[i] = s / L[i * n + i]
  }
  return x
}

function traceScale(G: Float64Array, d: number) {
  const D = d + 1
  let t = 0
  for (let j = 0; j < d; j++) t += G[j * D + j]
  return t / Math.max(1, d)
}

function solve(n: Normal, d: number, lambda: number): [Float64Array, Float64Array] | null {
  const D = d + 1
  for (let attempt = 0; attempt < 3; attempt++) {
    const A = new Float64Array(D * D)
    for (let i = 0; i < D; i++) {
      for (let j = i; j < D; j++) {
        const v = n.G[i * D + j]
        A[i * D + j] = v
        A[j * D + i] = v
      }
    }
    const jitter = attempt === 0 ? 0 : Math.pow(10, attempt - 7) * (traceScale(n.G, d) + 1)
    for (let i = 0; i < d; i++) A[i * D + i] += lambda + jitter
    A[d * D + d] += 1e-9 + jitter
    if (cholesky(A, D)) return [cholSolve(A, n.bx, D), cholSolve(A, n.by, D)]
  }
  return null
}

export function predictRidge(model: RidgeModel, f: Float64Array) {
  const d = model.mean.length
  let x = model.coefX[d]
  let y = model.coefY[d]
  for (let j = 0; j < d; j++) {
    const z = Math.max(-Z_LIMIT, Math.min(Z_LIMIT, (f[j] - model.mean[j]) / model.scale[j]))
    x += z * model.coefX[j]
    y += z * model.coefY[j]
  }
  return { x, y }
}

/** Fits the model. `alpha` scales the penalty relative to the average feature energy. */
export function fitRidge(samples: TrainingSample[], alpha: number, floors?: Float64Array): RidgeModel | null {
  if (samples.length === 0) return null
  const d = samples[0].features.length
  const { mean, scale } = featureStats(samples, d, floors)
  const normal = accumulate(samples, mean, scale)
  const sol = solve(normal, d, alpha * traceScale(normal.G, d))
  return sol ? { mean, scale, coefX: sol[0], coefY: sol[1] } : null
}

/**
 * Picks the regularisation strength by leave-one-target-out cross-validation,
 * so the model generalises to screen positions it wasn't trained on.
 */
export function chooseAlpha(samples: TrainingSample[], alphas: number[] = DEFAULT_ALPHAS, floors?: Float64Array) {
  const d = samples[0].features.length
  const D = d + 1
  const { mean, scale } = featureStats(samples, d, floors)
  const byGroup = new Map<number, TrainingSample[]>()
  for (const s of samples) {
    const list = byGroup.get(s.group) ?? []
    list.push(s)
    byGroup.set(s.group, list)
  }
  const groups = [...byGroup.entries()].map(([, list]) => ({ list, normal: accumulate(list, mean, scale) }))
  const total: Normal = { G: new Float64Array(D * D), bx: new Float64Array(D), by: new Float64Array(D) }
  for (const g of groups) {
    for (let i = 0; i < D * D; i++) total.G[i] += g.normal.G[i]
    for (let i = 0; i < D; i++) {
      total.bx[i] += g.normal.bx[i]
      total.by[i] += g.normal.by[i]
    }
  }
  const penaltyScale = traceScale(total.G, d)

  let best = { alpha: alphas[Math.floor(alphas.length / 2)], errorPx: Infinity }
  for (const alpha of alphas) {
    let errSum = 0
    let count = 0
    for (const g of groups) {
      const train: Normal = {
        G: total.G.map((v, i) => v - g.normal.G[i]),
        bx: total.bx.map((v, i) => v - g.normal.bx[i]),
        by: total.by.map((v, i) => v - g.normal.by[i]),
      }
      const sol = solve(train, d, alpha * penaltyScale)
      if (!sol) continue
      const model: RidgeModel = { mean, scale, coefX: sol[0], coefY: sol[1] }
      for (const s of g.list) {
        const p = predictRidge(model, s.features)
        errSum += Math.hypot(p.x - s.x, p.y - s.y)
        count++
      }
    }
    const errorPx = count ? errSum / count : Infinity
    if (errorPx < best.errorPx) best = { alpha, errorPx }
  }
  return best
}
