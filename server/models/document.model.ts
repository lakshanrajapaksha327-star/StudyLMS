export type DocumentProcessingStatus =
  | 'uploaded'
  | 'validating'
  | 'extracting'
  | 'ocr_processing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'partially_processed'
  | 'failed';

export type SupportedDocumentType =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'csv'
  | 'text'
  | 'markdown'
  | 'image'
  | 'pasted'
  | 'url';

export interface DocumentModel {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  originalFilename?: string;
  type: SupportedDocumentType | string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileSize?: string;
  storageRef?: string;
  blobChunkCount?: number;
  processingStatus: DocumentProcessingStatus;
  progressPercent?: number;
  chunkCount?: number;
  pageCount?: number;
  embeddingModel?: string;
  ocrWarnings?: string;
  errorMessage?: string;
  content: string;
  summary: string;
  keyConcepts: string[];
  addedAt: string;
  updatedAt?: string;
}

export interface DocumentChunkModel {
  id: string;
  userId: string;
  notebookId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentHash?: string;
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
  sourceTitle?: string;
  tokenCount?: number;
  embedding?: number[];
  embeddingModel?: string;
  createdAt: string;
}

export interface DocumentBlobModel {
  id: string;
  userId: string;
  documentId: string;
  chunkIndex: number;
  totalChunks: number;
  mimeType?: string;
  originalFilename?: string;
  dataBase64: string;
  createdAt: string;
}

export interface DocumentCitation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
  excerpt: string;
  score: number;
}

export interface DocumentSummaryResult {
  summary: string;
  keyConcepts: string[];
  flashcards?: Array<{
    question: string;
    answer: string;
    hint?: string;
  }>;
}
