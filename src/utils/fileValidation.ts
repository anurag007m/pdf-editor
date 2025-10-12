/** Validate uploaded PDF files to enforce type and size constraints. */
export function validatePdfFile(file: File, maxSizeMB = 20): {
  valid: boolean
  error?: string
} {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return { valid: false, error: 'Only PDF files are allowed.' }
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) return { valid: false, error: `File too large. Max ${maxSizeMB}MB.` }
  return { valid: true }
}