import { memo, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { baseColor } from '@/lib/chromatogram'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme'
import { useViewerStore } from '@/store/viewer'

const BASES_PER_LINE = 60
const GROUP = 10

const SequenceLines = memo(function SequenceLines({
  sequence,
  qualities,
  dark,
}: {
  sequence: string
  qualities: number[]
  dark: boolean
}) {
  const lines = []
  for (let start = 0; start < sequence.length; start += BASES_PER_LINE) {
    const groups = []
    for (let g = start; g < Math.min(start + BASES_PER_LINE, sequence.length); g += GROUP) {
      const chars = []
      for (let i = g; i < Math.min(g + GROUP, sequence.length); i++) {
        const q = qualities[i]
        chars.push(
          <span
            key={i}
            data-index={i}
            className={cn('cursor-pointer rounded-sm hover:bg-accent', q !== undefined && q < 20 && 'opacity-50')}
            style={{ color: baseColor(sequence[i], dark) }}
          >
            {sequence[i]}
          </span>,
        )
      }
      groups.push(
        <span key={g} className="mr-[1ch]">
          {chars}
        </span>,
      )
    }
    lines.push(
      <div key={start} className="flex whitespace-nowrap" data-line={start}>
        <span className="text-muted-foreground mr-3 inline-block w-[5ch] shrink-0 text-right select-none">
          {start + 1}
        </span>
        <span>{groups}</span>
      </div>,
    )
  }
  return <>{lines}</>
})

/** Full sequence as text; clicking a base selects it in the chromatogram. */
export function SequencePanel() {
  const data = useViewerStore((s) => s.data)
  const selectedIndex = useViewerStore((s) => s.selectedIndex)
  const setSelectedIndex = useViewerStore((s) => s.setSelectedIndex)
  const dark = useThemeStore((s) => s.theme === 'dark')
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Highlight the selected base without re-rendering every span.
  useEffect(() => {
    const container = containerRef.current
    if (!container || selectedIndex === null) return
    const el = container.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
    if (!el) return
    el.classList.add('bg-yellow-300/70', 'ring-1', 'ring-yellow-500', 'dark:bg-yellow-400/30')
    // Scroll only inside this panel, never the page.
    const top = el.offsetTop - container.offsetTop
    if (top < container.scrollTop || top > container.scrollTop + container.clientHeight - 24) {
      container.scrollTop = top - container.clientHeight / 2
    }
    return () => el.classList.remove('bg-yellow-300/70', 'ring-1', 'ring-yellow-500', 'dark:bg-yellow-400/30')
  }, [selectedIndex, data, dark])

  if (!data) return null

  const copy = async () => {
    await navigator.clipboard.writeText(data.sequence)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t.sequence}</h2>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? t.copied : t.copySequence}
        </Button>
      </div>
      <div
        ref={containerRef}
        className="bg-muted/40 relative max-h-72 overflow-auto rounded-lg border p-3 font-mono text-sm leading-6"
        onClick={(e) => {
          const index = (e.target as HTMLElement).dataset.index
          if (index !== undefined) setSelectedIndex(Number(index))
        }}
      >
        <SequenceLines sequence={data.sequence} qualities={data.qualities} dark={dark} />
      </div>
    </div>
  )
}
