# Maestro flows (smoke e2e)

The full e2e suite is Detox (`e2e/`, see e2e/README.md). These flows are a lighter
smoke check per app that runs on any installed build:

    maestro test .maestro/board-save-profile.yaml                        # IssieBoard (iOS com.issieshapiro.Issieboard)
    maestro test .maestro/voice-type-and-save.yaml                       # IssieVoice (iOS org.issieshapiro.IssieVoice)
    maestro test .maestro/calc-smoke.yaml                                # IssieCalc (iOS com.issieshapiro.IssieCalc)
    maestro test -e APP_ID=org.issieshapiro.issievoice .maestro/voice-type-and-save.yaml   # Android

The keyboard inside the apps is a native view; its keys are tapped by their caption,
which works where the native renderer exposes accessibility labels (iOS does).
