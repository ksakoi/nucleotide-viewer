import { MoveVertical, ZoomIn, ZoomOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { t } from '@/lib/i18n'
import { MAX_GAIN, MAX_ZOOM, MIN_GAIN, MIN_ZOOM, useViewerStore } from '@/store/viewer'

// Sliders work on a log scale so each step feels like the same zoom factor.
const toLog = (v: number) => Math.log2(v)
const fromLog = (v: number) => 2 ** v

/** Selected-base readout, plus zoom/gain controls when a chromatogram is shown. */
export function ViewerToolbar() {
  const zoom = useViewerStore((s) => s.zoom)
  const gain = useViewerStore((s) => s.gain)
  const setZoom = useViewerStore((s) => s.setZoom)
  const setGain = useViewerStore((s) => s.setGain)
  const doc = useViewerStore((s) => s.doc)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  if (!doc) return null

  const selected =
    selectedIndex !== null
      ? `${selectedIndex + 1} / ${doc.sequence.length}  ${doc.sequence[selectedIndex]}${
          doc.qualities.length ? `  Q${doc.qualities[selectedIndex]}` : ''
        }`
      : null

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-6 gap-y-3">
      {doc.chromatogram && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label={t.zoomOut} onClick={() => setZoom(zoom / 1.25)}>
              <ZoomOut />
            </Button>
            <Slider
              aria-label={t.horizontalZoom}
              className="w-32"
              min={toLog(MIN_ZOOM)}
              max={toLog(MAX_ZOOM)}
              step={0.01}
              value={[toLog(zoom)]}
              onValueChange={([v]) => setZoom(fromLog(v))}
            />
            <Button variant="ghost" size="icon" aria-label={t.zoomIn} onClick={() => setZoom(zoom * 1.25)}>
              <ZoomIn />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <MoveVertical className="text-muted-foreground size-4" aria-hidden />
            <Slider
              aria-label={t.traceHeight}
              className="w-28"
              min={toLog(MIN_GAIN)}
              max={toLog(MAX_GAIN)}
              step={0.01}
              value={[toLog(gain)]}
              onValueChange={([v]) => setGain(fromLog(v))}
            />
          </div>
        </>
      )}
      {selected ? (
        <div className="text-muted-foreground ml-auto font-mono text-xs whitespace-pre tabular-nums">
          {selected}
        </div>
      ) : (
        doc.chromatogram && (
          <div className="text-muted-foreground ml-auto hidden text-xs md:block">{t.viewerHint}</div>
        )
      )}
    </div>
  )
}
