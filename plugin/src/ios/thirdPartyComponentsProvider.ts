import fs from 'node:fs'
import path from 'node:path'

/**
 * Rewrites React Native's generated `RCTThirdPartyComponentsProvider` so a component class that is
 * not linked into the running target is skipped instead of crashing it.
 *
 * Codegen writes one provider from the *app's* link set and compiles it into every target in the
 * project, as an `NSDictionary` literal of `NSClassFromString` lookups:
 *
 * ```objc
 * thirdPartyComponents = @{
 *   @"RNSScreenStack": NSClassFromString(@"RNSScreenStackView"), // react-native-screens
 * };
 * ```
 *
 * A class the extension does not link resolves to nil, and a dictionary literal raises
 * `NSInvalidArgumentException` on a nil value — so leaving out any package that registers a Fabric
 * component takes the request UI down on the first request, before it draws anything. That is what
 * makes `ios.excludedPackages` unusable for React Native modules without this.
 *
 * The rewrite is the shape codegen already emits for `RCTModuleProviders` next door — build a
 * mutable dictionary, look each class up, skip the ones that are not there — so the app, which
 * links all of them, is unaffected, and every target ends up with exactly what it linked.
 *
 * @see https://github.com/facebook/react-native/issues/56469 — the upstream report for multi-target
 * projects, closed by the stale bot rather than on the merits.
 */

const providerFileName = 'RCTThirdPartyComponentsProvider.mm'

/** Written into the rewritten file, and what makes running this twice a no-op. */
const marker = '// @generated nil-safe by expo-digital-credentials-api'

/**
 * The dictionary literal, captured with the indentation of its closing brace so the rewrite lines
 * up with the rest of the generated file.
 */
const literalPattern = /thirdPartyComponents = @\{\n([\s\S]*?)\n([ \t]*)\};/

const classLookupPattern = /NSClassFromString\(\s*(@"[^"]*")\s*\)/g

/**
 * The rewritten source, or `null` when there is nothing to do — the file is already nil-safe, or it
 * is not the shape this knows how to rewrite.
 *
 * Returning `null` rather than throwing is deliberate: a codegen output that changed shape should
 * leave the build exactly as it is today, which still works for everyone who links everything.
 */
export function makeNilSafe(source: string): string | null {
  if (source.includes(marker)) return null

  const literal = source.match(literalPattern)
  if (!literal) return null

  const [matched, entries, indent] = literal
  if (!classLookupPattern.test(entries)) return null
  classLookupPattern.lastIndex = 0

  // Only the lookups change; the keys, the comment naming each package and the indentation are the
  // generated file's own, and stay that way so a diff against it reads as this one change.
  const classNames = entries.replace(classLookupPattern, '$1')

  const body = `${marker}
${indent}NSDictionary<NSString *, NSString *> *classNames = @{
${classNames}
${indent}};

${indent}NSMutableDictionary<NSString *, Class<RCTComponentViewProtocol>> *components =
${indent}    [NSMutableDictionary dictionaryWithCapacity:classNames.count];

${indent}for (NSString *name in classNames) {
${indent}  Class klass = NSClassFromString(classNames[name]);
${indent}  // Not an error: a target that does not link the package does not have the class either.
${indent}  if (klass == nil) continue;
${indent}  components[name] = klass;
${indent}}

${indent}thirdPartyComponents = [components copy];`

  return source.replace(matched, body)
}

/**
 * Rewrites the provider under `searchRoot`, and reports what it did.
 *
 * The file is codegen output, so where it sits has moved between React Native versions — directly
 * under the output directory in some, under `ReactCodegen/` in others. Both are looked at rather
 * than hardcoded, and a build that has not run codegen yet is not an error.
 */
export function run(searchRoot: string) {
  const filePath = find(searchRoot)
  if (!filePath) {
    console.log(`[expo-digital-credentials-api] No ${providerFileName} under ${searchRoot}, nothing to rewrite`)
    return
  }

  const source = fs.readFileSync(filePath, 'utf8')
  const nilSafe = makeNilSafe(source)
  if (!nilSafe) return

  fs.writeFileSync(filePath, nilSafe)
  console.log(`[expo-digital-credentials-api] Rewrote ${filePath} to skip unlinked Fabric components`)
}

/** The provider directly under `searchRoot` or one directory below it, whichever exists first. */
function find(searchRoot: string) {
  const direct = path.join(searchRoot, providerFileName)
  if (fs.existsSync(direct)) return direct

  if (!fs.existsSync(searchRoot)) return undefined

  for (const entry of fs.readdirSync(searchRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const nested = path.join(searchRoot, entry.name, providerFileName)
    if (fs.existsSync(nested)) return nested
  }

  return undefined
}

if (require.main === module) {
  const [searchRoot] = process.argv.slice(2)
  if (!searchRoot) throw new Error(`Usage: ${path.basename(__filename)} <codegen output directory>`)

  run(searchRoot)
}
