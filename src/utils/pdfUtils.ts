import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Check if file is a PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Convert the first page of a PDF to a File object (image)
 * This is used to send to the API for document detection
 */
export async function convertPDFFirstPageToImage(pdfFile: File): Promise<File> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get first page only
    const page = await pdf.getPage(1);

    // Set scale for good quality (2x for better resolution)
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert canvas to blob then to File
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert PDF page to image'));
            return;
          }
          
          // Create a new File with the same name but .jpg extension
          const baseName = pdfFile.name.replace(/\.pdf$/i, '');
          const imageFile = new File([blob], `${baseName}_page1.jpg`, {
            type: 'image/jpeg',
          });
          
          resolve(imageFile);
        },
        'image/jpeg',
        0.95 // Quality
      );
    });

  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF first page to image');
  }
}

/**
 * Convert PDF first page to base64 data URL (for preview)
 */
export async function convertPDFFirstPageToDataURL(pdfFile: File): Promise<string> {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const page = await pdf.getPage(1);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.95);

  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF first page to image');
  }
}
