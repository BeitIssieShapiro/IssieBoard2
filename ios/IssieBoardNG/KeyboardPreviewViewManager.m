#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>

@interface RCT_EXTERN_MODULE(KeyboardPreviewViewManager, RCTViewManager)

// Export the configJson property
RCT_EXPORT_VIEW_PROPERTY(configJson, NSString)

// Export the selectedKeys property for edit mode highlighting
RCT_EXPORT_VIEW_PROPERTY(selectedKeys, NSString)

// Export the text property for external text synchronization
RCT_EXPORT_VIEW_PROPERTY(text, NSString)

// Export the onKeyPress event as a direct event (not bubbling)
RCT_EXPORT_VIEW_PROPERTY(onKeyPress, RCTBubblingEventBlock)

// Export the onSuggestionsChange event
RCT_EXPORT_VIEW_PROPERTY(onSuggestionsChange, RCTBubblingEventBlock)

@end