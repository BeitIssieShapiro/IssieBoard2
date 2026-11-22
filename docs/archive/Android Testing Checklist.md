Android Testing Checklist 
Core Keyboard Functionality
V-Basic typing - Test typing in various apps (Messages, Notes, Browser)
V-Multi-language keyboards - Switch between Hebrew (he), English (en), Arabic (ar)
V-Keyset switching - Test abc → 123 → #+= and back
V-Shift/Caps lock - Single shift, double-tap caps lock, shift icon changes
X- Backspace - Single delete, long-press continuous delete, word deletion
Nikkud (Diacritics) System
 Simple nikkud mode - Long-press Hebrew letters to see nikkud options
 Advanced nikkud mode - Dedicated nikkud picker with all options
V- Nikkud delay - Test the configurable delay for nikkud appearance
V Hidden nikkud settings - Test show/hide nikkud for specific characters
V Nikkud on appropriate chars - Should only show for Hebrew letters, not numbers/English
Word Suggestions & Auto-correct
 Word completion - Type partial word, suggestions should appear
 Auto-correct - Test fuzzy matching and auto-replace
 Default suggestions - When no word typed, show common words
 Suggestion tap - Select suggestion replaces current word + adds space
 Dictionary loading - Verify he_50k.bin, en_50k.bin, ar_50k.bin load correctly
 Disable for special fields - No suggestions in password/email/URL fields
Field Type Detection & Behavior
 Email fields - @ button should appear, suggestions disabled
 URL fields - Suggestions disabled
 Password fields - Suggestions disabled
 Phone number fields - Number keyboard
 Default text fields - Full suggestions enabled
Auto-behaviors (English keyboard)
 V-Auto-shift after punctuation - ". " → auto-capitalize next letter
 V-Auto-shift at start - First character should be capitalized
 V-Auto "I" capitalize - Typing "i " → "I "
 V-Double-space for period - "word " → "word. "
 V-Auto-return from 123 - After typing number + space, return to abc
Special Features
 V-Cursor movement - Test cursor left/right buttons
 Move cursor bubble - Verify no bubble shows for space key
 V-Extended tap areas - Edge keys should have larger touch targets
 Profile management - Create/save/load different keyboard configs
 V- Hidden keys - Test show/hide-all-others functionality
 Flex layout - Keys with flex property adjust properly
 V-ShowOn conditions - Keys appear only in correct keysets
Keyboard Preview (in React Native app)
 V-Live preview - Changes in editor reflect immediately
 V-Key highlighting - Selected keys highlight in preview
 Nikkud picker preview - Long-press shows nikkud options
 Suggestions bar - Preview shows suggestion bar when enabled
 Keyset switching - Switch keysets in preview
Configuration & Persistence
 V-Save preferences - Settings persist across app restarts
 Language-specific configs - Each keyboard remembers last keyset
 Profile switching - Switch between profiles seamlessly
 Settings UI - Open settings from keyboard (gear icon)
 V-Deep linking - Settings open from keyboard works
Edge Cases & Bug Testing
 Long-press boundaries - Test on edge keys (row start/end)
 Rapid typing - Type quickly, ensure no missed keys
 Backspace on empty - Backspace on empty field doesn't crash
 Switch keyboards - Globe button cycles through keyboards
 Dismiss keyboard - Hide keyboard button works
 Enter button actions - Test Search/Go/Send/Next/Done actions
 RTL/LTR text - Cursor movement respects text direction
 Memory leaks - Use keyboard extensively, monitor performance
Visual & Layout
 Key spacing - Consistent gaps between keys
 Font rendering - Custom font (DanaYadAlefAlefAlef) displays correctly
 Colors - Key colors, text colors match config
 Borders - Key borders render properly
 Caps lock icon - Different icon for caps lock vs shift
 Landscape mode - Keyboard adapts to landscape orientation
 Different screen sizes - Test on various device sizes
Performance
 Render speed - Keyboard appears quickly
 Keyset switching speed - Instant switching between keysets
 Suggestion generation - No lag when typing
 Memory usage - Reasonable memory footprint
 Battery impact - Doesn't drain battery excessively