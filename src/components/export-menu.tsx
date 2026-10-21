import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EXPORT_FORMATS, FORMAT_LABELS, baseName, exportDocument } from '@/lib/formats'
import { t } from '@/lib/i18n'
import { useViewerStore } from '@/store/viewer'

/** Saves a Blob through a temporary object URL; nothing is uploaded. */
function download(data: BlobPart, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ExportMenu() {
  const doc = useViewerStore((s) => s.doc)
  const fileName = useViewerStore((s) => s.fileName)
  if (!doc) return null
  const stem = baseName(fileName ?? doc.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download />
          {t.export}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t.exportAs}</DropdownMenuLabel>
        {EXPORT_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.id}
            onSelect={() => download(exportDocument(doc, format.id), `${stem}${format.extension}`, format.mime)}
          >
            <span>{FORMAT_LABELS[format.id]}</span>
            <span className="text-muted-foreground ml-auto pl-4 font-mono text-xs">{format.extension}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
