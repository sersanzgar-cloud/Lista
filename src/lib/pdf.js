import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const pages = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item) => item.str).join(' ')
    pages.push(pageText.replace(/\s+/g, ' ').trim())
  }

  return pages.join('\n\n')
}

export async function extractTextFromTxt(file) {
  return (await file.text()).trim()
}
