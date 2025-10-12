import clsx from 'classnames'
import type { Tool } from '../context/EditorContext'
import { useEditor } from '../context/EditorContext'

const tools: { key: Tool; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'text', label: 'Text' },
  { key: 'image', label: 'Image' },
  { key: 'highlight', label: 'Highlight' },
  { key: 'draw', label: 'Draw' },
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'circle', label: 'Circle' },
  { key: 'arrow', label: 'Arrow' },
]

export default function Sidebar() {
  const { state, dispatch } = useEditor()
  return (
    <aside className="w-48 bg-white border-r h-full p-3 space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Tools</h2>
      <div className="grid grid-cols-2 gap-2">
        {tools.map((t) => (
          <button
            key={t.key}
            className={clsx(
              'px-2 py-2 text-sm rounded border hover:bg-slate-100',
              state.tool === t.key && 'bg-brand text-white hover:bg-brand-dark border-brand'
            )}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Tip: Upload an image via toolbar, then click to place it.
      </p>
    </aside>
  )
}