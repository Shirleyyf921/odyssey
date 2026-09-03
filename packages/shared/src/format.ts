/**
 * A character message is written as one action beat in *asterisks* followed by
 * speech (see @odyssey/prompts). This splits it for rendering. It is tolerant of
 * a stream in progress: an unclosed asterisk is treated as an action still being
 * written, so the bubble never flickers between styles.
 */
export interface ReplySegment {
  kind: 'action' | 'speech'
  text: string
}

export function parseReply(raw: string): ReplySegment[] {
  const out: ReplySegment[] = []
  const push = (kind: ReplySegment['kind'], text: string) => {
    const t = text.replace(/\s+/g, ' ').trim()
    if (t) out.push({ kind, text: t })
  }
  let rest = raw
  while (rest.length) {
    const open = rest.indexOf('*')
    if (open === -1) {
      push('speech', rest)
      break
    }
    push('speech', rest.slice(0, open))
    const close = rest.indexOf('*', open + 1)
    if (close === -1) {
      push('action', rest.slice(open + 1))
      break
    }
    push('action', rest.slice(open + 1, close))
    rest = rest.slice(close + 1)
  }
  return out
}
