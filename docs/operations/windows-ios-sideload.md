# Windows installation for the Steven-only iPhone prototype

This route installs the development prototype on a physical iPhone without a
Mac and without buying the Solos SDK or Apple Developer Program membership.
It deliberately separates the cloud build from Apple authentication:

1. GitHub Actions builds an **unsigned** IPA on a temporary macOS runner.
2. AltServer on Steven's Windows computer signs and installs that IPA locally.

The workflow never receives an Apple ID, password, certificate, provisioning
profile, Qwen credential, SIS credential, Microsoft credential, or Asana
credential. Do not add any of those values to GitHub Actions secrets.

## 1. Produce the unsigned IPA

The repository contains the manually triggered workflow
`.github/workflows/mobile-ios-unsigned.yml`. Run **iOS unsigned device
prototype** from the repository's GitHub Actions page, then download the
`qwen-sis-voice-unsigned-ipa` artifact. Extract it on Windows to obtain:

`qwen-sis-voice-unsigned.ipa`

The workflow runs the mobile tests, syncs the Capacitor project, compiles for a
physical iPhone with code signing disabled, verifies the IPA archive and keeps
the artifact for seven days. A simulator `.app` is not a substitute for this
device IPA.

## 2. Prepare Windows and the iPhone

Follow AltStore's current Windows installation instructions. They require the
direct-from-Apple Windows versions of iTunes and iCloud, AltServer for Windows,
a USB connection for initial setup, trusting the computer on the iPhone, and
Developer Mode on current iOS versions. Do not proceed through an Apple sign-in
until Steven explicitly approves it.

Official instructions:

https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows

## 3. Sign and install locally

After explicit Apple sign-in approval:

1. Connect and unlock the iPhone, accept **Trust This Computer**, and leave it
   connected by USB for the first installation.
2. Run AltServer as administrator.
3. Hold **Shift** while clicking the AltServer tray icon and select
   **Sideload .ipa…**.
4. Select `qwen-sis-voice-unsigned.ipa` and complete the Apple authentication
   prompt locally. Never paste Apple credentials into GitHub, Qwen, SIS, Codex,
   a chat, or a command window.
5. On the iPhone, trust the resulting developer profile if iOS asks, and enable
   Developer Mode if it is not already enabled.

AltServer's free signing is temporary and must be refreshed periodically. Keep
AltServer available on the same Wi-Fi or reconnect the iPhone by USB before the
signed app expires.

## 4. Controlled physical proof

The first proof remains read-only and Steven-only:

1. Start the private Gateway and verify Tailscale is connected on the laptop
   and iPhone.
2. Open the installed app once, pair it to the existing revocable device
   connection, grant microphone access, and select **Enable locked listening**.
3. Confirm the app says **Bluetooth audio** with the AirGo A5 selected.
4. Ask for the SIS target version and Charlie lifecycle state while the phone
   is unlocked.
5. Lock the phone, put it in a pocket, and repeat the read-only request through
   the glasses.
6. Verify a same-session follow-up retains the target version and lifecycle
   state.

Stop on any route loss, authentication error, unexpected write request, or
incorrect SIS/Charlie state. This proof does not authorize Send, Charlie
activation, production rollout, or any additional SIS, Microsoft or Asana
permission.

