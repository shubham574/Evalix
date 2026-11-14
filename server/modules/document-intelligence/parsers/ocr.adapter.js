/**
 * Placeholder OCR Adapter Interface for future scanned-PDF support (e.g., Document AI / Textract).
 * Module 2 detects image-only PDFs and marks them OCR_REQUIRED without fabricating text.
 */
class OcrAdapter {
  async isConfigured() {
    return false;
  }

  async extractTextFromScannedPdf() {
    return {
      status: 'OCR_REQUIRED',
      reason: 'NO_OCR_PROVIDER_CONFIGURED',
    };
  }
}

module.exports = { OcrAdapter };
