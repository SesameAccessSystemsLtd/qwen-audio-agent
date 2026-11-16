import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appFile = name => new URL(`../ios/App/App/${name}`, import.meta.url)
const projectFile = new URL(
  '../ios/App/App.xcodeproj/project.pbxproj',
  import.meta.url,
)

test('iOS opts into audio background execution for locked listening', async () => {
  const plist = await readFile(appFile('Info.plist'), 'utf8')
  assert.match(
    plist,
    /<key>UIBackgroundModes<\/key>\s*<array>\s*<string>audio<\/string>\s*<\/array>/,
  )
})

test('native locked audio owns a voice-chat Bluetooth session and recovers it', async () => {
  const swift = await readFile(appFile('LockedAudioPlugin.swift'), 'utf8')
  assert.match(swift, /\.playAndRecord/)
  assert.match(swift, /mode:\s*\.voiceChat/)
  assert.match(swift, /\.allowBluetooth/)
  assert.match(swift, /engine\.start\(\)/)
  assert.match(swift, /interruptionNotification/)
  assert.match(swift, /routeChangeNotification/)
  assert.match(swift, /mediaServicesWereResetNotification/)
  assert.match(swift, /registerPluginType\(LockedAudioPlugin\.self\)/)
})

test('Xcode project includes the locked audio bridge controller in Sources', async () => {
  const [project, scene] = await Promise.all([
    readFile(projectFile, 'utf8'),
    readFile(appFile('SceneDelegate.swift'), 'utf8'),
  ])
  assert.match(project, /LockedAudioPlugin\.swift in Sources/)
  assert.match(scene, /rootViewController = AppBridgeViewController\(\)/)
})

test('the mobile surface persists an explicit user-controlled locked mode', async () => {
  const [runtime, mobileApp] = await Promise.all([
    readFile(new URL('../src/native-runtime.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(runtime, /qwen-audio-agent\.locked-listening/)
  assert.match(runtime, /saveLockedListeningPreference/)
  assert.match(mobileApp, /Enable locked listening/)
  assert.match(mobileApp, /onMobileAppStateChange/)
})
