import crypto from 'crypto';
import { DocumentChunkModel } from '../models/document.model';
import { ExtractedUnit } from './document_extractor.service';

export interface ChunkBuildOptions {
  documentId: string;
  userId: string;
  notebookId: string;
  sourceTitle: string;
  targetChars?: number;
  overlapChars?: number;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitUnitIntoSegments(
  text: string,
  targetChars: number,
  overlapChars: number
): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];

  const segments: string[] = [];
  let cursor = 0;

  while (cursor < clean.length) {
    let end = Math.min(clean.length, cursor + targetChars);

    if (end < clean.length) {
      // Prefer breaking on paragraph, newline, or sentence boundary
      const window = clean.slice(cursor, end);
      const paraIdx = window.lastIndexOf('\n\n');
      const lineIdx = window.lastIndexOf('\n');
      const sentIdx = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! ')
      );

      if (paraIdx > targetChars * 0.45) {
        end = cursor + paraIdx + 2;
      } else if (lineIdx > targetChars * 0.55) {
        end = cursor + lineIdx + 1;
      } else if (sentIdx > targetChars * 0.55) {
        end = cursor + sentIdx + 2;
      } else {
        const spaceIdx = window.lastIndexOf(' ');
        if (spaceIdx > targetChars * 0.65) {
          end = cursor + spaceIdx + 1;
        }
      }
    }

    const slice = clean.slice(cursor, end).trim();
    if (slice) segments.push(slice);

    if (end >= clean.length) break;
    cursor = Math.max(cursor + 1, end - overlapChars);
  }

  return segments;
}

export class ChunkingService {
  public buildChunks(
    units: ExtractedUnit[],
    opts: ChunkBuildOptions
  ): DocumentChunkModel[] {
    const targetChars = opts.targetChars ?? 2800; // ~700 tokens
    const overlapChars = opts.overlapChars ?? 440; // ~110 tokens
    const now = new Date().toISOString();

    const chunks: DocumentChunkModel[] = [];
    let chunkIndex = 0;

    for (const unit of units) {
      const segments = splitUnitIntoSegments(unit.text, targetChars, overlapChars);
      for (const seg of segments) {
        const contentHash = crypto.createHash('sha256').update(seg).digest('hex').slice(0, 32);
        chunks.push({
          id: `chunk-${opts.documentId}-${chunkIndex}`,
          userId: opts.userId,
          notebookId: opts.notebookId,
          documentId: opts.documentId,
          chunkIndex,
          content: seg,
          contentHash,
          pageNumber: unit.pageNumber,
          slideNumber: unit.slideNumber,
          sectionHeading: unit.sectionHeading?.slice(0, 290),
          sourceTitle: opts.sourceTitle.slice(0, 290),
          tokenCount: estimateTokens(seg),
          createdAt: now,
        });
        chunkIndex++;
      }
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
