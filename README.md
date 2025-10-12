# PDF Editor Web App (React + Vite + Tailwind CSS)

A modern, secure, and scalable PDF editor built with React.js and Vite, styled using Tailwind CSS. It supports uploading PDFs, adding/modifying text, inserting images (signatures, stamps, logos), annotations (highlights, shapes, arrows, freehand), undo/redo, zoom, page navigation, and exporting the modified PDF.

## Features
- Upload and display PDFs in the browser (pdf.js)
- Text editing overlays (double-click to edit)
- Image insertion via toolbar and click-to-place
- Annotations: highlight, rectangle, circle, arrow, freehand drawing
- Undo/redo, zoom in/out, and per-page navigation
- Export/download modified PDF (pdf-lib)
- Clean, responsive UI with Tailwind CSS

## Tech Stack
- Frontend: React + Vite (TypeScript)
- Styling: Tailwind CSS
- PDF Handling: pdf.js for viewing, pdf-lib for export
- State: React Context + Reducer (undo/redo built-in)

## Getting Started
1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`
3. Open the app in your browser (printed in terminal, usually `http://localhost:5173`).

## Usage
- Use the top toolbar to upload a PDF, adjust zoom, navigate pages, undo/redo, clear overlays, and export.
- Use the left sidebar to select tools: Text, Image, Highlight, Draw, Rectangle, Circle, Arrow.
- For Image insertion, click “Add Image” in the toolbar, choose an image, then click on the page to place it.
- Double-click text overlays to edit content, click elsewhere to finish.

## Project Structure
```
src/
  components/     // Toolbar, Sidebar, PdfViewer
  context/        // EditorContext (global state)
  hooks/          // usePdf (pdf.js integration)
  utils/          // file validation, PDF export (pdf-lib)
  services/       // placeholder for future backend/cloud integrations
```

## Security & Best Practices
- Only `.pdf` files are allowed; size limited via validation.
- No sensitive data is stored; state remains in-memory.
- Avoids unsafe URLs and `eval`-like patterns.
- Prepared for backend integration (Node.js, Firebase, etc.).

## Performance
- Lazy page rendering via pdf.js; only current page renders.
- Zoom-based rendering and overlay scaling to keep interactions smooth.
- Components are structured for easy memoization and future code-splitting.

## Development
- ESLint (flat config) and Prettier configured; run `npm run lint`.
- Tailwind configured via `tailwind.config.js` and `postcss.config.js`.
- Code includes meaningful comments near responsibilities and logic.

## Roadmap / Future Extensions
- Drag/move/resize overlays and better selection tooling.
- More robust freehand export and arrowheads.
- Multi-page simultaneous rendering optimization.
- Collaboration features and cloud sync.

## License
This project is provided as-is for educational and production use. Add a license if distributing.
