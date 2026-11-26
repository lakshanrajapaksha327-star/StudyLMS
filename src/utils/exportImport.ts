import JSZip from 'jszip';

export interface ExportSection {
  heading?: string;
  body: string;
}

export function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeFilename(name: string, ext: string): string {
  const base = (name || 'studylms_export')
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return `${base || 'studylms_export'}.${ext}`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * RFC 4180 CSV serialization with formula-injection neutralization (=, +, -, @, \t, \r).
 */
export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  triggerBlobDownload(blob, safeFilename(filename, 'csv'));
}

export function exportToJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, safeFilename(filename, 'json'));
}

export function exportToMarkdown(filename: string, title: string, sections: ExportSection[]): void {
  const parts = [`# ${title}`, ''];
  for (const sec of sections) {
    if (sec.heading) {
      parts.push(`## ${sec.heading}`, '');
    }
    parts.push(sec.body, '');
  }
  const blob = new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' });
  triggerBlobDownload(blob, safeFilename(filename, 'md'));
}

/**
 * Builds a real, valid OpenXML (.docx) file using JSZip containing
 * [Content_Types].xml, _rels/.rels, and word/document.xml.
 */
export async function buildDocxBlob(title: string, sections: ExportSection[]): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const paragraphs: string[] = [];

  const pushPara = (text: string, bold = false, sizeHalfPt = 22) => {
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
      const rPr = `<w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${sizeHalfPt}"/></w:rPr>`;
      paragraphs.push(
        `<w:p><w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      );
    }
  };

  pushPara(title, true, 36);
  pushPara(`Exported from StudyLMS on ${new Date().toLocaleDateString()}`, false, 18);
  pushPara('', false, 20);

  for (const sec of sections) {
    if (sec.heading) {
      pushPara(sec.heading, true, 28);
    }
    if (sec.body) {
      pushPara(sec.body, false, 22);
    }
    pushPara('', false, 20);
  }

  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function exportToDocx(filename: string, title: string, sections: ExportSection[]): Promise<void> {
  const blob = await buildDocxBlob(title, sections);
  triggerBlobDownload(blob, safeFilename(filename, 'docx'));
}

/**
 * Generates an escaped printable view inside an isolated print iframe and triggers Save as PDF / Print.
 * Uses window.print without window.open (iFrame safe).
 */
export function exportToPrintablePdf(title: string, sections: ExportSection[]): void {
  const bodyHtml = sections
    .map(
      (s) => `
      <section style="margin-bottom: 18px; page-break-inside: avoid;">
        ${s.heading ? `<h2 style="font-size: 16px; margin: 0 0 6px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${escapeHtml(s.heading)}</h2>` : ''}
        <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: system-ui, -apple-system, sans-serif; font-size: 12.5px; line-height: 1.55; margin: 0; color: #334155;">${escapeHtml(s.body)}</pre>
      </section>
    `
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
    header { margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
    .meta { font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">StudyLMS Export • ${escapeHtml(new Date().toLocaleString())}</div>
  </header>
  ${bodyHtml}
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
    }
  }, 200);
}

export function exportDiagramSvgFile(filename: string, svgString: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerBlobDownload(blob, safeFilename(filename, 'svg'));
}

export function exportDiagramMmdFile(filename: string, mermaidSyntax: string): void {
  const blob = new Blob([mermaidSyntax], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, safeFilename(filename, 'mmd'));
}

export async function exportDiagramPngFile(filename: string, svgString: string): Promise<void> {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not rasterize diagram SVG to PNG.'));
      img.src = url;
    });
    const width = Math.max(800, img.naturalWidth || 1000);
    const height = Math.max(500, img.naturalHeight || 650);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('PNG encoding failed.');
    triggerBlobDownload(pngBlob, safeFilename(filename, 'png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------- IMPORT PARSERS ----------------

function parseCsvLines(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

export interface ParsedFlashcardRow {
  question: string;
  answer: string;
  hint?: string;
}

export function parseFlashcardsImport(filename: string, rawText: string): ParsedFlashcardRow[] {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return [];
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (ext === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.cards)
      ? parsed.cards
      : Array.isArray(parsed?.flashcardSets?.[0]?.cards)
      ? parsed.flashcardSets[0].cards
      : [];
    return arr
      .map((item: any) => ({
        question: String(item?.question ?? item?.front ?? item?.prompt ?? '').trim(),
        answer: String(item?.answer ?? item?.back ?? item?.definition ?? '').trim(),
        hint: item?.hint ? String(item.hint).trim() : undefined,
      }))
      .filter((c: ParsedFlashcardRow) => c.question && c.answer);
  }

  const delimiter = ext === 'tsv' || (!trimmed.includes(',') && trimmed.includes('\t')) ? '\t' : ',';
  const rows = parseCsvLines(trimmed, delimiter);
  if (rows.length === 0) return [];

  const first = rows[0].map((c) => c.toLowerCase());
  const qIdx = first.findIndex((h) => h === 'question' || h === 'front' || h === 'term');
  const aIdx = first.findIndex((h) => h === 'answer' || h === 'back' || h === 'definition');
  const hIdx = first.findIndex((h) => h === 'hint');
  const hasHeader = qIdx !== -1 && aIdx !== -1;
  const startRow = hasHeader ? 1 : 0;

  return rows
    .slice(startRow)
    .map((r) => ({
      question: String(r[hasHeader ? qIdx : 0] || '').trim(),
      answer: String(r[hasHeader ? aIdx : 1] || '').trim(),
      hint: hasHeader && hIdx !== -1 && r[hIdx] ? String(r[hIdx]).trim() : r[2] ? String(r[2]).trim() : undefined,
    }))
    .filter((c) => c.question && c.answer);
}

export interface ParsedNoteImport {
  title: string;
  content: string;
  tags?: string[];
}

export function parseNotesImport(filename: string, rawText: string): ParsedNoteImport[] {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return [];
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const baseTitle = filename.replace(/\.[^.]+$/, '') || 'Imported Note';

  if (ext === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.notes) ? parsed.notes : [parsed];
    return arr
      .map((n: any, idx: number) => ({
        title: String(n?.title || `${baseTitle}${arr.length > 1 ? ` ${idx + 1}` : ''}`).trim(),
        content: String(n?.content ?? n?.body ?? '').trim(),
        tags: Array.isArray(n?.tags) ? n.tags.map(String) : ['imported'],
      }))
      .filter((n: ParsedNoteImport) => n.content);
  }

  const headingMatch = trimmed.match(/^#\s+(.+)\r?\n/);
  const title = headingMatch ? headingMatch[1].trim() : baseTitle;
  const content = headingMatch ? trimmed.slice(headingMatch[0].length).trim() : trimmed;
  return content ? [{ title, content, tags: ['imported'] }] : [];
}
