import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../context/EditorContext'
import type { OverlayItem } from '../context/EditorContext'
import { usePdf } from '../hooks/usePdf'
import * as pdfjsLib from 'pdfjs-dist/build/pdf'

function uuid() {
  return Math.random().toString(36).slice(2)
}

export default function PdfViewer() {
  const { state, dispatch } = useEditor()
  const { load, pageCount, renderPageToCanvas, getPagePixelSize, pdf } = usePdf()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [tempItem, setTempItem] = useState<OverlayItem | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragInfo, setDragInfo] = useState<{ id: string; offset: { x: number; y: number } } | null>(null)
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const [textItems, setTextItems] = useState<Array<{ str: string; transform: number[] }>>([])
  // New approach: drag-rectangle selection in Select tool
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null)
  const [selectRect, setSelectRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Add keyboard event handler for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        dispatch({ type: 'REMOVE_OVERLAY', page: state.page, id: selectedId })
        setSelectedId(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, state.page, dispatch])

  // Load PDF when bytes change
  useEffect(() => {
    const run = async () => {
      if (!state.pdfArrayBuffer) return
      const pdf = await load(state.pdfArrayBuffer)
      dispatch({ type: 'SET_PAGE_COUNT', pageCount: pdf.numPages })
      // Record pixel size for the current page at scale=1 for accurate export mapping
      const size = await getPagePixelSize(state.page)
      dispatch({ type: 'SET_PAGE_PIXEL_SIZE', page: state.page, size })
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pdfArrayBuffer])

  // Render current page at current zoom
  useEffect(() => {
    const run = async () => {
      if (!canvasRef.current) return
      await renderPageToCanvas(state.page, canvasRef.current, state.zoom)
      const size = await getPagePixelSize(state.page)
      dispatch({ type: 'SET_PAGE_PIXEL_SIZE', page: state.page, size })
      // Ensure overlay layer has the correct base size (scale applied via CSS transform)
      if (overlayRef.current) {
        overlayRef.current.style.width = `${size.width}px`
        overlayRef.current.style.height = `${size.height}px`
      }
      // Ensure text layer has the correct base size
      if (textLayerRef.current) {
        textLayerRef.current.style.width = `${size.width}px`
        textLayerRef.current.style.height = `${size.height}px`
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.page, state.zoom, pageCount])

  // Build selectable text layer from PDF text content
  useEffect(() => {
    const run = async () => {
      const doc = pdf.current
      if (!doc) return
      const page = await doc.getPage(state.page)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items = content.items.map((it: any) => {
        const m = pdfjsLib.Util.transform(viewport.transform, it.transform)
        return { str: it.str, transform: m as number[] }
      })
      setTextItems(items)
      if (textLayerRef.current) {
        textLayerRef.current.style.width = `${viewport.width}px`
        textLayerRef.current.style.height = `${viewport.height}px`
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.page, state.pdfArrayBuffer])

  const getRelativePoint = (e: React.MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / state.zoom
    const y = (e.clientY - rect.top) / state.zoom
    return { x, y }
  }

  // Convert drag selection rectangle to editable overlay by intersecting text spans
  const finalizeSelectionToOverlay = (rect: { x: number; y: number; width: number; height: number }) => {
    if (!textLayerRef.current) return
    
    // Get the text layer's position and dimensions
    const layerRect = textLayerRef.current.getBoundingClientRect()
    const zx = state.zoom
    
    // Convert selection rectangle to screen coordinates
    const selRectCss = {
      left: layerRect.left + rect.x * zx,
      top: layerRect.top + rect.y * zx,
      right: layerRect.left + (rect.x + rect.width) * zx,
      bottom: layerRect.top + (rect.y + rect.height) * zx,
    }
    
    // Find all text spans that intersect with the selection rectangle
    const spans = Array.from(textLayerRef.current.querySelectorAll('span')) as HTMLSpanElement[]
    const selectedSpans = spans.filter((sp) => {
      const r = sp.getBoundingClientRect()
      // Check for intersection (not just containment)
      return !(r.right < selRectCss.left || r.left > selRectCss.right || r.bottom < selRectCss.top || r.top > selRectCss.bottom)
    })
    
    // Extract text from selected spans
    const text = selectedSpans.map((sp) => sp.textContent || '').join(' ').trim()
    if (!text) {
      console.log('No text found in selection area')
      return
    }
    
    console.log('Selected text:', text)
    
    // Create text overlay item
    const item: OverlayItem = {
      id: uuid(),
      page: state.page,
      type: 'text',
      x: rect.x,
      y: rect.y,
      width: Math.max(100, rect.width), // Ensure minimum width for editing
      height: Math.max(20, rect.height), // Ensure minimum height for editing
      text,
      fontSize: Math.max(12, Math.round(rect.height * 0.8)),
      color: '#111827',
    }
    
    dispatch({ type: 'ADD_OVERLAY', item })
    setSelectedId(item.id)
    setPendingFocusId(item.id)
  }

  // Start selection rectangle when clicking empty area in Select tool
  const startSelectDrag = (e: React.MouseEvent) => {
    if (state.tool !== 'select') return
    const p = getRelativePoint(e)
    setIsSelecting(true)
    setSelectStart(p)
    setSelectRect({ x: p.x, y: p.y, width: 1, height: 1 })
  }
  const onOverlayClick = (e: React.MouseEvent) => {
    if (!overlayRef.current) return
    if (state.tool === 'select') {
      // Only clear selection if we're not in the middle of a selection drag
      if (!isSelecting) {
        setSelectedId(null)
      }
      return
    }
    if (state.tool === 'text') {
      const p = getRelativePoint(e)
      const item: OverlayItem = {
        id: uuid(),
        page: state.page,
        type: 'text',
        x: p.x,
        y: p.y,
        width: 160,
        height: 32,
        text: 'Double-click to edit',
        fontSize: 16,
        color: '#111827',
      }
      dispatch({ type: 'ADD_OVERLAY', item })
      setSelectedId(item.id)
      setPendingFocusId(item.id)
    } else if (state.tool === 'image' && state.pendingImageDataUrl) {
      const p = getRelativePoint(e)
      const item: OverlayItem = {
        id: uuid(),
        page: state.page,
        type: 'image',
        x: p.x,
        y: p.y,
        width: 120,
        height: 80,
        imageDataUrl: state.pendingImageDataUrl,
        opacity: 1,
      }
      dispatch({ type: 'ADD_OVERLAY', item })
      dispatch({ type: 'SET_PENDING_IMAGE', dataUrl: undefined })
    }
  }

  const onItemMouseDown = (e: React.MouseEvent, item: OverlayItem) => {
    // Begin selection/drag when in select tool
    if (state.tool !== 'select') return
    e.stopPropagation()
    const p = getRelativePoint(e)
    setSelectedId(item.id)
    setDragInfo({ id: item.id, offset: { x: p.x - item.x, y: p.y - item.y } })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (state.tool === 'select') {
      // Check if we clicked on an existing overlay item
      const target = e.target as HTMLElement
      const overlayItem = target.closest('[data-id]')
      if (!overlayItem) {
        // Only start selection when clicking on empty space (not on an item)
        startSelectDrag(e)
      }
      return
    }
    if (!['highlight', 'rectangle', 'circle', 'arrow', 'draw'].includes(state.tool)) return
    const p = getRelativePoint(e)
    setIsDrawing(true)
    setDrawStart(p)
    if (state.tool === 'draw') {
      setTempItem({ id: uuid(), page: state.page, type: 'path', x: p.x, y: p.y, points: [p], color: '#2563eb' })
    } else {
      setTempItem({ id: uuid(), page: state.page, type: state.tool, x: p.x, y: p.y, width: 1, height: 1, color: '#2563eb', opacity: state.tool === 'highlight' ? 0.25 : 1 })
    }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    // Selection rectangle when in Select tool
    if (isSelecting && selectStart) {
      const p = getRelativePoint(e)
      const w = p.x - selectStart.x
      const h = p.y - selectStart.y
      setSelectRect({ x: selectStart.x, y: selectStart.y, width: w, height: h })
      return
    }
    if (!isDrawing && !dragInfo) return
    const p = getRelativePoint(e)
    if (tempItem) {
      if (tempItem.type === 'path') {
        tempItem.points!.push(p)
        setTempItem({ ...tempItem })
        return
      }
      const w = p.x - (drawStart?.x || 0)
      const h = p.y - (drawStart?.y || 0)
      setTempItem({ ...tempItem, width: w, height: h })
    }
    // Handle dragging selected item
    if (dragInfo) {
      const pos = getRelativePoint(e)
      const list = state.overlaysByPage[state.page] || []
      const current = list.find((i) => i.id === dragInfo.id)
      if (current) {
        const updated: OverlayItem = {
          ...current,
          x: pos.x - dragInfo.offset.x,
          y: pos.y - dragInfo.offset.y,
        }
        dispatch({ type: 'UPDATE_OVERLAY', page: state.page, item: updated })
      }
    }
  }

  const onMouseUp = () => {
    // Finalize selection rectangle in Select tool
    if (isSelecting && selectRect && selectStart) {
      setIsSelecting(false)
      setSelectStart(null)
      
      // Normalize rect dimensions to handle negative width/height
      const nx = selectRect.width < 0 ? selectRect.x + selectRect.width : selectRect.x
      const ny = selectRect.height < 0 ? selectRect.y + selectRect.height : selectRect.y
      const nw = Math.abs(selectRect.width)
      const nh = Math.abs(selectRect.height)
      
      // Only create overlay if selection has meaningful size
      if (nw > 5 && nh > 5) {
        console.log('Finalizing selection:', { x: nx, y: ny, width: nw, height: nh })
        finalizeSelectionToOverlay({ x: nx, y: ny, width: nw, height: nh })
      }
      
      setSelectRect(null)
      return
    }
    // Finish drawing or dragging actions
    if (isDrawing && tempItem) {
      setIsDrawing(false)
      setDrawStart(null)
      // Normalize dimensions to positive width/height
      let item = tempItem
      if (item.type !== 'path') {
        let { x, y, width = 0, height = 0 } = item
        const nx = width < 0 ? x + width : x
        const ny = height < 0 ? y + height : y
        item = { ...item, x: nx, y: ny, width: Math.abs(width), height: Math.abs(height) }
      }
      dispatch({ type: 'ADD_OVERLAY', item })
      setTempItem(null)
    }
    if (dragInfo) {
      setDragInfo(null)
    }
  }

  const items = state.overlaysByPage[state.page] || []

  // Focus newly created text overlay for immediate editing
  useEffect(() => {
    if (!pendingFocusId) return
    const el = overlayRef.current?.querySelector(`[data-id="${pendingFocusId}"]`) as HTMLDivElement | null
    if (el) {
      el.focus()
      const sel = window.getSelection()
      sel?.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(el)
      sel?.addRange(range)
    }
    setPendingFocusId(null)
  }, [pendingFocusId, state.overlaysByPage])
  return (
    <div className="flex-1 overflow-auto p-6 scrollbar-thin">
      {!state.pdfArrayBuffer ? (
        <div className="h-[60vh] flex items-center justify-center text-slate-500">
          Upload a PDF to start editing.
        </div>
      ) : (
        <div className="inline-block relative">
          {/* PDF Canvas */}
          <canvas ref={canvasRef} className="canvas-shadow" />

          {/* PDF Text Layer (invisible; used for geometry, not native selection) */}
          <div
            ref={textLayerRef}
            className="absolute top-0 left-0"
            style={{ transform: `scale(${state.zoom})`, transformOrigin: 'top left', zIndex: 1, pointerEvents: 'none' }}
          >
            {textItems.map((t, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  transform: `matrix(${t.transform.join(',')})`,
                  transformOrigin: '0 0',
                  whiteSpace: 'pre',
                  color: 'transparent',
                  opacity: 0.01,
                  userSelect: 'none',
                }}
              >
                {t.str}
              </span>
            ))}
          </div>

          {/* Overlay Layer (interactive for tools and selection drag) */}
          <div
            ref={overlayRef}
            className="absolute top-0 left-0"
            style={{ transform: `scale(${state.zoom})`, transformOrigin: 'top left', zIndex: 2, pointerEvents: 'auto' }}
            onClick={onOverlayClick}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
          >
            {items.map((item) => (
              <Overlay key={item.id} item={item} selected={item.id === selectedId} onMouseDown={(e) => onItemMouseDown(e, item)} />
            ))}
            {tempItem && <Overlay item={tempItem} temp onMouseDown={(e) => e.stopPropagation()} />}
            {selectRect && (
              <div
                style={{
                  position: 'absolute',
                  left: selectRect.x,
                  top: selectRect.y,
                  width: Math.max(0, selectRect.width),
                  height: Math.max(0, selectRect.height),
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px dashed #2563eb',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Overlay({ item, temp, selected, onMouseDown }: { item: OverlayItem; temp?: boolean; selected?: boolean; onMouseDown?: (e: React.MouseEvent) => void }) {
  const { dispatch } = useEditor()
  switch (item.type) {
    case 'text':
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            // Prevent parent from creating new text overlay while selecting/editing
            e.stopPropagation()
            onMouseDown?.(e)
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault()
              ;(e.target as HTMLDivElement).blur()
            }
          }}
          onBlur={(e) => {
            // update text content
            const text = (e.target as HTMLDivElement).innerText
            const updated: OverlayItem = { ...item, text }
            dispatch({ type: 'UPDATE_OVERLAY', page: item.page, item: updated })
          }}
          className="px-2 py-1 border rounded bg-white/90 text-slate-800 shadow-soft"
          style={{ position: 'absolute', left: item.x, top: item.y, width: item.width, height: item.height, fontSize: item.fontSize, outline: selected ? '2px solid #2563eb' : 'none', cursor: 'text', pointerEvents: 'auto' }}
          data-id={item.id}
        >
          {item.text}
        </div>
      )
    case 'image':
      return (
        <img
          src={item.imageDataUrl}
          alt="overlay"
          onMouseDown={(e) => {
            e.stopPropagation()
            onMouseDown?.(e)
          }}
          style={{ position: 'absolute', left: item.x, top: item.y, width: item.width, height: item.height, opacity: item.opacity ?? 1, outline: selected ? '2px solid #2563eb' : 'none', pointerEvents: 'auto' }}
        />
      )
    case 'highlight':
    case 'rectangle':
      return (
        <div
          onMouseDown={(e) => {
            e.stopPropagation()
            onMouseDown?.(e)
          }}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: Math.max(0, item.width || 0),
            height: Math.max(0, item.height || 0),
            background: item.type === 'highlight' ? (item.color || '#2563eb') : 'transparent',
            border: item.type === 'rectangle' ? `2px solid ${item.color || '#2563eb'}` : 'none',
            opacity: item.opacity ?? (item.type === 'highlight' ? 0.25 : 1),
            outline: selected ? '2px solid #2563eb' : 'none',
            pointerEvents: 'auto',
          }}
        />
      )
    case 'circle':
      return (
        <div
          onMouseDown={(e) => {
            e.stopPropagation()
            onMouseDown?.(e)
          }}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: Math.max(0, item.width || 0),
            height: Math.max(0, item.height || 0),
            borderRadius: '50%',
            border: `2px solid ${item.color || '#2563eb'}`,
            outline: selected ? '2px solid #2563eb' : 'none',
            pointerEvents: 'auto',
          }}
        />
      )
    case 'arrow':
      return (
        <svg
          onMouseDown={(e) => {
            e.stopPropagation()
            onMouseDown?.(e)
          }}
          style={{ position: 'absolute', left: item.x, top: item.y, width: Math.max(0, item.width || 0), height: Math.max(0, item.height || 0), outline: selected ? '2px solid #2563eb' : 'none', pointerEvents: 'auto' }}
        >
          <line x1={0} y1={0} x2={item.width || 0} y2={item.height || 0} stroke={item.color || '#2563eb'} strokeWidth={2} />
        </svg>
      )
    case 'draw':
    case 'path':
      return (
        <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} width={'100%'} height={'100%'}>
          {/* Rendered by parent path preview; for simplicity, do nothing here */}
          {item.points && (
            <polyline
              points={item.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={item.color || '#2563eb'}
              strokeWidth={2}
            />
          )}
        </svg>
      )
    default:
      return null
  }
}