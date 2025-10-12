import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
// Bundle the matching pdf.js worker via Vite to avoid version mismatches
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite's ?worker returns a constructor for Worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
const workerInstance = new (pdfjsWorker as unknown as { new (): Worker })()
;(pdfjsLib as any).GlobalWorkerOptions.workerPort = workerInstance

export function usePdf() {
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)

  const load = useCallback(async (bytes: ArrayBuffer) => {
    const loadingTask = pdfjsLib.getDocument({ data: bytes })
    const pdf = await loadingTask.promise
    pdfRef.current = pdf
    setPageCount(pdf.numPages)
    return pdf
  }, [])

  const getPagePixelSize = useCallback(async (pageNumber: number) => {
    const pdf = pdfRef.current
    if (!pdf) return { width: 0, height: 0 }
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }, [])

  const renderPageToCanvas = useCallback(
    async (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => {
      const pdf = pdfRef.current
      if (!pdf) return
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      const context = canvas.getContext('2d')!
      canvas.height = Math.ceil(viewport.height)
      canvas.width = Math.ceil(viewport.width)
      const renderContext = {
        canvasContext: context,
        viewport,
      }
      await page.render(renderContext as unknown as pdfjsLib.IRenderParameters).promise
    },
    []
  )

  useEffect(() => {
    return () => {
      // Cleanup PDF document on unmount
      pdfRef.current?.destroy()
      pdfRef.current = null
    }
  }, [])

  return { load, pageCount, renderPageToCanvas, getPagePixelSize, pdf: pdfRef }
}