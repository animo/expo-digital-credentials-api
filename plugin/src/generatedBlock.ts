/**
 * Comment syntax of the file the block is written into. Every character the markers are built from
 * is inert in a regular expression, so the pattern below needs no escaping.
 */
type CommentPrefix = '//' | '#'

const marker = 'expo-digital-credentials-api'

/**
 * Appends `body` to `contents` as this package's generated block, dropping the block already there.
 *
 * Everything the plugin appends to a file it does not own goes through here. A fenced block is what
 * makes a prebuild over an existing project rewrite its own output instead of stacking a second copy
 * on top of it, and it tells anyone reading the file that editing the block is pointless.
 */
export function replaceGeneratedBlock(contents: string, commentPrefix: CommentPrefix, body: string) {
  const begin = `${commentPrefix} @generated begin ${marker}`
  const end = `${commentPrefix} @generated end ${marker}`

  const withoutBlock = contents.replace(new RegExp(`\\n*${begin}[\\s\\S]*?${end}`, 'g'), '').trimEnd()

  return `${withoutBlock}\n\n${begin}\n${body}\n${end}\n`
}
