import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OcrProviderError, type PrivacySanitizedImage } from './ocrCapture'
import {
  browserTesseractOcrProvider,
  sanitizeReceiptImage,
} from './browserOcrProvider'

const tesseractMocks = vi.hoisted(() => ({
  createWorker: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
}))

vi.mock('tesseract.js', () => ({
  createWorker: tesseractMocks.createWorker,
}))

function sanitizedImage(): PrivacySanitizedImage {
  return {
    bytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: 'image/jpeg',
    privacySanitized: true,
  }
}

describe('browser Tesseract OCR provider', () => {
  const createObjectURL = vi.fn((blob: Blob) => {
    void blob
    return 'blob:local-receipt'
  })
  const revokeObjectURL = vi.fn()
  const fetchMock = vi.fn()
  const setItem = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    tesseractMocks.createWorker.mockResolvedValue({
      recognize: tesseractMocks.recognize,
      terminate: tesseractMocks.terminate,
    })
    tesseractMocks.terminate.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', { setItem })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts receipt candidates locally and releases temporary resources', async () => {
    tesseractMocks.recognize.mockResolvedValue({
      data: {
        text: [
          'KOPI CORNER',
          'Date 30/08/2026',
          'Subtotal RM 1,200.00',
          'Grand Total RM 1,234.56',
        ].join('\n'),
        confidence: 88,
      },
    })

    const result = await browserTesseractOcrProvider.extract(sanitizedImage())

    expect(tesseractMocks.createWorker).toHaveBeenCalledWith('eng')
    expect(createObjectURL).toHaveBeenCalledOnce()
    const localBlob = createObjectURL.mock.calls[0]?.[0]
    expect(localBlob).toBeInstanceOf(Blob)
    expect(localBlob).toEqual(expect.objectContaining({ type: 'image/jpeg' }))
    await expect((localBlob as Blob).arrayBuffer()).resolves.toEqual(
      new Uint8Array([1, 2, 3, 4]).buffer,
    )
    expect(tesseractMocks.recognize).toHaveBeenCalledWith('blob:local-receipt')
    expect(result).toEqual({
      candidates: {
        total: { value: '1234.56', confidence: 0.88 },
        merchant: { value: 'KOPI CORNER', confidence: 0.75 },
        date: { value: '2026-08-30', confidence: 0.8 },
      },
    })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-receipt')
    expect(tesseractMocks.terminate).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports no_text and still cleans up the worker and object URL', async () => {
    tesseractMocks.recognize.mockResolvedValue({
      data: { text: ' \n ', confidence: 40 },
    })

    await expect(browserTesseractOcrProvider.extract(sanitizedImage())).rejects.toEqual(
      new OcrProviderError('no_text'),
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-receipt')
    expect(tesseractMocks.terminate).toHaveBeenCalledOnce()
  })

  it('cleans up when recognition fails without persisting or uploading input', async () => {
    const recognitionError = new Error('recognition_failed')
    tesseractMocks.recognize.mockRejectedValue(recognitionError)

    await expect(browserTesseractOcrProvider.extract(sanitizedImage())).rejects.toBe(
      recognitionError,
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-receipt')
    expect(tesseractMocks.terminate).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('sanitizeReceiptImage', () => {
  const fetchMock = vi.fn()
  const setItem = vi.fn()
  const close = vi.fn()
  const drawImage = vi.fn()
  const encodedBytes = new Uint8Array([9, 8, 7])

  beforeEach(() => {
    vi.clearAllMocks()
    const bitmap = {
      width: 3000,
      height: 1500,
      close,
    } as unknown as ImageBitmap
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.86)
        callback(new Blob([encodedBytes], { type: 'image/jpeg' }))
      }),
    } as unknown as HTMLCanvasElement

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', { setItem })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName: string) => {
        expect(tagName).toBe('canvas')
        return canvas
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('downscales and re-encodes a receipt without retaining source metadata', async () => {
    const source = {
      name: 'private-receipt-name.jpg',
      type: 'image/jpeg',
      size: 4,
    } as File

    const result = await sanitizeReceiptImage(source)

    expect(createImageBitmap).toHaveBeenCalledWith(source)
    expect(drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ width: 3000, height: 1500 }),
      0,
      0,
      1800,
      900,
    )
    expect(result).toEqual({
      bytes: encodedBytes,
      mimeType: 'image/jpeg',
      privacySanitized: true,
    })
    expect(result).not.toHaveProperty('name')
    expect(close).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('closes the decoded bitmap when sanitized encoding fails', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback) => callback(null)),
    } as unknown as HTMLCanvasElement
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    await expect(sanitizeReceiptImage({} as File)).rejects.toThrow('image_encode_failed')
    expect(close).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
  })
})
