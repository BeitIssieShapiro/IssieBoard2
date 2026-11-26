/** @type {Detox.DetoxConfig} */
// e2e tests for the three apps (IssieBoard, IssieVoice, IssieCalc) on iPad, iPhone, an Android phone and
// an Android tablet. Configurations are named <app>.<device>, e.g. voice.ipad, calc.android.tablet.
// Device names can be overridden: DETOX_IPAD, DETOX_IPHONE, DETOX_AVD_PHONE, DETOX_AVD_TABLET, DETOX_ADB_NAME.
const APPS = {
  board: { scheme: 'IssieBoardNG', flavor: 'issieboard' },
  voice: { scheme: 'IssieVoice', flavor: 'issievoice' },
  calc: { scheme: 'IssieCalc', flavor: 'issiecalc' },
};
const cap = s => s[0].toUpperCase() + s.slice(1);

const apps = {};
const configurations = {};
for (const [name, { scheme, flavor }] of Object.entries(APPS)) {
  apps[`ios.${name}`] = {
    type: 'ios.app',
    binaryPath: `ios/build/Build/Products/Debug-iphonesimulator/${scheme}.app`,
    build: `npm run build:keyboards && xcodebuild -workspace ios/IssieBoardNG.xcworkspace -scheme ${scheme} -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build | (command -v xcpretty >/dev/null && xcpretty || cat)`,
  };
  apps[`android.${name}`] = {
    type: 'android.apk',
    binaryPath: `android/app/build/outputs/apk/${flavor}/debug/app-${flavor}-debug.apk`,
    testBinaryPath: `android/app/build/outputs/apk/androidTest/${flavor}/debug/app-${flavor}-debug-androidTest.apk`,
    build: `cd android && ./gradlew :app:assemble${cap(flavor)}Debug :app:assemble${cap(flavor)}DebugAndroidTest -DtestBuildType=debug && cd ..`,
    reversePorts: [8081],
  };
  configurations[`${name}.ipad`] = { device: 'ipad', app: `ios.${name}` };
  configurations[`${name}.iphone`] = { device: 'iphone', app: `ios.${name}` };
  configurations[`${name}.android.phone`] = { device: 'androidPhone', app: `android.${name}` };
  configurations[`${name}.android.tablet`] = { device: 'androidTablet', app: `android.${name}` };
  configurations[`${name}.android.device`] = { device: 'attached', app: `android.${name}` };
}

module.exports = {
  testRunner: {
    args: { config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 180000 },
  },
  apps,
  devices: {
    ipad: { type: 'ios.simulator', device: process.env.DETOX_IPAD_ID ? { id: process.env.DETOX_IPAD_ID } : { type: process.env.DETOX_IPAD || 'iPad (A16)' } },
    iphone: { type: 'ios.simulator', device: process.env.DETOX_IPHONE_ID ? { id: process.env.DETOX_IPHONE_ID } : { type: process.env.DETOX_IPHONE || 'iPhone 17' } },
    androidPhone: { type: 'android.emulator', device: { avdName: process.env.DETOX_AVD_PHONE || 'IssieTest' } },
    androidTablet: { type: 'android.emulator', device: { avdName: process.env.DETOX_AVD_TABLET || 'IssieTablet' } },
    // a phone or tablet connected over USB, or an emulator already running (adb devices)
    attached: { type: 'android.attached', device: { adbName: process.env.DETOX_ADB_NAME || '.*' } },
  },
  configurations,
};
