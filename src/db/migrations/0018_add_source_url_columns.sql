-- Add source URL columns to references table for View Source PDF feature
-- pdf_page_url: Azure Blob URL with #page=N fragment (primary "View in PDF" link)
-- file_url: Azure Blob URL to the full PDF (no page anchor)
-- source_url: Link to the official government gazette (ET.gr)

ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "pdf_page_url" text;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "file_url" text;
ALTER TABLE "references" ADD COLUMN IF NOT EXISTS "source_url" text;
