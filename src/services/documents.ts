import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Setup standard PDF.js worker via cdnjs so that it runs bug-free in the sandboxed preview environment
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Extracts raw textual data from an uploaded PDF file stream.
 */
export async function extractTextFromPDF(
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    let combinedText = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress(Math.floor((pageNum / totalPages) * 100));
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems: any[] = textContent.items;
      
      const pageText = pageItems.map(item => item.str).join(' ');
      combinedText += `[Page ${pageNum}]\n${pageText}\n\n`;
    }

    return combinedText.trim();
  } catch (error) {
    console.error("PDF.js parsing failed, loading fallback raw text generator:", error);
    throw new Error("Could not parse the PDF file. Ensure it is not password-protected.");
  }
}

/**
 * Performs local optical character recognition (OCR) on an image file.
 */
export async function extractTextFromImage(
  file: File,
  onProgress: (status: string) => void
): Promise<string> {
  try {
    onProgress("Initializing scan engine...");
    const worker = await createWorker('eng');
    
    onProgress("Analyzing page structure...");
    const ret = await worker.recognize(file);
    
    await worker.terminate();
    onProgress("Scanning complete.");
    return ret.data.text || '';
  } catch (err: any) {
    console.error("Tesseract.js image OCR failed:", err);
    throw new Error("Could not perform optical character recognition. Try uploading a higher contrast picture.");
  }
}
