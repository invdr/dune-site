// Minimal, dependency-free XML reader for the QuickDeal native feed
// (`format=quickDeal`). The feed is plain, attribute-light XML — nested
// elements, repeated siblings (images, descriptions, payment methods), and
// HTML entity-encoded text. A focused parser keeps this controlled format from
// pulling in a general XML dependency; if the feed ever grows attributes or
// CDATA we revisit. Parsed into a tolerant node tree the mapper navigates with
// the `child`/`children`/`textAt` helpers below.

export type XmlNode = { tag: string; text: string; children: XmlNode[] }

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&amp;/g, '&') // ampersand last so it doesn't re-trigger the above
}

const TAG = /<(\/?)([\w.:-]+)([^>]*?)(\/?)>/g

export function parseXml(input: string): XmlNode {
  const xml = input.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const root: XmlNode = { tag: '#root', text: '', children: [] }
  const stack: XmlNode[] = [root]

  let lastIndex = 0
  let match: RegExpExecArray | null
  TAG.lastIndex = 0
  while ((match = TAG.exec(xml)) !== null) {
    const between = xml.slice(lastIndex, match.index)
    if (between && between.trim()) {
      const top = stack[stack.length - 1]
      if (top) top.text += decodeEntities(between)
    }
    lastIndex = TAG.lastIndex

    const [, closing, name, , selfClose] = match
    if (closing) {
      if (stack.length > 1) stack.pop()
      continue
    }

    const node: XmlNode = { tag: name!, text: '', children: [] }
    stack[stack.length - 1]!.children.push(node)
    if (!selfClose) stack.push(node)
  }

  return root
}

export function child(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return node?.children.find((c) => c.tag === tag)
}

export function children(node: XmlNode | undefined, tag: string): XmlNode[] {
  return node ? node.children.filter((c) => c.tag === tag) : []
}

// First descendant value along a tag path, e.g. textAt(obj, 'bargainTerms',
// 'price'). Returns undefined if any step is missing or the value is blank.
export function textAt(node: XmlNode | undefined, ...path: string[]): string | undefined {
  let current: XmlNode | undefined = node
  for (const tag of path) {
    current = child(current, tag)
    if (!current) return undefined
  }
  if (!current) return undefined
  const value = current.text.trim()
  return value === '' ? undefined : value
}
