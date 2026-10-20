import { useRef, useState } from 'react'
import { FileUp, FlaskConical, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useViewerStore } from '@/store/viewer'

export const ACCEPTED_EXTENSIONS = '.ab1,.abi'

/** Large drop target shown when no file is loaded. */
export function FileDropZone() {
  const loadFile = useViewerStore((s) => s.loadFile)
  const loadBuffer = useViewerStore((s) => s.loadBuffer)
  const status = useViewerStore((s) => s.status)
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const loadSample = async () => {
    // Bundled with the app (public/sample.ab1); served from the same origin.
    const res = await fetch(`${import.meta.env.BASE_URL}sample.ab1`)
    loadBuffer('sample.ab1', await res.arrayBuffer())
  }

  return (
    <Card className="mx-auto w-full max-w-2xl py-0">
      <CardContent className="p-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOver(false)
            const file = e.dataTransfer.files[0]
            if (file) void loadFile(file)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-16 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            over ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50',
          )}
        >
          <div className="bg-muted flex size-14 items-center justify-center rounded-full">
            {status === 'loading' ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <FileUp className="size-6" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium">.ab1 ファイルをドラッグ＆ドロップ</p>
            <p className="text-muted-foreground text-sm">またはクリックしてファイルを選択</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void loadFile(file)
              e.target.value = ''
            }}
          />
        </div>
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            ファイルはブラウザ内でのみ処理され、外部へ送信されることはありません
          </p>
          <Button variant="outline" size="sm" onClick={() => void loadSample()}>
            <FlaskConical />
            サンプルを開く
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
