/**
 * Remove quotes from a string. Useful during the parsing process
 * when we need to extract identifiers.
 *
 * e.g. '"1"' => '1'
 *
 * @param text
 */
export default function unquote(text?: string): string {
  if (!text) {
    return ''
  }

  if (text.length < 2) {
    return text
  }

  if (
    text.startsWith('"') ||
    text.startsWith('`') ||
    (text.startsWith("'") && text.startsWith(text[text.length - 1]))
  ) {
    return text.substr(1, text.length - 2)
  }

  return text
}
