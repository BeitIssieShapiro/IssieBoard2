design a UI for an application that aids puple who cannot speak (make voice) and need this app to be able to type text and have the app read it out.
the app would have an embedded keyboard with large keys.
Top row is suggestions for words started to be typed or next word if after space.
above, there should be an area to see what you type, a fast way to ask for readout, fast way to clean the text, fast way to save the text as a "Saved sentence". Also a fast way to browse/find and find saved-sentences.
assume text sentences can be long (10 words) so we need to take that info account.
It should have simple but easy to use, no deep menus and no too small controls.



Plan
Intent & Goal
VoiceType is an assistive communication app for people who cannot speak or produce voice. Users type text using a large-key keyboard and the app reads it aloud using text-to-speech. The app helps users communicate quickly and effectively in both calm home environments and busy public places. Success means users can express themselves with minimal friction, save frequently-used phrases, and access core functions (speak, clear, save, browse) instantly without navigating menus.
Audience & Roles
Single user per device. The user is a person with speech disability who needs to type and have text spoken aloud. No additional roles or permissions needed—one user owns all saved sentences and settings.
Core Flows
These flows must work end-to-end:
User opens app → sees large keyboard with text area above → types text → word suggestions appear in top row → user taps Speak button → app reads text aloud
User types a frequently-used sentence → taps Save button → sentence is saved to library → later user taps Browse button → finds saved sentence → taps it → sentence appears in text area → taps Speak → app reads it aloud
User has text in text area → taps Clear button → text is immediately cleared and ready for new input
User types long sentence (10+ words) → text area shows full sentence with scroll if needed → user reviews text before speaking
What NOT to Do
❌ No deep menus or hidden navigation—all core functions (Speak, Clear, Save, Browse) must be visible and accessible from main screen
❌ No small controls or tiny tap targets—everything must be large enough for quick, confident tapping
❌ No cluttered interface—keep it simple and focused on the typing and speaking flow
❌ Don't require multiple taps to access saved sentences—browsing should be one tap away
❌ Don't hide the keyboard—it should be embedded and always visible on the main screen
Design Preferences
Large, accessible UI optimized for speed and clarity. Visual hierarchy: Text display area (top) → Action buttons (Speak, Clear, Save, Browse) in a prominent row → Word suggestions row → Large embedded keyboard (bottom). All controls must be large enough for quick tapping in any environment. Use high contrast for readability. Buttons should be color-coded by function: Speak (primary/prominent), Clear (secondary), Save (positive), Browse (neutral). No small text, no tiny icons. The keyboard should have generously sized keys with clear letter labels. The text area should support long sentences with automatic scroll. Word suggestions should be large tap targets. Overall aesthetic: clean, functional, accessibility-first—think medical/assistive tech with modern polish.