import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdf = require('pdf-parse')

const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Usage: node scripts/extract-pdf.js <pdf-path>')
  process.exit(1)
}

async function extract() {
  const buffer = fs.readFileSync(pdfPath)
  const data = await pdf(buffer)

  // Output raw text for inspection
  const outPath = pdfPath.replace('.pdf', '.txt')
  fs.writeFileSync(outPath, data.text)
  console.log(`Extracted ${data.numpages} pages -> ${outPath}`)
  console.log(`Text length: ${data.text.length} chars`)
  console.log('First 500 chars:')
  console.log(data.text.substring(0, 500))
}

extract().catch(e => { console.error(e.message); process.exit(1) })
