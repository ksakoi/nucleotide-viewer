/**
 * Minimal UI localization: Japanese when the browser's preferred language is
 * Japanese, English otherwise. The locale is fixed for the page's lifetime.
 */

export type Locale = 'ja' | 'en'

export type ParseErrorCode =
  | 'notAbif'
  | 'directoryOutOfRange'
  | 'missingBasecalls'
  | 'peakCountMismatch'
  | 'missingTraces'

const ja = {
  appTagline: 'サンガーシーケンスの .ab1 ファイルをブラウザだけで安全に閲覧できます',
  appHeading: 'DNA シーケンス波形ビューア',
  open: '開く',
  closeFile: 'ファイルを閉じる',
  toggleTheme: 'テーマ切り替え',
  dropToOpen: 'ドロップして .ab1 ファイルを開く',
  dropHere: '.ab1 ファイルをドラッグ＆ドロップ',
  orClick: 'またはクリックしてファイルを選択',
  privacyNote: 'ファイルはブラウザ内でのみ処理され、外部へ送信されることはありません',
  openSample: 'サンプルを開く',
  zoomOut: '縮小',
  zoomIn: '拡大',
  horizontalZoom: '横方向ズーム',
  traceHeight: '波形の高さ',
  viewerHint: 'クリックで塩基を選択 · ← → で移動 · Ctrl+ホイールでズーム',
  chromatogramLabel: 'クロマトグラム (← → で塩基を移動、Ctrl+ホイールでズーム)',
  sequence: '塩基配列',
  copySequence: '配列をコピー',
  copied: 'コピーしました',
  parseErrors: {
    notAbif: 'ABIF 形式のファイルではありません',
    directoryOutOfRange: 'ディレクトリがファイル範囲外を指しています',
    missingBasecalls: '塩基配列またはピーク位置のデータが見つかりません',
    peakCountMismatch: '塩基数とピーク位置の数が一致しません',
    missingTraces: '波形データ (DATA9-12) が見つかりません',
  } satisfies Record<ParseErrorCode, string>,
}

export type Messages = typeof ja

const en: Messages = {
  appTagline: 'View Sanger sequencing .ab1 files securely, entirely in your browser',
  appHeading: 'DNA Chromatogram Viewer',
  open: 'Open',
  closeFile: 'Close file',
  toggleTheme: 'Toggle theme',
  dropToOpen: 'Drop to open the .ab1 file',
  dropHere: 'Drag & drop an .ab1 file',
  orClick: 'or click to choose a file',
  privacyNote: 'Files are processed only in your browser and are never uploaded',
  openSample: 'Open sample',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  horizontalZoom: 'Horizontal zoom',
  traceHeight: 'Trace height',
  viewerHint: 'Click to select a base · ← → to move · Ctrl+wheel to zoom',
  chromatogramLabel: 'Chromatogram (← → to move between bases, Ctrl+wheel to zoom)',
  sequence: 'Sequence',
  copySequence: 'Copy sequence',
  copied: 'Copied',
  parseErrors: {
    notAbif: 'Not an ABIF file',
    directoryOutOfRange: 'The tag directory points outside the file',
    missingBasecalls: 'Base calls or peak locations are missing',
    peakCountMismatch: 'The number of bases does not match the number of peak locations',
    missingTraces: 'Trace data (DATA9-12) is missing',
  },
}

const catalogs: Record<Locale, Messages> = { ja, en }

/** Picks the locale from the browser's most preferred language. */
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale]
}

const browserLanguages =
  typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language]

export const locale: Locale = detectLocale(browserLanguages)

/** Messages for the current browser locale. */
export const t: Messages = getMessages(locale)
