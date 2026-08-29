/**
 * Values in a `.pbxproj` are quoted whenever they need to be — a path with a space, a name with a
 * dash — and the `xcode` package hands them back with the quotes still on. Anything that compares
 * one against a plain string has to strip them first.
 */
export function unquote(value: unknown) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : undefined
}
