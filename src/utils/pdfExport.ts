import { PDFDocument, rgb } from 'pdf-lib'
import type { OverlayItem } from '../context/EditorContext'

type PagePixelSize = { width: number; height: number }

/**
 * Export an updated PDF by drawing overlay items onto each page using pdf-lib.
 * Coordinates are expected to be in PDF pixel-space at scale=1 provided by pdf.js.
 * We map pixel-space to PDF points using the ratio between pdf-lib page size and pixel size.
 */
export async function exportPdf(
  originalBytes: ArrayBuffer,
  overlaysByPage: Record<number, OverlayItem[]>,
  pagePixelSizes: Record<number, PagePixelSize>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes)
  const pages = pdfDoc.getPages()

  for (let i = 0; i < pages.length; i++) {
    const pageIndex = i + 1
    const page = pages[i]
    const { width: ptW, height: ptH } = page.getSize()
    const pxSize = pagePixelSizes[pageIndex] || { width: ptW, height: ptH }
    const xRatio = ptW / pxSize.width
    const yRatio = ptH / pxSize.height

    const items = overlaysByPage[pageIndex] || []
    for (const item of items) {
      const x = (item.x || 0) * xRatio
      const y = ptH - (item.y || 0) * yRatio // Flip Y from top-left to bottom-left origin
      const w = (item.width || 0) * xRatio
      const h = (item.height || 0) * yRatio
      const color = toRgb(item.color || '#2563eb')
      const opacity = item.opacity ?? 1

      switch (item.type) {
        case 'text': {
          const fontSize = item.fontSize || 14
          page.drawText(item.text || 'Text', {
            x,
            y: y - fontSize, // text draws from baseline
            size: fontSize,
            color,
            opacity,
          })
          break
        }
        case 'image': {
          if (!item.imageDataUrl) break
          const isPng = item.imageDataUrl.startsWith('data:image/png')
          const imgBytes = dataUrlToBytes(item.imageDataUrl)
          const embedded = isPng
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes)
          page.drawImage(embedded, {
            x,
            y: y - h,
            width: w,
            height: h,
            opacity,
          })
          break
        }
        case 'highlight':
        case 'rectangle': {
          page.drawRectangle({ x, y: y - h, width: w, height: h, color, opacity })
          break
        }
        case 'circle': {
          // circle from width/height bounding box
          page.drawEllipse({
            x: x + w / 2,
            y: y - h / 2,
            xScale: w / 2,
            yScale: h / 2,
            color,
            opacity,
          })
          break
        }
        case 'arrow': {
          // Draw a line for the arrow; simple approximation without arrowhead for now
          page.drawLine({
            start: { x, y },
            end: { x: x + w, y: y - h },
            color,
            opacity,
            thickness: 2,
          })
          break
        }
        case 'draw':
        case 'path': {
          const pts = item.points || []
          for (let j = 1; j < pts.length; j++) {
            const p0 = pts[j - 1]
            const p1 = pts[j]
            page.drawLine({
              start: { x: p0.x * xRatio, y: ptH - p0.y * yRatio },
              end: { x: p1.x * xRatio, y: ptH - p1.y * yRatio },
              color,
              opacity,
              thickness: 1.5,
            })
          }
          break
        }
        default:
          break
      }
    }
  }

  const out = await pdfDoc.save()
  return out
}

function toRgb(hexOrCss: string) {
  // Very small helper: supports hex like #RRGGBB and #RGB
  try {
    const hex = hexOrCss.replace('#', '')
    const r = hex.length === 3 ? parseInt(hex[0] + hex[0], 16) : parseInt(hex.substring(0, 2), 16)
    const g = hex.length === 3 ? parseInt(hex[1] + hex[1], 16) : parseInt(hex.substring(2, 4), 16)
    const b = hex.length === 3 ? parseInt(hex[2] + hex[2], 16) : parseInt(hex.substring(4, 6), 16)
    return rgb(r / 255, g / 255, b / 255)
  } catch {
    return rgb(0.145, 0.388, 0.922)
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, base64] = dataUrl.split(',')
  const bin = atob(base64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}