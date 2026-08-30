import {
  OcrProviderError,
  type OcrCandidate,
  type OcrProvider,
  type PrivacySanitizedImage,
} from './ocrCapture'

function candidate(value: string | undefined, confidence: number): OcrCandidate<string> | undefined {
  return value ? { value, confidence } : undefined
}

function extractTotal(lines: string[]): string | undefined {
  const labelled = lines.filter((line) => /\b(?:grand\s+total|total|amount\s+due|balance\s+due)\b/i.test(line))
  const source = labelled.at(-1)
  if (!source) return undefined
  const amounts = [...source.matchAll(/(?:RM|MYR|SGD|USD|S\$|\$|¥)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\d+\.\d{1,2})/gi)]
  return amounts.at(-1)?.[1]?.replaceAll(',', '')
}

function extractDate(lines: string[]): string | undefined {
  const text = lines.join(' ')
  const iso = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }
  const dayFirst = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/.exec(text)
  if (!dayFirst) return undefined
  return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
}

export const browserTesseractOcrProvider: OcrProvider = {
  async extract(image) {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    const blob = new Blob([image.bytes as Uint8Array<ArrayBuffer>], { type: image.mimeType })
    const url = URL.createObjectURL(blob)
    try {
      const result = await worker.recognize(url)
      const lines = result.data.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      if (lines.length === 0) throw new OcrProviderError('no_text')
      const confidence = Math.max(0, Math.min(1, result.data.confidence / 100))
      return {
        candidates: {
          total: candidate(extractTotal(lines), confidence),
          merchant: candidate(lines[0], Math.min(confidence, 0.75)),
          date: candidate(extractDate(lines), Math.min(confidence, 0.8)),
        },
      }
    } finally {
      URL.revokeObjectURL(url)
      await worker.terminate()
    }
  },
}

export async function sanitizeReceiptImage(file: File): Promise<PrivacySanitizedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const maxDimension = 1800
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('image_canvas_unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const sanitizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('image_encode_failed')),
        'image/jpeg',
        0.86,
      )
    })
    return {
      bytes: new Uint8Array(await sanitizedBlob.arrayBuffer()),
      mimeType: 'image/jpeg',
      privacySanitized: true,
    }
  } finally {
    bitmap.close()
  }
}
