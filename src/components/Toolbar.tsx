import { useRef } from 'react'
import { useEditor } from '../context/EditorContext'
import { validatePdfFile } from '../utils/fileValidation'
import { exportPdf } from '../utils/pdfExport'

export default function Toolbar() {
  const { state, dispatch } = useEditor()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const onUpload = async (file?: File) => {
    if (!file) return
    const check = validatePdfFile(file)
    if (!check.valid) {
      alert(check.error)
      return
    }
    const bytes = await file.arrayBuffer()
    dispatch({ type: 'SET_PDF_BYTES', bytes })
    dispatch({ type: 'SET_PAGE', page: 1 })
    dispatch({ type: 'SET_PAGE_COUNT', pageCount: 0 }) // will be set by viewer after load
  }

  const onDownload = async () => {
    try {
      if (!state.pdfArrayBuffer) {
        alert('Upload a PDF first.')
        return
      }
      const updated = await exportPdf(state.pdfArrayBuffer, state.overlaysByPage, state.pdfPixelSizes)
      const blob = new Blob([updated], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'edited.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Failed to export PDF')
    }
  }

  const onClear = () => dispatch({ type: 'CLEAR_OVERLAYS' })
  const onUndo = () => dispatch({ type: 'UNDO' })
  const onRedo = () => dispatch({ type: 'REDO' })
  const onZoomIn = () => dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 0.1 })
  const onZoomOut = () => dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 0.1 })

  const onPrevPage = () => dispatch({ type: 'SET_PAGE', page: state.page - 1 })
  const onNextPage = () => dispatch({ type: 'SET_PAGE', page: state.page + 1 })

  const onImageUpload = async (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      dispatch({ type: 'SET_PENDING_IMAGE', dataUrl })
      dispatch({ type: 'SET_TOOL', tool: 'image' })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-white shadow-soft sticky top-0 z-10">
      {/* File actions */}
      <button
        className="px-3 py-2 rounded border bg-slate-100 hover:bg-slate-200"
        onClick={() => fileInputRef.current?.click()}
        title="Upload PDF"
      >
        Upload
      </button>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => onUpload(e.target.files?.[0])}
      />

      <button
        className="px-3 py-2 rounded border bg-slate-100 hover:bg-slate-200"
        onClick={onDownload}
        title="Download edited PDF"
      >
        Download
      </button>
      <button className="px-3 py-2 rounded border" onClick={onClear} title="Clear annotations">
        Clear
      </button>

      {/* History */}
      <div className="ml-2 flex items-center gap-2">
        <button className="px-3 py-2 rounded border" onClick={onUndo} title="Undo">
          Undo
        </button>
        <button className="px-3 py-2 rounded border" onClick={onRedo} title="Redo">
          Redo
        </button>
      </div>

      {/* Zoom */}
      <div className="ml-4 flex items-center gap-2">
        <button className="px-3 py-2 rounded border" onClick={onZoomOut} title="Zoom out">
          -
        </button>
        <span className="min-w-16 text-sm text-slate-600">{Math.round(state.zoom * 100)}%</span>
        <button className="px-3 py-2 rounded border" onClick={onZoomIn} title="Zoom in">
          +
        </button>
      </div>

      {/* Page navigation */}
      <div className="ml-4 flex items-center gap-2">
        <button className="px-3 py-2 rounded border" onClick={onPrevPage} disabled={state.page <= 1}>
          Prev
        </button>
        <span className="text-sm text-slate-600">
          Page {state.page} / {state.pageCount || '-'}
        </span>
        <button
          className="px-3 py-2 rounded border"
          onClick={onNextPage}
          disabled={!!state.pageCount && state.page >= state.pageCount}
        >
          Next
        </button>
      </div>

      {/* Image upload */}
      <div className="ml-auto flex items-center gap-2">
        <button
          className="px-3 py-2 rounded border bg-slate-100 hover:bg-slate-200"
          onClick={() => imageInputRef.current?.click()}
          title="Upload image to insert"
        >
          Add Image
        </button>
        <input
          ref={imageInputRef}
          className="hidden"
          type="file"
          accept="image/*"
          onChange={(e) => onImageUpload(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}