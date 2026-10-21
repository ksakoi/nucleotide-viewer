/**
 * Minimal UI localization: Japanese when the browser's preferred language is
 * Japanese, English otherwise. The locale is fixed for the page's lifetime.
 */

export type Locale = 'ja' | 'en'

export type FormatErrorCode =
  | 'unknownFormat'
  | 'emptySequence'
  | 'invalidFasta'
  | 'invalidGenbank'
  | 'invalidSnapGene'
  | 'notAbif'
  | 'directoryOutOfRange'
  | 'missingBasecalls'
  | 'peakCountMismatch'
  | 'missingTraces'

const ja = {
  appTagline: '波形 (.ab1) や配列ファイルをブラウザだけで安全に閲覧・変換できます',
  appHeading: 'DNA シーケンス波形ビューア',
  open: '開く',
  closeFile: 'ファイルを閉じる',
  toggleTheme: 'テーマ切り替え',
  dropToOpen: 'ドロップしてファイルを開く',
  dropHere: '配列ファイルをドラッグ＆ドロップ',
  orClick: 'またはクリックしてファイルを選択',
  supportedFormats: '対応形式: .ab1 / .fasta / .gbk / .dna',
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
  doubleStrand: '二本鎖',
  doubleStrandHint: '相補鎖 (3\'→5\') を表示',
  export: 'エクスポート',
  exportAs: '形式を選んで保存',
  circular: '環状',
  linear: '直鎖',
  features: 'フィーチャー',
  featureName: '名前',
  featureType: 'タイプ',
  featureLocation: '位置',
  multipleRecords: (count: number) => `このファイルには ${count} 件の配列が含まれています。最初の 1 件を表示しています。`,
  formatErrors: {
    unknownFormat: '対応していないファイル形式です（.ab1 / .fasta / .gbk / .dna に対応）',
    emptySequence: '配列データが見つかりません',
    invalidFasta: 'FASTA に塩基配列として使えない文字が含まれています',
    invalidGenbank: 'GenBank 形式として読み込めません',
    invalidSnapGene: 'SnapGene (.dna) 形式として読み込めません',
    notAbif: 'ABIF 形式のファイルではありません',
    directoryOutOfRange: 'ディレクトリがファイル範囲外を指しています',
    missingBasecalls: '塩基配列またはピーク位置のデータが見つかりません',
    peakCountMismatch: '塩基数とピーク位置の数が一致しません',
    missingTraces: '波形データ (DATA9-12) が見つかりません',
  } satisfies Record<FormatErrorCode, string>,
}

export type Messages = typeof ja

const en: Messages = {
  appTagline: 'View and convert chromatograms (.ab1) and sequence files securely, entirely in your browser',
  appHeading: 'DNA Chromatogram Viewer',
  open: 'Open',
  closeFile: 'Close file',
  toggleTheme: 'Toggle theme',
  dropToOpen: 'Drop to open the file',
  dropHere: 'Drag & drop a sequence file',
  orClick: 'or click to choose a file',
  supportedFormats: 'Supported: .ab1 / .fasta / .gbk / .dna',
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
  doubleStrand: 'Double strand',
  doubleStrandHint: 'Show the complementary strand (3\'→5\')',
  export: 'Export',
  exportAs: 'Save as',
  circular: 'Circular',
  linear: 'Linear',
  features: 'Features',
  featureName: 'Name',
  featureType: 'Type',
  featureLocation: 'Location',
  multipleRecords: (count: number) => `This file contains ${count} sequences. Showing the first one.`,
  formatErrors: {
    unknownFormat: 'Unsupported file format (supported: .ab1 / .fasta / .gbk / .dna)',
    emptySequence: 'No sequence data found',
    invalidFasta: 'The FASTA file contains characters that are not valid in a nucleotide sequence',
    invalidGenbank: 'Could not read the file as GenBank',
    invalidSnapGene: 'Could not read the file as SnapGene (.dna)',
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
