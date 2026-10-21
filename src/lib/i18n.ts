/**
 * Minimal UI localization. The URL decides first (/ja/ is Japanese,
 * ?lang=en|ja overrides), otherwise Japanese when the browser's preferred
 * language is Japanese and English for everything else. The locale is fixed
 * for the page's lifetime.
 */

export type Locale = 'ja' | 'en'

/** Product name; not translated. */
export const APP_NAME = 'Web sequence viewer'

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
  /** <title>: product name plus the terms people search for. */
  pageTitle: 'Web sequence viewer – ブラウザで使える DNA 配列・波形ビューア',
  appHeading: 'ブラウザで使える DNA 配列・シーケンス波形ビューア',
  appTagline: 'サンガーシーケンスの波形 (.ab1) や FASTA / GenBank / SnapGene ファイルを、インストール不要・無料で閲覧・変換できます',
  seoDescription:
    'ブラウザで使える無料の DNA 配列ビューア。サンガーシーケンスの .ab1 波形、FASTA・GenBank・SnapGene (.dna) ファイルを開いて、フィーチャーや二本鎖を確認し、形式を変換できます。ファイルは外部に送信されません。',
  landingFeaturesTitle: '主な機能',
  landingFeatures: [
    {
      title: 'シーケンス波形 (.ab1) の表示',
      body: 'サンガーシーケンスの波形を塩基・品質値と並べて表示。ズームやスクロールで N や重なったピークを確認できます。',
    },
    {
      title: 'FASTA / GenBank / SnapGene に対応',
      body: 'プラスミドやゲノムの配列ファイルを開き、二本鎖の配列と、その下にフィーチャー（CDS・プロモーターなど）を表示します。',
    },
    {
      title: '形式の相互変換',
      body: 'FASTA・GenBank・SnapGene (.dna) 形式でエクスポート。フィーチャーや環状/直鎖の情報も引き継ぎます。',
    },
    {
      title: 'ファイルは送信されない',
      body: 'ファイルはブラウザ内だけで読み込まれ、サーバーへ送信されません。未発表の配列データも安心して扱えます。',
    },
  ],
  languageLabel: '言語',
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
  pageTitle: 'Web sequence viewer – Free online DNA sequence & .ab1 chromatogram viewer',
  appHeading: 'Online DNA sequence and chromatogram viewer',
  appTagline: 'Open Sanger .ab1 chromatograms and FASTA, GenBank or SnapGene files for free, with nothing to install',
  seoDescription:
    'Free in-browser DNA sequence viewer for Sanger .ab1 chromatograms, FASTA, GenBank and SnapGene (.dna) files. View features on both strands and convert formats. Nothing is uploaded.',
  landingFeaturesTitle: 'Features',
  landingFeatures: [
    {
      title: 'Sanger chromatograms (.ab1)',
      body: 'See trace peaks aligned with base calls and quality values, and zoom and scroll to check Ns and mixed peaks.',
    },
    {
      title: 'FASTA, GenBank and SnapGene files',
      body: 'Open plasmid and genome sequences and see both strands with annotated features (CDS, promoters and more) drawn underneath.',
    },
    {
      title: 'Format conversion',
      body: 'Export to FASTA, GenBank or SnapGene (.dna), keeping features and circular or linear topology.',
    },
    {
      title: 'Private by design',
      body: 'Files are read inside your browser and never uploaded to a server, so unpublished sequences stay on your computer.',
    },
  ],
  languageLabel: 'Language',
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

/** URL first (/ja/ path, then ?lang=), then the browser's preferred language. */
export function resolveLocale(pathname: string, search: string, languages: readonly string[]): Locale {
  const param = new URLSearchParams(search).get('lang')
  if (param === 'ja' || param === 'en') return param
  if (/^\/ja(\/|$)/.test(pathname)) return 'ja'
  return detectLocale(languages)
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

// Read through globalThis: this module is also imported at build time (src/seo.ts), where there is no location.
const pageLocation = (globalThis as { location?: { pathname: string; search: string } }).location

export const locale: Locale = pageLocation
  ? resolveLocale(pageLocation.pathname, pageLocation.search, browserLanguages)
  : detectLocale(browserLanguages)

/** Messages for the current browser locale. */
export const t: Messages = getMessages(locale)
