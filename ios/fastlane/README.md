fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios test

```sh
[bundle exec] fastlane ios test
```

Run deployment regression tests with Apple actions stubbed

### ios check

```sh
[bundle exec] fastlane ios check
```

Check deployment settings and App Store Connect access (app:<name> for one app)

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Archive the apps and upload the next build of each to TestFlight (app:<name> for one app)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
