#!/usr/bin/env -S deno run --allow-read --allow-env --allow-net
/**
 * OCR CLI Tool
 *
 * Extracts text from images and PDFs using Mistral's OCR API.
 *
 * Usage:
 *   ocr.ts <file-path>
 *
 * Environment:
 *   MISTRAL_API_KEY - Required API key for Mistral AI
 *
 * Examples:
 *   ocr.ts document.pdf
 *   ocr.ts receipt.png
 *   ocr.ts invoice.jpg
 */

import { Mistral } from "@mistralai/mistralai";

const USAGE = `Usage: ocr.ts <file-path>

Extracts text from images and PDFs using Mistral's OCR API.

Arguments:
  <file-path>    Path to image (png, jpg, jpeg) or PDF file

Environment:
  MISTRAL_API_KEY    Required API key for Mistral AI

Examples:
  ocr.ts document.pdf
  ocr.ts receipt.png
  ocr.ts invoice.jpg
`;

async function main() {
  // Parse arguments
  const args = Deno.args;

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    Deno.exit(args.length === 0 ? 1 : 0);
  }

  const filePath = args[0];

  // Validate API key
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    console.error("Error: MISTRAL_API_KEY environment variable is required");
    console.error("Set it with: export MISTRAL_API_KEY=your-api-key");
    Deno.exit(1);
  }

  // Validate file exists
  try {
    const fileInfo = await Deno.stat(filePath);
    if (!fileInfo.isFile) {
      console.error(`Error: ${filePath} is not a file`);
      Deno.exit(1);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: File not found: ${filePath}`);
    } else if (error instanceof Deno.errors.PermissionDenied) {
      console.error(`Error: Permission denied reading: ${filePath}`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: Cannot access file: ${message}`);
    }
    Deno.exit(1);
  }

  // Determine file type and create document object
  const fileExtension = filePath.toLowerCase().split(".").pop();
  const isImage = ["png", "jpg", "jpeg", "avif", "webp"].includes(
    fileExtension || "",
  );
  const isPDF = ["pdf", "pptx", "docx"].includes(fileExtension || "");

  if (!isImage && !isPDF) {
    console.error(`Error: Unsupported file type: .${fileExtension}`);
    console.error(
      "Supported types: png, jpg, jpeg, avif, webp, pdf, pptx, docx",
    );
    Deno.exit(1);
  }

  // Read file and encode to base64
  let fileData: Uint8Array;
  try {
    fileData = await Deno.readFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: Failed to read file: ${message}`);
    Deno.exit(1);
  }

  // Convert to base64
  const base64Data = btoa(String.fromCharCode(...fileData));

  // Prepare document object based on file type
  const document = isImage
    ? {
      type: "image_url" as const,
      imageUrl: `data:image/${
        fileExtension === "jpg" ? "jpeg" : fileExtension
      };base64,${base64Data}`,
    }
    : {
      type: "document_url" as const,
      documentUrl: `data:application/${fileExtension};base64,${base64Data}`,
    };

  // Initialize Mistral client
  const client = new Mistral({ apiKey });

  // Call OCR API
  try {
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document,
      includeImageBase64: false,
    });

    // Extract and print text content from pages
    interface OCRPage {
      markdown?: string;
    }
    interface OCRResponseWithPages {
      pages?: OCRPage[];
    }

    const pages = (ocrResponse as OCRResponseWithPages).pages;
    if (pages && Array.isArray(pages) && pages.length > 0) {
      // Concatenate markdown from all pages
      const allText = pages.map((page) => page.markdown || "").join(
        "\n\n",
      );
      console.log(allText);
    } else {
      console.error("Warning: No content returned from OCR API");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("401") || errorMessage.includes("authentication")
    ) {
      console.error("Error: Invalid API key. Check your MISTRAL_API_KEY");
    } else if (
      errorMessage.includes("429") || errorMessage.includes("rate limit")
    ) {
      console.error("Error: Rate limit exceeded. Please try again later");
    } else if (errorMessage.includes("timeout")) {
      console.error("Error: Request timed out. The file may be too large");
    } else {
      console.error(`Error: OCR processing failed: ${errorMessage}`);
    }
    Deno.exit(1);
  }
}

// Run main and handle any uncaught errors
if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    Deno.exit(1);
  });
}
