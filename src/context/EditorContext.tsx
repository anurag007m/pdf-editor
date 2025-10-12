import React, { createContext, useContext, useReducer, ReactNode } from 'react'

// Toolbar tools supported by the editor
export type Tool =
  | 'select'
  | 'text'
  | 'image'
  | 'highlight'
  | 'draw'
  | 'rectangle'
  | 'circle'
  | 'arrow'

// Overlay item represents an annotation or content placed on a page
export type OverlayItem = {
  id: string
  page: number
  type: Tool | 'path'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  color?: string
  opacity?: number
  text?: string
  fontSize?: number
  imageDataUrl?: string
  // For freehand drawing
  points?: Array<{ x: number; y: number }>
}

type EditorSnapshot = {
  overlaysByPage: Record<number, OverlayItem[]>
}

type EditorState = {
  tool: Tool
  zoom: number
  page: number
  pageCount: number
  overlaysByPage: Record<number, OverlayItem[]>
  pdfArrayBuffer?: ArrayBuffer
  pdfPixelSizes: Record<number, { width: number; height: number }>
  pendingImageDataUrl?: string
  past: EditorSnapshot[]
  future: EditorSnapshot[]
}

type EditorAction =
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_PAGE_COUNT'; pageCount: number }
  | { type: 'SET_PDF_BYTES'; bytes?: ArrayBuffer }
  | {
      type: 'SET_PAGE_PIXEL_SIZE'
      page: number
      size: { width: number; height: number }
    }
  | { type: 'ADD_OVERLAY'; item: OverlayItem }
  | { type: 'UPDATE_OVERLAY'; page: number; item: OverlayItem }
  | { type: 'REMOVE_OVERLAY'; page: number; id: string }
  | { type: 'CLEAR_OVERLAYS' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_PENDING_IMAGE'; dataUrl?: string }

const initialState: EditorState = {
  tool: 'select',
  zoom: 1,
  page: 1,
  pageCount: 0,
  overlaysByPage: {},
  pdfPixelSizes: {},
  past: [],
  future: [],
}

function cloneSnapshot(state: EditorState): EditorSnapshot {
  return {
    overlaysByPage: Object.fromEntries(
      Object.entries(state.overlaysByPage).map(([p, items]) => [
        Number(p),
        items.map((i) => ({ ...i, points: i.points ? [...i.points] : undefined })),
      ])
    ),
  }
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, tool: action.tool }
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.25, Math.min(4, action.zoom)) }
    case 'SET_PAGE':
      return { ...state, page: Math.max(1, Math.min(state.pageCount || 1, action.page)) }
    case 'SET_PAGE_COUNT':
      return { ...state, pageCount: action.pageCount }
    case 'SET_PDF_BYTES':
      return { ...state, pdfArrayBuffer: action.bytes, overlaysByPage: {}, past: [], future: [] }
    case 'SET_PAGE_PIXEL_SIZE': {
      const nextSizes = { ...state.pdfPixelSizes, [action.page]: action.size }
      return { ...state, pdfPixelSizes: nextSizes }
    }
    case 'ADD_OVERLAY': {
      const snapshot = cloneSnapshot(state)
      const list = state.overlaysByPage[action.item.page] || []
      const next = { ...state, overlaysByPage: { ...state.overlaysByPage, [action.item.page]: [...list, action.item] } }
      return { ...next, past: [...state.past, snapshot], future: [] }
    }
    case 'UPDATE_OVERLAY': {
      const snapshot = cloneSnapshot(state)
      const list = state.overlaysByPage[action.page] || []
      const nextList = list.map((i) => (i.id === action.item.id ? action.item : i))
      const next = { ...state, overlaysByPage: { ...state.overlaysByPage, [action.page]: nextList } }
      return { ...next, past: [...state.past, snapshot], future: [] }
    }
    case 'REMOVE_OVERLAY': {
      const snapshot = cloneSnapshot(state)
      const list = state.overlaysByPage[action.page] || []
      const nextList = list.filter((i) => i.id !== action.id)
      const next = { ...state, overlaysByPage: { ...state.overlaysByPage, [action.page]: nextList } }
      return { ...next, past: [...state.past, snapshot], future: [] }
    }
    case 'CLEAR_OVERLAYS': {
      const snapshot = cloneSnapshot(state)
      const next = { ...state, overlaysByPage: {} }
      return { ...next, past: [...state.past, snapshot], future: [] }
    }
    case 'UNDO': {
      const past = [...state.past]
      const prev = past.pop()
      if (!prev) return state
      const future = [{ overlaysByPage: state.overlaysByPage }, ...state.future]
      return { ...state, overlaysByPage: prev.overlaysByPage, past, future }
    }
    case 'REDO': {
      const [next, ...rest] = state.future
      if (!next) return state
      const past = [...state.past, { overlaysByPage: state.overlaysByPage }]
      return { ...state, overlaysByPage: next.overlaysByPage, past, future: rest }
    }
    case 'SET_PENDING_IMAGE':
      return { ...state, pendingImageDataUrl: action.dataUrl }
    default:
      return state
  }
}

const EditorContext = createContext<{ state: EditorState; dispatch: React.Dispatch<EditorAction> } | undefined>(
  undefined
)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <EditorContext.Provider value={{ state, dispatch }}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used within EditorProvider')
  return ctx
}