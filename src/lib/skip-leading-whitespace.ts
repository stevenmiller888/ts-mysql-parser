export function skipLeadingWhitespace(text: string, head: number, tail: number): number {
  while (head < tail && text[head] <= ' ') {
    head++
  }
  return head
}
