/**
 * Strict SVG sanitizer for rendered Mermaid/concept-map SVGs.
 * Strips executable elements, event handler attributes, and unsafe URIs.
 */
export function sanitizeSvg(svg: string): string {
  if (!svg || typeof svg !== 'string') return '';

  let cleaned = svg;

  // Remove dangerous elements completely
  const dangerousTags = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'applet', 'meta', 'link'];
  for (const tag of dangerousTags) {
    const pairedRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(pairedRegex, '').replace(selfClosingRegex, '');
  }

  // Strip inline event handlers (onclick=, onload=, onerror=, etc.)
  cleaned = cleaned.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: / vbscript: / data:text/html URIs in href, xlink:href, or src attributes
  cleaned = cleaned.replace(
    /((?:xlink:)?href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (full, attr, dq, sq, bare) => {
      const val = (dq ?? sq ?? bare ?? '').trim().toLowerCase();
      if (
        val.startsWith('javascript:') ||
        val.startsWith('vbscript:') ||
        val.startsWith('data:text/html') ||
        val.startsWith('data:image/svg+xml')
      ) {
        return `${attr}="#"`;
      }
      return full;
    }
  );

  // Strip CSS expression() or javascript: inside inline style attributes
  cleaned = cleaned.replace(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (full, dq, sq) => {
    const val = (dq ?? sq ?? '').toLowerCase();
    if (val.includes('expression(') || val.includes('javascript:') || val.includes('behavior:')) {
      return 'style=""';
    }
    return full;
  });

  return cleaned;
}
