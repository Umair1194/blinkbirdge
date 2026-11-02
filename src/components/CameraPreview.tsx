import { CameraOff, Loader2 } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { cx } from "./ui"

interface Props {
  stream: MediaStream | null
  state: "off" | "requesting" | "connected" | "error"
  faceDetected: boolean | null
  onBrightness?: (luma: number) => void
  placeholder?: ReactNode
  className?: string
}

/** Live, mirrored webcam preview. Frames are analysed locally for lighting only. */
export function CameraPreview({
  stream,
  state,
  faceDetected,
  onBrightness,
  placeholder,
  className,
}: Props) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.srcObject = stream
    if (stream) void v.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    if (!stream || !onBrightness) return
    const canvas = document.createElement("canvas")
    canvas.width = 48
    canvas.height = 36
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const id = setInterval(() => {
      const v = video.current
      if (!ctx || !v || v.readyState < 2) return
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      onBrightness(sum / (d.length / 4))
    }, 1000)
    return () => clearInterval(id)
  }, [stream, onBrightness])

  const live = state === "connected" && stream
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl bg-[#0b1220]",
        className,
        !live && "!aspect-auto",
      )}
    >
      <video
        ref={video}
        muted
        playsInline
        aria-label="Live camera preview"
        className={cx(
          "h-full w-full -scale-x-100 object-cover",
          !live && "hidden",
        )}
      />
      {live && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className={cx(
              "h-[68%] aspect-[3/4] rounded-[50%] border-[3px] border-dashed transition-colors",
              faceDetected === true
                ? "border-[#4ade80]"
                : faceDetected === false
                  ? "border-[#fbbf24]"
                  : "border-white/60",
            )}
          />
        </div>
      )}
      {!live && (
        <div className="relative flex min-h-64 flex-col items-center justify-center gap-4 p-5 sm:p-8 text-center text-white">
          {state === "requesting" ? (
            <>
              <Loader2 className="size-10 animate-spin text-[#5eead4]" />
              <p className="text-lg font-semibold">
                Waiting for camera permission…
              </p>
              <p className="max-w-sm text-sm text-white/70">
                Your browser is asking whether Gesture Playground may use the
                camera.
              </p>
            </>
          ) : (
            (placeholder ?? (
              <>
                <CameraOff className="size-10 text-white/70" />
                <p className="text-lg font-semibold">Camera is off</p>
              </>
            ))
          )}
        </div>
      )}
    </div>
  )
}
