import path from 'path';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { aiManagerService } from '../ai/ai-manager.service';
import { ApiError } from '../middleware/validate.middleware';
import { SupportedDocumentType } from '../models/document.model';
import { AuthContext } from '../repositories/base.repository';

export interface ExtractedUnit {
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
  text: string;
}

export interface DocumentExtractionResult {
  docType: SupportedDocumentType;
  mimeType: string;
  fullText: string;
  units: ExtractedUnit[];
  pageCount: number;
  usedOcr: boolean;
  ocrWarnings: string[];
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.csv',
  '.txt',
  '.md',
  '.markdown',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, idx) => buf[idx] === b);
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function sanitizeXmlTextRuns(xml: string): string {
  // Split paragraphs by </a:p> or </w:p> for readable structure
  const paragraphs = xml.split(/<\/a:p>|<\/w:p>|<\/row>/g);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const matches = para.match(/<(?:a:t|t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:a:t|t)>/g);
    if (!matches) continue;
    const joined = matches
      .map((tag) => decodeXmlEntities(tag.replace(/<[^>]+>/g, '')))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (joined) lines.push(joined);
  }
  return lines.join('\n');
}

export function validateUploadedFile(file: Express.Multer.File): {
  ext: string;
  docType: SupportedDocumentType;
  mimeType: string;
} {
  const safeName = path.basename(file.originalname || '').trim();
  const ext = path.extname(safeName).toLowerCase();

  if (!safeName || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new ApiError(
      400,
      `Unsupported file type "${ext || 'unknown'}". Allowed formats: PDF, DOCX, PPTX, XLSX, CSV, MD, TXT, PNG, JPG, WEBP.`,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, 'Uploaded file is empty.', 'EMPTY_FILE');
  }

  const buf = file.buffer;

  if (ext === '.pdf') {
    if (!buf.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      throw new ApiError(400, 'Invalid or corrupted PDF header.', 'INVALID_FILE_SIGNATURE');
    }
    return { ext, docType: 'pdf', mimeType: 'application/pdf' };
  }

  if (ext === '.docx' || ext === '.pptx' || ext === '.xlsx') {
    if (!startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04]) && !startsWithBytes(buf, [0x50, 0x4b, 0x05, 0x06])) {
      throw new ApiError(400, `Invalid or corrupted ${ext.toUpperCase()} archive.`, 'INVALID_FILE_SIGNATURE');
    }
    const mimeMap: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    const typeMap: Record<string, SupportedDocumentType> = {
      '.docx': 'docx',
      '.pptx': 'pptx',
      '.xlsx': 'xlsx',
    };
    return { ext, docType: typeMap[ext], mimeType: mimeMap[ext] };
  }

  if (ext === '.png') {
    if (!startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47])) {
      throw new ApiError(400, 'Invalid PNG image signature.', 'INVALID_FILE_SIGNATURE');
    }
    return { ext, docType: 'image', mimeType: 'image/png' };
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    if (!startsWithBytes(buf, [0xff, 0xd8, 0xff])) {
      throw new ApiError(400, 'Invalid JPEG image signature.', 'INVALID_FILE_SIGNATURE');
    }
    return { ext, docType: 'image', mimeType: 'image/jpeg' };
  }

  if (ext === '.webp') {
    const riff = buf.subarray(0, 4).toString('ascii') === 'RIFF';
    const webp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!riff || !webp) {
      throw new ApiError(400, 'Invalid WEBP image signature.', 'INVALID_FILE_SIGNATURE');
    }
    return { ext, docType: 'image', mimeType: 'image/webp' };
  }

  // Plain-text / Markdown / CSV check: reject binary payloads containing null bytes
  if (buf.subarray(0, 8192).includes(0)) {
    throw new ApiError(400, 'Text file appears to contain binary data.', 'INVALID_TEXT_FILE');
  }

  const docType: SupportedDocumentType =
    ext === '.md' || ext === '.markdown' ? 'markdown' : ext === '.csv' ? 'csv' : 'text';
  const mimeType =
    docType === 'markdown' ? 'text/markdown' : docType === 'csv' ? 'text/csv' : 'text/plain';

  return { ext, docType, mimeType };
}

export class DocumentExtractorService {
  public async extractFromFile(
    file: Express.Multer.File,
    auth?: AuthContext,
    preferredModel?: string
  ): Promise<DocumentExtractionResult> {
    const { docType, mimeType } = validateUploadedFile(file);

    switch (docType) {
      case 'pdf':
        return this.extractPdf(file.buffer, mimeType, auth, preferredModel);
      case 'docx':
        return this.extractDocx(file.buffer, mimeType);
      case 'pptx':
        return this.extractPptx(file.buffer, mimeType);
      case 'xlsx':
        return this.extractXlsx(file.buffer, mimeType);
      case 'image':
        return this.extractImageOcr(file.buffer, mimeType, file.originalname, auth, preferredModel);
      case 'markdown':
      case 'csv':
      case 'text':
      default:
        return this.extractPlainText(file.buffer.toString('utf-8'), docType, mimeType);
    }
  }

  public extractPlainText(
    rawText: string,
    docType: SupportedDocumentType = 'text',
    mimeType = 'text/plain'
  ): DocumentExtractionResult {
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      throw new ApiError(400, 'Document contains no readable text.', 'EMPTY_CONTENT');
    }

    const units: ExtractedUnit[] = [];
    const lines = normalized.split('\n');
    let currentHeading = 'Main Content';
    let buffer: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        if (buffer.length > 0) {
          units.push({ sectionHeading: currentHeading, text: buffer.join('\n').trim() });
          buffer = [];
        }
        currentHeading = headingMatch[1].trim().slice(0, 200);
        buffer.push(line);
      } else {
        buffer.push(line);
      }
    }
    if (buffer.length > 0) {
      units.push({ sectionHeading: currentHeading, text: buffer.join('\n').trim() });
    }

    return {
      docType,
      mimeType,
      fullText: normalized,
      units: units.filter((u) => u.text.length > 0),
      pageCount: 1,
      usedOcr: false,
      ocrWarnings: [],
    };
  }

  private async extractPdf(
    buffer: Buffer,
    mimeType: string,
    auth?: AuthContext,
    preferredModel?: string
  ): Promise<DocumentExtractionResult> {
    const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

    let pdfDoc: any;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        verbosity: 0,
      });
      pdfDoc = await loadingTask.promise;
    } catch (err: any) {
      throw new ApiError(
        400,
        `Could not parse PDF file: ${err?.message || 'corrupted or password-protected PDF'}.`,
        'PDF_PARSE_ERROR'
      );
    }

    const totalPages: number = pdfDoc.numPages || 0;
    if (totalPages === 0) {
      throw new ApiError(400, 'PDF has 0 readable pages.', 'EMPTY_PDF');
    }

    const units: ExtractedUnit[] = [];
    const lowTextPages: number[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = (textContent.items || []) as Array<{ str?: string; hasEOL?: boolean }>;
      let pageText = '';
      for (const item of items) {
        if (typeof item.str === 'string') {
          pageText += item.str;
          pageText += item.hasEOL ? '\n' : ' ';
        }
      }
      const cleaned = pageText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (cleaned.length < 30) {
        lowTextPages.push(pageNum);
      }
      if (cleaned.length > 0) {
        units.push({
          pageNumber: pageNum,
          sectionHeading: `Page ${pageNum}`,
          text: cleaned,
        });
      }
    }

    let usedOcr = false;
    const ocrWarnings: string[] = [];

    // Trigger multimodal OCR if scanned or partially scanned PDF detected
    if (lowTextPages.length > 0 && buffer.length <= 9 * 1024 * 1024) {
      usedOcr = true;
      try {
        const ocrPrompt = `Perform accurate OCR transcription on this PDF document.
Focus specifically on scanned or low-text pages: ${lowTextPages.slice(0, 40).join(', ')}.
Preserve headings, bullet lists, tables, mathematical formulas (in LaTeX), and captions.
Format output clearly with page markers like [Page N] before each page's text.
If any handwritten text or scan is illegible, mark it as [illegible scan] and do NOT guess or fabricate content.`;

        const managedOcr = await aiManagerService.generate({
          taskType: 'multimodal',
          preferredModel,
          feature: 'ocr',
          promptSummary: `PDF Multimodal OCR (${lowTextPages.length} low-text pages)`,
          auth,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: buffer.toString('base64'),
                  },
                },
                { text: ocrPrompt },
              ],
            },
          ],
        });

        const ocrText = (managedOcr.text || '').trim();
        if (ocrText.length > 20) {
          // If almost the entire PDF was scanned, replace/merge cleanly by [Page N] markers
          const parsedOcrUnits = this.parsePageMarkers(ocrText, totalPages);
          if (parsedOcrUnits.length > 0) {
            for (const ocrUnit of parsedOcrUnits) {
              const existingIdx = units.findIndex((u) => u.pageNumber === ocrUnit.pageNumber);
              if (existingIdx === -1) {
                units.push(ocrUnit);
              } else if (units[existingIdx].text.length < 30) {
                units[existingIdx] = ocrUnit;
              }
            }
          } else {
            units.push({
              pageNumber: lowTextPages[0],
              sectionHeading: `OCR Extracted Content (Pages ${lowTextPages.join(', ')})`,
              text: ocrText,
            });
          }

          if (ocrText.includes('[illegible')) {
            ocrWarnings.push(
              `Some scanned regions on page(s) ${lowTextPages.join(', ')} had low scan legibility.`
            );
          }
        } else {
          ocrWarnings.push(
            `OCR returned minimal readable text for scanned page(s) ${lowTextPages.join(', ')}.`
          );
        }
      } catch (ocrErr: any) {
        ocrWarnings.push(
          `OCR could not process scanned page(s) ${lowTextPages.join(', ')}: ${ocrErr?.message || 'OCR error'}.`
        );
      }
    } else if (lowTextPages.length > 0) {
      ocrWarnings.push(
        `Page(s) ${lowTextPages.join(', ')} contain little selectable text and file exceeded direct inline OCR threshold.`
      );
    }

    units.sort((a, b) => (a.pageNumber || 9999) - (b.pageNumber || 9999));

    const fullText = units
      .map((u) => `[Page ${u.pageNumber || 1}]\n${u.text}`)
      .join('\n\n')
      .trim();

    if (!fullText) {
      throw new ApiError(
        422,
        'No readable text could be extracted from this PDF (even after OCR check).',
        'PDF_NO_TEXT'
      );
    }

    return {
      docType: 'pdf',
      mimeType,
      fullText,
      units,
      pageCount: totalPages,
      usedOcr,
      ocrWarnings,
    };
  }

  private parsePageMarkers(text: string, maxPages: number): ExtractedUnit[] {
    const regex = /\[Page\s+(\d+)\]/gi;
    const matches: Array<{ page: number; index: number; len: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const page = Number(m[1]);
      if (page >= 1 && page <= maxPages + 2) {
        matches.push({ page, index: m.index, len: m[0].length });
      }
    }
    if (matches.length === 0) return [];
    const out: ExtractedUnit[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].len;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const body = text.slice(start, end).trim();
      if (body) {
        out.push({
          pageNumber: matches[i].page,
          sectionHeading: `Page ${matches[i].page} (OCR)`,
          text: body,
        });
      }
    }
    return out;
  }

  private async extractDocx(buffer: Buffer, mimeType: string): Promise<DocumentExtractionResult> {
    const [rawRes, htmlRes] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);

    const rawText = (rawRes.value || '').replace(/\r\n/g, '\n').trim();
    if (!rawText) {
      throw new ApiError(400, 'DOCX document contains no readable text.', 'EMPTY_DOCX');
    }

    // Extract section headings from HTML output if present
    const units: ExtractedUnit[] = [];
    const htmlBlocks = (htmlRes.value || '')
      .replace(/<\/(h1|h2|h3|p|li|tr)>/gi, '\n')
      .replace(/<h([1-3])[^>]*>/gi, '\n#HEADING#: ')
      .replace(/<[^>]+>/g, ' ')
      .split('\n')
      .map((l) => decodeXmlEntities(l).replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    let currentHeading = 'Document Body';
    let currentLines: string[] = [];
    for (const line of htmlBlocks) {
      if (line.startsWith('#HEADING#:')) {
        if (currentLines.length > 0) {
          units.push({ sectionHeading: currentHeading, text: currentLines.join('\n') });
          currentLines = [];
        }
        currentHeading = line.replace('#HEADING#:', '').trim().slice(0, 200) || 'Section';
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0) {
      units.push({ sectionHeading: currentHeading, text: currentLines.join('\n') });
    }

    return {
      docType: 'docx',
      mimeType,
      fullText: rawText,
      units: units.length > 0 ? units : [{ sectionHeading: 'Document', text: rawText }],
      pageCount: Math.max(1, Math.ceil(rawText.length / 2500)),
      usedOcr: false,
      ocrWarnings: [],
    };
  }

  private async extractPptx(buffer: Buffer, mimeType: string): Promise<DocumentExtractionResult> {
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
        const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
        return na - nb;
      });

    if (slidePaths.length === 0) {
      throw new ApiError(400, 'PPTX presentation contains no readable slides.', 'EMPTY_PPTX');
    }

    const units: ExtractedUnit[] = [];
    for (const slidePath of slidePaths) {
      const slideNum = Number(slidePath.match(/slide(\d+)\.xml/)?.[1] || 1);
      const slideXml = await zip.files[slidePath].async('string');
      let slideText = sanitizeXmlTextRuns(slideXml);

      // Include presenter notes if present
      const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
      if (zip.files[notesPath]) {
        const notesXml = await zip.files[notesPath].async('string');
        const notesText = sanitizeXmlTextRuns(notesXml);
        if (notesText) {
          slideText = `${slideText}\n[Speaker Notes]\n${notesText}`.trim();
        }
      }

      if (slideText.trim()) {
        const firstLine = slideText.split('\n')[0].slice(0, 150);
        units.push({
          slideNumber: slideNum,
          sectionHeading: `Slide ${slideNum}: ${firstLine}`,
          text: slideText,
        });
      }
    }

    const fullText = units
      .map((u) => `[Slide ${u.slideNumber}]\n${u.text}`)
      .join('\n\n')
      .trim();

    if (!fullText) {
      throw new ApiError(400, 'No readable text found inside PPTX slides.', 'EMPTY_PPTX');
    }

    return {
      docType: 'pptx',
      mimeType,
      fullText,
      units,
      pageCount: slidePaths.length,
      usedOcr: false,
      ocrWarnings: [],
    };
  }

  private async extractXlsx(buffer: Buffer, mimeType: string): Promise<DocumentExtractionResult> {
    const zip = await JSZip.loadAsync(buffer);
    const sharedStringsXml = zip.files['xl/sharedStrings.xml']
      ? await zip.files['xl/sharedStrings.xml'].async('string')
      : '';

    const sharedStrings: string[] = [];
    if (sharedStringsXml) {
      const siMatches = sharedStringsXml.match(/<si>[\s\S]*?<\/si>/g) || [];
      for (const si of siMatches) {
        const textParts = (si.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map((t) =>
          decodeXmlEntities(t.replace(/<[^>]+>/g, ''))
        );
        sharedStrings.push(textParts.join(''));
      }
    }

    const sheetPaths = Object.keys(zip.files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort();

    if (sheetPaths.length === 0) {
      throw new ApiError(400, 'XLSX workbook contains no worksheets.', 'EMPTY_XLSX');
    }

    const units: ExtractedUnit[] = [];
    for (let i = 0; i < sheetPaths.length; i++) {
      const xml = await zip.files[sheetPaths[i]].async('string');
      const rows = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
      const rowLines: string[] = [];

      for (const row of rows) {
        const cells = row.match(/<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
        const vals: string[] = [];
        for (const cell of cells) {
          const isShared = /t="s"/.test(cell);
          const vMatch = cell.match(/<v>([\s\S]*?)<\/v>/);
          const inlineMatch = cell.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
          if (inlineMatch) {
            vals.push(decodeXmlEntities(inlineMatch[1]));
          } else if (vMatch) {
            const rawVal = vMatch[1].trim();
            if (isShared) {
              vals.push(sharedStrings[Number(rawVal)] ?? rawVal);
            } else {
              vals.push(rawVal);
            }
          }
        }
        const line = vals.filter(Boolean).join(' | ');
        if (line) rowLines.push(line);
      }

      if (rowLines.length > 0) {
        units.push({
          pageNumber: i + 1,
          sectionHeading: `Sheet ${i + 1}`,
          text: rowLines.join('\n'),
        });
      }
    }

    const fullText = units.map((u) => `[${u.sectionHeading}]\n${u.text}`).join('\n\n').trim();
    if (!fullText) {
      throw new ApiError(400, 'XLSX workbook contains no readable cell values.', 'EMPTY_XLSX');
    }

    return {
      docType: 'xlsx',
      mimeType,
      fullText,
      units,
      pageCount: sheetPaths.length,
      usedOcr: false,
      ocrWarnings: [],
    };
  }

  private async extractImageOcr(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    auth?: AuthContext,
    preferredModel?: string
  ): Promise<DocumentExtractionResult> {
    const prompt = `Transcribe ALL printed and handwritten text, equations, labels, diagrams, and table values from this study image (${filename}).
Rules:
1. Reproduce text accurately and preserve section headings and structure in Markdown.
2. Convert mathematical formulas into clean LaTeX ($...$ or $$...$$).
3. If any part of handwriting or image text is blurry or unreadable, write [illegible] rather than guessing or inventing content.
4. After the transcription, add a concise "## Visual Diagram Notes" section only if the image contains diagrams/charts.`;

    const managedOcr = await aiManagerService.generate({
      taskType: 'multimodal',
      preferredModel,
      feature: 'ocr',
      promptSummary: `Image / Handwritten Notes OCR (${filename})`,
      auth,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: buffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    const text = (managedOcr.text || '').trim();
    if (!text) {
      throw new ApiError(422, 'OCR failed to extract text from the uploaded image.', 'OCR_FAILED');
    }

    const warnings: string[] = [];
    if (text.toLowerCase().includes('[illegible]')) {
      warnings.push('Some handwritten or blurry regions were marked as [illegible].');
    }

    return {
      docType: 'image',
      mimeType,
      fullText: text,
      units: [{ pageNumber: 1, sectionHeading: 'Image OCR Transcription', text }],
      pageCount: 1,
      usedOcr: true,
      ocrWarnings: warnings,
    };
  }
}

export const documentExtractorService = new DocumentExtractorService();
