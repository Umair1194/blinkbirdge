import type { CameraErrorCode } from './types'

export interface CameraDevice {
  deviceId: string
  label: string
}

export class CameraError extends Error {
  constructor(
    public code: CameraErrorCode,
    detail?: string,
  ) {
    super(detail ?? code)
  }
}

export function cameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** True when the app runs inside another page (e.g. an embedded preview). */
export function isEmbedded() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

type PolicyDoc = Document & {
  permissionsPolicy?: { allowsFeature(f: string): boolean }
  featurePolicy?: { allowsFeature(f: string): boolean }
}

/** True when the embedding frame's permissions policy forbids the camera. */
export function cameraBlockedByFrame() {
  const d = document as PolicyDoc
  const policy = d.permissionsPolicy ?? d.featurePolicy
  try {
    return policy ? !policy.allowsFeature('camera') : false
  } catch {
    return false
  }
}

/** Opens the app in its own browser tab, where camera access can be granted. */
export function openInNewTab() {
  window.open(window.location.href, '_blank', 'noopener')
}

/** Requests the webcam. Must only be called in response to an explicit user action. */
export async function requestCamera(deviceId?: string | null): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) throw new CameraError('insecure')
  if (!cameraSupported()) throw new CameraError('unsupported')
  if (cameraBlockedByFrame()) throw new CameraError('blocked-by-frame')
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false })
  } catch (err) {
    throw toCameraError(err)
  }
}

function toCameraError(err: unknown): CameraError {
  const name = (err as DOMException)?.name ?? ''
  const message = (err as Error)?.message
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      if (/policy/i.test(message ?? '') || (isEmbedded() && cameraBlockedByFrame())) {
        return new CameraError('blocked-by-frame', message)
      }
      return new CameraError('permission-denied', message)
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return new CameraError('not-found', message)
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('in-use', message)
    default:
      return new CameraError('unknown', message)
  }
}

export async function listCameras(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

export const CAMERA_ERROR_COPY: Record<CameraErrorCode, { title: string; body: string }> = {
  'permission-denied': {
    title: 'Camera permission was denied',
    body: isEmbedded()
      ? 'Allow camera access in your browser’s address bar (camera icon) and select Retry camera. If no prompt appears, the preview window may be blocking the camera — open the app in its own tab.'
      : 'Allow camera access in your browser’s address bar (camera icon), then select Retry camera.',
  },
  'blocked-by-frame': {
    title: 'Camera is blocked in this preview window',
    body: 'This embedded preview isn’t allowed to use the camera. Open Gesture Playground in its own browser tab to connect your camera and calibrate.',
  },
  'not-found': {
    title: 'No camera found',
    body: 'Connect a webcam or choose a different camera, then select Retry camera.',
  },
  'in-use': {
    title: 'Camera is in use by another app',
    body: 'Close other apps or tabs using the camera (video calls, recorders), then select Retry camera.',
  },
  unsupported: {
    title: 'This browser can’t access a camera',
    body: 'Try a recent version of Chrome, Edge, Firefox or Safari. You can still explore in Demo Mode.',
  },
  insecure: {
    title: 'Camera requires a secure connection',
    body: 'Open Gesture Playground over HTTPS to use the camera. You can still explore in Demo Mode.',
  },
  disconnected: {
    title: 'Camera disconnected',
    body: 'The camera stopped sending video. Reconnect it, then select Retry camera.',
  },
  unknown: {
    title: 'The camera couldn’t start',
    body: 'Something unexpected happened. Select Retry camera, or continue in Demo Mode.',
  },
}
