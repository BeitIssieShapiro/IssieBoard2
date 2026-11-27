# Maestro flows (smoke e2e)

The full e2e suite is Detox (`e2e/`, see e2e/README.md). These flows are a lighter
smoke check per app that runs on any installed build:

    maestro test .maestro/board-save-profile.yaml                        # IssieBoard (iOS com.issieshapiro.Issieboard)
    maestro test .maestro/voice-type-and-save.yaml                       # IssieVoice (iOS org.issieshapiro.IssieVoice)
    maestro test .maestro/calc-smoke.yaml                                # IssieCalc (iOS com.issieshapiro.IssieCalc)
    maestro test -e APP_ID=org.issieshapiro.issievoice .maestro/voice-type-and-save.yaml   # Android

The keyboard inside the apps is a native view; its keys are tapped by their caption,
which works where the native renderer exposes accessibility labels (iOS does).

Android: `maestro --device <emulator> test -e APP_ID=<android id> <flow>` (the id is in each flow's first line;
needs `JAVA_HOME=/opt/homebrew/opt/openjdk@21`). The flows read `appId: ${APP_ID || "<ios id>"}`: an `env:` default
would override `-e`. Debug builds load JS from Metro: on iOS point the app at it with
`xcrun simctl spawn <udid> defaults write <bundle id> RCT_jsLocation localhost:<port>`; on Android `adb reverse tcp:<port> tcp:<port>`.
