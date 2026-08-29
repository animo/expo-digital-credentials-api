import { describe, expect, test } from 'vitest'

import { makeNilSafe } from '../ios/thirdPartyComponentsProvider'

/**
 * Trimmed from what React Native 0.85 codegen writes, keeping the tab-indented entries and the
 * trailing package comment: those are the shape the rewrite has to survive, and the reason it is
 * matched rather than reconstructed.
 */
const generated = `#import <Foundation/Foundation.h>

#import "RCTThirdPartyComponentsProvider.h"
#import <React/RCTComponentViewProtocol.h>

@implementation RCTThirdPartyComponentsProvider

+ (NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents
{
  static NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *thirdPartyComponents = nil;
  static dispatch_once_t nativeComponentsToken;

  dispatch_once(&nativeComponentsToken, ^{
    thirdPartyComponents = @{
\t\t@"RNSVGCircle": NSClassFromString(@"RNSVGCircle"), // react-native-svg
\t\t@"RNSScreenStack": NSClassFromString(@"RNSScreenStackView"), // react-native-screens
    };
  });

  return thirdPartyComponents;
}

@end
`

describe('makeNilSafe', () => {
  test('looks every class up and skips the ones that are not linked', () => {
    const rewritten = makeNilSafe(generated) as string

    expect(rewritten).toContain('Class klass = NSClassFromString(classNames[name]);')
    expect(rewritten).toContain('if (klass == nil) continue;')
    expect(rewritten).toContain('thirdPartyComponents = [components copy];')
  })

  test('keeps every component, its class name and the package it came from', () => {
    const rewritten = makeNilSafe(generated) as string

    expect(rewritten).toContain('@"RNSVGCircle": @"RNSVGCircle", // react-native-svg')
    expect(rewritten).toContain('@"RNSScreenStack": @"RNSScreenStackView", // react-native-screens')
  })

  test('leaves no dictionary literal that could be handed a nil', () => {
    const rewritten = makeNilSafe(generated) as string

    expect(rewritten).not.toMatch(/@\{[\s\S]*NSClassFromString\([\s\S]*\};/)
  })

  test('leaves the rest of the generated file alone', () => {
    const rewritten = makeNilSafe(generated) as string

    expect(rewritten).toContain('@implementation RCTThirdPartyComponentsProvider')
    expect(rewritten).toContain('static dispatch_once_t nativeComponentsToken;')
    expect(rewritten).toContain('return thirdPartyComponents;')
  })

  test('does nothing the second time, so the build phase can run on every build', () => {
    const rewritten = makeNilSafe(generated) as string

    expect(makeNilSafe(rewritten)).toBeNull()
  })

  test('leaves a file it does not recognise as it is, rather than half-rewriting it', () => {
    expect(makeNilSafe('@implementation RCTThirdPartyComponentsProvider\n@end\n')).toBeNull()
  })

  test('leaves a provider with no components alone', () => {
    const empty = generated.replace(
      /thirdPartyComponents = @\{\n[\s\S]*?\n(\s*)\};/,
      'thirdPartyComponents = @{\n\n$1};'
    )

    expect(empty).not.toContain('NSClassFromString')
    expect(makeNilSafe(empty)).toBeNull()
  })
})
