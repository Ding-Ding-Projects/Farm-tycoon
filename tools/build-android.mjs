#!/usr/bin/env node
// build-android.mjs — one command from a clean checkout to an installable APK.
//
// Everything here was learned by doing it, and three of the four steps exist because of a failure
// whose error message pointed somewhere else entirely. They are written down so nobody has to
// rediscover them.
//
//   1. JDK 21, not whatever `java` happens to be. Capacitor 6 uses Android Gradle Plugin 8.x,
//      which does not support JDK 25 - and this machine's default IS 25. Set ANDROID_JDK to a
//      21 install; a wrong JDK fails much later and much less legibly than you would hope.
//
//   2. JAVA_HOME and ANDROID_HOME must be WINDOWS paths, not Git Bash /c/... ones. Gradle passes
//      them straight to Win32 APIs, so a POSIX path produces "The filename, directory name, or
//      volume label syntax is incorrect" from deep inside a Java stack trace with no mention of
//      a path at all.
//
//   3. local.properties needs FORWARD slashes. It is a Java .properties file, so a backslash is
//      an escape character: sdk.dir=C:\Users\... silently becomes C:Users... and AGP fails in
//      SdkLocator.validateSdkPath with the same unhelpful IOException as (2). Forward slashes
//      are accepted on Windows and need no escaping.
//
//   4. The web payload is staged by tools/build-web.mjs into www/ first. capacitor.config.json
//      originally pointed webDir at the repository ROOT, which would have packed node_modules
//      (639 MB), .git, design/ and screenshots/ into the installed app.
//
// A path containing spaces is NOT a problem, despite being the first thing suspected: this
// repository builds fine from "gerk tong hui/...". That guess cost a detour, so it is recorded
// here as a dead end rather than left for someone else to make.
//
// Usage:
//   node tools/build-android.mjs            # debug APK, installable and emulator-ready
//   node tools/build-android.mjs --release  # signed release APK, needs android/keystore.properties
//   ANDROID_JDK=<path> node tools/build-android.mjs
//
// On signing: the release config is INJECTED into android/app/build.gradle by this script rather
// than edited in by hand, because android/ is regenerable and gitignored, so a hand edit is lost
// the next time anyone runs `npx cap add android`. The injection is idempotent.
//
// The keystore itself is never created, read, printed or handled here. Its passwords live in
// android/keystore.properties, which gradle reads at build time and which is gitignored along
// with *.jks and *.keystore. Nothing secret ever reaches a command argument, a log, or this file.

import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');

const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const JDK = process.env.ANDROID_JDK || process.env.JAVA_HOME;

function fail(msg) { console.error(`\nbuild-android: ${msg}\n`); process.exit(1); }

if (!existsSync(SDK)) {
  fail(`no Android SDK at ${SDK}\n`
    + '  Install the command-line tools and then:\n'
    + '    sdkmanager platform-tools "platforms;android-34" "build-tools;34.0.0" emulator\n'
    + '  or set ANDROID_HOME to an existing SDK.');
}
if (!JDK || !existsSync(JDK)) {
  fail('no JDK found. Set ANDROID_JDK to a JDK 21 install.\n'
    + '  Capacitor 6 uses AGP 8.x, which does not support JDK 25 - and a newer JDK is exactly\n'
    + '  what a modern machine has by default, so this is worth checking before anything else.');
}

// Step 4 first: the APK is only ever as correct as what got staged into www/.
console.log('[1/4] staging web payload');
execFileSync(process.execPath, [path.join(root, 'tools', 'build-web.mjs')], { stdio: 'inherit' });

if (!existsSync(androidDir)) {
  fail('no android/ project yet. Generate it once with:\n'
    + '    npx cap add android\n'
    + '  It is regenerable and therefore gitignored, so this is expected on a fresh checkout.');
}

console.log('[2/4] syncing web assets into the native project');
// execSync rather than execFileSync+shell: passing an args array with shell:true concatenates
// without escaping, which Node now deprecates for exactly the reason it sounds like.
execSync('npx cap sync android', { cwd: root, stdio: 'inherit' });

// Forward slashes, deliberately. See (3) above.
console.log('[3/4] writing local.properties');
writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${SDK.replace(/\\/g, '/')}\n`);

// ---------------------------------------------------------------------------------------
// Release signing, injected rather than hand-edited.
// ---------------------------------------------------------------------------------------
const RELEASE = process.argv.includes('--release');
const MARKER = '// injected by tools/build-android.mjs - release signing';

function injectSigningConfig() {
  const gradleFile = path.join(androidDir, 'app', 'build.gradle');
  let g = readFileSync(gradleFile, 'utf8');
  if (g.includes(MARKER)) return false;

  // Groovy, inserted inside the android { } block. Reads the properties file at build time, so
  // no password is ever an argument to anything. If the file is absent the release build simply
  // stays unsigned rather than failing, which keeps a debug build working for anyone with no key.
  const block = `
    ${MARKER}
    def keystorePropsFile = rootProject.file("keystore.properties")
    if (keystorePropsFile.exists()) {
        def keystoreProps = new Properties()
        keystorePropsFile.withInputStream { keystoreProps.load(it) }
        signingConfigs {
            release {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
        buildTypes.release.signingConfig = signingConfigs.release
    }
`;
  // Anchored on the closing brace of the android block, which is the last line that is exactly
  // "}" before "repositories {". Matching loosely here would corrupt the build file.
  // A template literal, deliberately: it spans lines legally and needs no escapes, which is the
  // whole point. Writing this as '\n}\n\nrepositories {' through a shell and a script mangled the
  // backslashes into real newlines and produced an unterminated string literal.
  const anchor = `
}

repositories {`;
  if (!g.includes(anchor)) throw new Error('build-android: could not find the end of the android block to inject into');
  g = g.replace(anchor, `
${block}}

repositories {`);
  writeFileSync(gradleFile, g);
  return true;
}

if (RELEASE) {
  const injected = injectSigningConfig();
  console.log(injected ? '[3b] release signing config injected' : '[3b] release signing config already present');
  if (!existsSync(path.join(androidDir, 'keystore.properties'))) {
    fail(`release build asked for, but android/keystore.properties does not exist.

  The keystore is a credential, so YOU create it - not this script and not any agent. Nothing
  here ever reads, prints or handles the key or its password.

  Run this once, answer its questions, and pick a password you will not lose:

    keytool -genkeypair -v -keystore android/farm-tycoon.jks -keyalg RSA -keysize 2048 -validity 10000 -alias farmtycoon

  Then create android/keystore.properties containing these four lines:

    storeFile=farm-tycoon.jks
    storePassword=<the password you chose>
    keyAlias=farmtycoon
    keyPassword=<the same password, unless you set a separate key password>

  Both files are already gitignored, so neither can be committed by accident.

  Keep the .jks safe. Lose it and you can never publish an update to the same app again, on any
  store or by sideload: Android identifies an app by its signing key, not by its name.`);
  }
}

console.log(`[4/4] gradle assemble${RELEASE ? 'Release' : 'Debug'}`);
// execSync with the path quoted, rather than execFileSync. Node refuses to spawn a .bat
// directly since the CVE-2024-27980 fix and throws EINVAL, and shell:true alone would break on
// this repository's spaced path, so the quoting has to be explicit.
execSync(`"${path.join(androidDir, 'gradlew.bat')}" assemble${RELEASE ? 'Release' : 'Debug'} --no-daemon --console=plain`, {
  cwd: androidDir,
  stdio: 'inherit',
  // Windows-native paths. See (1) and (2) above.
  env: { ...process.env, JAVA_HOME: JDK, ANDROID_HOME: SDK, ANDROID_SDK_ROOT: SDK },
});

const apk = RELEASE
  ? path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
  : path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) {
  // Distinguish the one failure that is not a failure of the build. Gradle names an unsigned
  // release APK differently, so hitting this means the signing config did not apply - almost
  // always a keystore.properties that gradle could read but whose storeFile path was wrong.
  const unsigned = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
  if (RELEASE && existsSync(unsigned)) {
    fail(`the release APK built but came out UNSIGNED, so it will not install on a device.
  Found: ${unsigned}
  Gradle could not apply the signing config. Check that storeFile in
  android/keystore.properties names a .jks that actually exists, relative to android/.`);
  }
  fail('gradle reported success but no APK is on disk - refusing to claim a build');
}
const mb = statSync(apk).size / (1024 * 1024);
// A plausible floor. A near-empty APK means the web payload never made it in, which gradle would
// report as a perfectly successful build.
if (mb < 1) fail(`APK is only ${mb.toFixed(2)} MB - the web payload probably did not get packed`);

console.log(`\nAPK: ${apk}\n     ${mb.toFixed(2)} MB\n`);
console.log('Install on a running emulator or device:');
console.log(`    "${path.join(SDK, 'platform-tools', 'adb')}" install -r "${apk}"`);
