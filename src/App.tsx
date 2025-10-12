import './App.css'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PdfViewer from './components/PdfViewer'
import { EditorProvider } from './context/EditorContext'

function App() {
  return (
    <EditorProvider>
      <div className="flex flex-col h-screen">
        <Toolbar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <PdfViewer />
        </div>
      </div>
    </EditorProvider>
  )
}

export default App
