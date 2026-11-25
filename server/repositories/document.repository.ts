import { DocumentModel } from '../models/document.model';

class DocumentRepository {
  private documents: Map<string, DocumentModel> = new Map();

  public async save(doc: DocumentModel): Promise<DocumentModel> {
    this.documents.set(doc.id, doc);
    return doc;
  }

  public async findById(id: string): Promise<DocumentModel | undefined> {
    return this.documents.get(id);
  }

  public async findAll(): Promise<DocumentModel[]> {
    return Array.from(this.documents.values());
  }

  public async findByNotebook(notebookId: string): Promise<DocumentModel[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.notebookId === notebookId
    );
  }

  public async delete(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }
}

export const documentRepository = new DocumentRepository();
