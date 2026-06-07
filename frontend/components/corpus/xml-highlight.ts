/**
 * Pure AKN-XML → highlighted-HTML string builder for the XML pane's FALLBACK
 * renderer. The primary renderer is a DOMParser structured tree (see xml-pane);
 * this lighter path is used when the parse fails OR the element count is large
 * (the 3 biggest laws), where mounting ~6k React nodes would jank — a single
 * `dangerouslySetInnerHTML` is dramatically cheaper. Output preserves the source
 * indentation (rendered inside a <pre>) and tags carry `data-eid` for scrolling.
 *
 * Token classes are literal Tailwind utilities so the JIT content-scan emits them.
 */

export const XML_CLS = {
  punc: 'text-muted-foreground/45',
  tag: 'text-primary/90',
  attr: 'text-info',
  val: 'text-foreground/55',
  text: 'text-foreground/85',
  decl: 'text-muted-foreground/55',
} as const

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Colorise the attributes portion of a start tag (e.g. ` eId="art_1" x="y"`). */
function highlightAttrs(attrText: string): string {
  return attrText.replace(
    /([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/g,
    (_m, name: string, eq: string, value: string) =>
      `<span class="${XML_CLS.attr}">${esc(name)}</span>` +
      `<span class="${XML_CLS.punc}">${esc(eq)}</span>` +
      `<span class="${XML_CLS.val}">${esc(value)}</span>`,
  )
}

function highlightTag(tag: string): string {
  // XML declaration / processing instruction / comment
  if (/^<\?/.test(tag) || /^<!--/.test(tag) || /^<!/.test(tag)) {
    return `<span class="${XML_CLS.decl}">${esc(tag)}</span>`
  }

  const close = /^<\//.test(tag)
  const selfClose = /\/>$/.test(tag)
  const inner = tag.replace(/^<\/?/, '').replace(/\/?>$/, '')
  const nameMatch = /^([\w:.-]+)/.exec(inner)
  const name = nameMatch ? nameMatch[1] : inner
  const attrText = nameMatch ? inner.slice(name.length) : ''

  const eidMatch = /\beId\s*=\s*"([^"]*)"/.exec(tag)
  const dataEid = eidMatch ? ` data-eid="${esc(eidMatch[1])}"` : ''

  const open = `<span class="${XML_CLS.punc}">&lt;${close ? '/' : ''}</span>`
  const tagName = `<span class="${XML_CLS.tag}">${esc(name)}</span>`
  const attrs = attrText ? highlightAttrs(attrText) : ''
  const end = `<span class="${XML_CLS.punc}">${selfClose ? '/&gt;' : '&gt;'}</span>`

  return `<span${dataEid}>${open}${tagName}${attrs}${end}</span>`
}

/**
 * Convert raw XML to a highlighted HTML string. Text between tags is escaped and
 * wrapped; tags are tokenised. Returns inner HTML for a <pre> (whitespace kept).
 */
export function highlightXmlToHtml(xml: string): string {
  const tagRe = /<[^>]+>/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(xml)) !== null) {
    if (m.index > last) {
      const text = xml.slice(last, m.index)
      if (text.trim()) out += `<span class="${XML_CLS.text}">${esc(text)}</span>`
      else out += esc(text)
    }
    out += highlightTag(m[0])
    last = tagRe.lastIndex
  }
  if (last < xml.length) out += esc(xml.slice(last))
  return out
}
