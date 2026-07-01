#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(KeyboardDisabler, NSObject)

RCT_EXTERN_METHOD(disableSystemKeyboard:(nonnull NSNumber *)reactTag)

@end
