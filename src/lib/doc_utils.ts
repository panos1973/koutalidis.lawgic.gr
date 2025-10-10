import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createWorker } from "tesseract.js";

/**
 * Calculate the number of pages in a file on the client side
 */
export const calculatePageCount = async (file: File) => {
  const fileType = file.type;

  // For images, return 1 page
  if (fileType.startsWith("image/")) {
    return 1;
  }

  // For PDFs, use pdf-lib which is lightweight and works in browsers
  if (fileType === "application/pdf") {
    try {
      const { PDFDocument } = await import("pdf-lib");

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Get the page count
      return pdfDoc.getPageCount();
    } catch (error) {
      console.error("Error calculating PDF page count:", error);
      return 1;
    }
  }

  // For Word documents (.doc, .docx)
  if (
    fileType === "application/msword" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      // For DOCX, we can use mammoth.js which works in browsers
      if (
        fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        // Estimate pages based on word count (500 words per page)
        const wordCount = text.split(/\s+/).length;
        return Math.max(1, Math.ceil(wordCount / 500));
      } else {
        // For DOC files, we can't easily parse in browser
        // Estimate based on file size (very rough)
        return Math.max(1, Math.ceil(file.size / (30 * 1024)));
      }
    } catch (error) {
      console.error("Error calculating Word page count:", error);
      // Fallback to size-based estimate
      return Math.max(1, Math.ceil(file.size / (30 * 1024)));
    }
  }

  // Default to 1 page if type is unknown
  return 1;
};

const fileToBase64 = (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export const getTotalTokensOfFiles = async (locale: string, files: File[]) => {
  const fileObjects = await Promise.all(
    files.map(async (file) => {
      const base64 = (await fileToBase64(file)) as string;
      return {
        data: base64.split(",")[1], // Remove data:mime/type;base64, prefix
        name: file.name,
        type: file.type,
      };
    })
  );
  const response = await fetch(`/${locale}/api/token-count`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: fileObjects,
    }),
  });

  const result = await response.json();

  return result.totalTokens;
};
