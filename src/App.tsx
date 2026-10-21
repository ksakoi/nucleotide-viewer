import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Dna, FileUp, Info, Moon, Sun, Upload, X } from 'lucide-react'

import { Chromatogram } from '@/components/chromatogram'
import { ExportMenu } from '@/components/export-menu'
import { FeaturesPanel } from '@/components/features-panel'
import { FileDropZone } from '@/components/file-drop-zone'
import { SequencePanel } from '@/components/sequence-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ViewerToolbar } from '@/components/viewer-toolbar'
import { baseColor } from '@/lib/chromatogram'
import { BASES } from '@/lib/abif/types'
import { ACCEPTED_EXTENSIONS, FORMAT_LABELS } from '@/lib/formats'
import { t } from '@/lib/i18n'
import { useThemeStore } from '@/store/theme'
import { useViewerStore } from '@/store/viewer'

/** Lets a new file be dropped anywhere on the page once one is open. */
function useWindowFileDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) onFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])
  return dragging
}

export default function App() {
  const { doc, fileName, error, notice, status, loadFile, reset } = useViewerStore()
  const { theme, toggle } = useThemeStore()
  const dragging = useWindowFileDrop(loadFile)
  const inputRef = useRef<HTMLInputElement>(null)
  const dark = theme === 'dark'

  const highQuality = doc?.qualities.filter((q) => q >= 20).length ?? 0

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Dna className="size-5" />
          <span className="font-semibold tracking-tight">Nucleotide Viewer</span>
          {fileName && (
            <Badge variant="secondary" className="hidden max-w-64 truncate sm:inline-flex">
              {fileName}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            {doc && (
              <>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload />
                  <span className="hidden sm:inline">{t.open}</span>
                </Button>
                <Button variant="ghost" size="icon" aria-label={t.closeFile} onClick={reset}>
                  <X />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" aria-label={t.toggleTheme} onClick={toggle}>
              {dark ? <Sun /> : <Moon />}
            </Button>
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
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">
        {error && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {!doc ? (
          <div className="flex flex-1 flex-col justify-center gap-6 py-8">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.appHeading}</h1>
              <p className="text-muted-foreground">
                {t.appTagline}
              </p>
            </div>
            <FileDropZone />
          </div>
        ) : (
          <Card className="gap-4">
            <CardHeader className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 gap-1.5">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span className="break-all">{doc.name}</span>
                  <Badge variant="outline">{doc.sequence.length.toLocaleString()} bp</Badge>
                  <Badge variant="outline">{doc.topology === 'circular' ? t.circular : t.linear}</Badge>
                  {doc.qualities.length > 0 && (
                    <Badge variant="outline">
                      Q20+ {((highQuality / doc.qualities.length) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="truncate">{fileName}</span>
                  <Badge variant="secondary">{FORMAT_LABELS[doc.sourceFormat]}</Badge>
                  {doc.description && <span className="min-w-0 truncate">{doc.description}</span>}
                  {doc.chromatogram && (
                    <span className="flex items-center gap-3">
                      {BASES.map((b) => (
                        <span key={b} className="flex items-center gap-1 font-mono">
                          <span className="inline-block h-0.5 w-4 rounded" style={{ background: baseColor(b, dark) }} />
                          {b}
                        </span>
                      ))}
                    </span>
                  )}
                </CardDescription>
              </div>
              <ExportMenu />
            </CardHeader>
            <CardContent className="space-y-4">
              <ViewerToolbar />
              {doc.chromatogram && <Chromatogram data={doc.chromatogram} />}
              <FeaturesPanel />
              <SequencePanel />
            </CardContent>
          </Card>
        )}
      </main>

      {dragging && status !== 'loading' && (
        <div className="bg-background/80 pointer-events-none fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="border-primary flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-16 py-12">
            <FileUp className="size-8" />
            <p className="font-medium">{t.dropToOpen}</p>
          </div>
        </div>
      )}
    </div>
  )
}
