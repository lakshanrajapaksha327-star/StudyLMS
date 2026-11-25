import { documentRepository } from '../repositories/document.repository';
import { geminiService } from './gemini.service';
import { DocumentModel } from '../models/document.model';

export class DocumentService {
  public async processAndSaveDocument(
    title: string,
    content: string,
    type: 'pdf' | 'text' | 'markdown' | 'pasted' | 'url',
    notebookId?: string
  ) {
    // Generate AI summary, key concepts, and starter flashcards
    const aiResult = await geminiService.summarizeDocument(title, content);

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const document: DocumentModel = {
      id: docId,
      notebookId,
      title,
      type,
      content,
      summary: aiResult.summary,
      keyConcepts: aiResult.keyConcepts,
      addedAt: new Date().toISOString(),
    };

    await documentRepository.save(document);

    return {
      document,
      flashcards: aiResult.flashcards,
    };
  }

  public async getDocument(id: string) {
    return documentRepository.findById(id);
  }

  public async getAllDocuments() {
    return documentRepository.findAll();
  }

  public async deleteDocument(id: string) {
    return documentRepository.delete(id);
  }
}

export const documentService = new DocumentService();
