import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { App as CapacitorApp } from '@capacitor/app'
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner'
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import {
  MOBILE_DEVICE_ID_KEY,
  MOBILE_GATEWAY_PROFILE_KEY,
  parseMobileGatewayProfile,
} from './mobile-profile.js'
import { randomUUID } from '../../shared/runtime-crypto.mjs'

const LOCKED_LISTENING_KEY = 'qwen-audio-agent.locked-listening'
const LockedAudio = registerPlugin('LockedAudio')

export async function loadMobileGatewayProfile() {
  return parseMobileGatewayProfile(await SecureStorage.get(MOBILE_GATEWAY_PROFILE_KEY))
}

export async function saveMobileGatewayProfile(profile) {
  await SecureStorage.set(MOBILE_GATEWAY_PROFILE_KEY, profile)
}

export async function removeMobileGatewayProfile() {
  await SecureStorage.remove(MOBILE_GATEWAY_PROFILE_KEY)
}

export async function mobileDeviceId() {
  const current = await Preferences.get({ key: MOBILE_DEVICE_ID_KEY })
  if (current.value) return current.value
  const value = `mobile_${randomUUID()}`
  await Preferences.set({ key: MOBILE_DEVICE_ID_KEY, value })
  return value
}

export async function mobilePairingRequest(url, data) {
  return CapacitorHttp.post({
    url,
    data,
    headers: { 'Content-Type': 'application/json' },
    connectTimeout: 10_000,
    readTimeout: 10_000,
  })
}

export async function scanGatewayPairingCode() {
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
    cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
    scanInstructions: '扫描 Gateway CLI 输出的连接码',
    cancelButtonAccessibilityLabel: '取消扫描',
  })
  return String(result.ScanResult || '').trim()
}

export async function mobileLaunchUrl() {
  return (await CapacitorApp.getLaunchUrl())?.url || ''
}

export function onMobileUrlOpen(listener) {
  let handle
  let disposed = false
  CapacitorApp.addListener('appUrlOpen', event => listener(event.url)).then(value => {
    if (disposed) return value.remove()
    handle = value
  })
  return () => {
    disposed = true
    handle?.remove()
  }
}

export function supportsLockedListening() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export async function loadLockedListeningPreference() {
  const result = await Preferences.get({ key: LOCKED_LISTENING_KEY })
  return result.value === 'true'
}

export async function saveLockedListeningPreference(enabled) {
  await Preferences.set({
    key: LOCKED_LISTENING_KEY,
    value: enabled === true ? 'true' : 'false',
  })
}

export async function activateLockedAudioSession() {
  if (!supportsLockedListening()) return { supported: false, active: false }
  return { supported: true, ...await LockedAudio.activate() }
}

export async function deactivateLockedAudioSession() {
  if (!supportsLockedListening()) return { supported: false, active: false }
  return { supported: true, ...await LockedAudio.deactivate() }
}

export function onMobileAppStateChange(listener) {
  let handle
  let disposed = false
  CapacitorApp.addListener('appStateChange', event => listener(event)).then(value => {
    if (disposed) return value.remove()
    handle = value
  })
  return () => {
    disposed = true
    handle?.remove()
  }
}

export function onLockedAudioRouteChanged(listener) {
  if (!supportsLockedListening()) return () => {}
  let handle
  let disposed = false
  LockedAudio.addListener('routeChanged', event => listener({
    supported: true,
    ...event,
  })).then(value => {
    if (disposed) return value.remove()
    handle = value
  })
  return () => {
    disposed = true
    handle?.remove()
  }
}
