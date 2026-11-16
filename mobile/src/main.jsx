import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configureGatewayTransport } from '../../web/src/gateway-transport.js'
import '../../web/src/styles.css'
import './mobile.css'
import { mobileGatewayTransport, pairMobileGateway } from './mobile-profile.js'
import {
  activateLockedAudioSession,
  deactivateLockedAudioSession,
  loadMobileGatewayProfile,
  loadLockedListeningPreference,
  mobileDeviceId,
  mobileLaunchUrl,
  mobilePairingRequest,
  onLockedAudioRouteChanged,
  onMobileAppStateChange,
  onMobileUrlOpen,
  removeMobileGatewayProfile,
  saveLockedListeningPreference,
  saveMobileGatewayProfile,
  scanGatewayPairingCode,
  supportsLockedListening,
} from './native-runtime.js'

function MobileApp() {
  const [profile, setProfile] = useState(null)
  const [WebApp, setWebApp] = useState(null)
  const [pairingCode, setPairingCode] = useState('')
  const [status, setStatus] = useState('正在读取连接配置…')
  const [busy, setBusy] = useState(false)
  const [lockedListening, setLockedListening] = useState(false)
  const [lockedAudio, setLockedAudio] = useState({
    supported: supportsLockedListening(),
    active: false,
    bluetooth: false,
  })
  const pairing = useRef(false)
  const lockedListeningRef = useRef(false)

  const applyLockedAudio = useCallback(async () => {
    const next = await activateLockedAudioSession()
    setLockedAudio(next)
    return next
  }, [])

  const activateProfile = useCallback(async next => {
    configureGatewayTransport(mobileGatewayTransport(next))
    const module = await import('../../web/src/App.jsx')
    setProfile(next)
    setWebApp(() => module.default)
    setStatus('')
  }, [])

  const pair = useCallback(async value => {
    if (!String(value || '').trim() || pairing.current) return
    pairing.current = true
    setBusy(true)
    setStatus('正在安全配对…')
    try {
      const next = await pairMobileGateway(String(value).trim(), {
        request: mobilePairingRequest,
        deviceId: await mobileDeviceId(),
        label: 'Qwen Audio Agent Mobile',
      })
      await saveMobileGatewayProfile(next)
      await activateProfile(next)
    } catch (error) {
      setStatus(
        error.code === 'gateway_pairing_code_invalid'
          ? '连接码无效，请在 Gateway 主机上重新生成'
          : error.code === 'gateway_pairing_code_expired'
            ? '连接码已过期，请在 Gateway 主机上重新生成'
            : error.message || '无法连接 Gateway',
      )
    } finally {
      pairing.current = false
      setBusy(false)
    }
  }, [activateProfile])

  useEffect(() => {
    let active = true
    loadMobileGatewayProfile()
      .then(next => {
        if (!active) return
        if (next) return activateProfile(next)
        return mobileLaunchUrl().then(url => {
          if (url) return pair(url)
          setStatus('请扫描 Gateway CLI 输出的连接码')
        })
      })
      .catch(error => active && setStatus(error.message || '无法读取连接配置'))
    const removeListener = onMobileUrlOpen(url => void pair(url))
    return () => {
      active = false
      removeListener()
    }
  }, [activateProfile, pair])

  useEffect(() => {
    if (!supportsLockedListening()) return undefined
    let active = true
    loadLockedListeningPreference()
      .then(async enabled => {
        if (!active) return
        lockedListeningRef.current = enabled
        setLockedListening(enabled)
        if (!enabled) return
        try {
          const next = await applyLockedAudio()
          if (active) setLockedAudio(next)
        } catch (error) {
          if (active) setStatus(error.message || 'Locked listening could not start')
        }
      })
      .catch(error => active && setStatus(error.message || 'Locked listening could not start'))

    const removeAppStateListener = onMobileAppStateChange(() => {
      if (!lockedListeningRef.current) return
      void applyLockedAudio().catch(error => {
        if (active) setStatus(error.message || 'Locked listening needs attention')
      })
    })
    const removeRouteListener = onLockedAudioRouteChanged(next => {
      if (active) setLockedAudio(next)
    })
    return () => {
      active = false
      removeAppStateListener()
      removeRouteListener()
    }
  }, [applyLockedAudio])

  const scan = async () => {
    setBusy(true)
    try {
      const value = await scanGatewayPairingCode()
      if (value) await pair(value)
    } catch (error) {
      setStatus(error.message || '没有读到配对码')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('断开这台 Gateway？之后需要重新扫码配对。')) return
    if (lockedListeningRef.current) {
      await deactivateLockedAudioSession().catch(() => {})
      await saveLockedListeningPreference(false)
      lockedListeningRef.current = false
      setLockedListening(false)
    }
    await removeMobileGatewayProfile()
    configureGatewayTransport()
    setProfile(null)
    setWebApp(null)
    setStatus('已断开，请重新扫码配对')
  }

  const toggleLockedListening = async () => {
    setBusy(true)
    try {
      if (lockedListeningRef.current) {
        const next = await deactivateLockedAudioSession()
        await saveLockedListeningPreference(false)
        lockedListeningRef.current = false
        setLockedListening(false)
        setLockedAudio(next)
        setStatus('')
        return
      }
      const next = await applyLockedAudio()
      await saveLockedListeningPreference(true)
      lockedListeningRef.current = true
      setLockedListening(true)
      setLockedAudio(next)
      setStatus('')
    } catch (error) {
      setStatus(error.message || 'Locked listening could not start')
    } finally {
      setBusy(false)
    }
  }

  if (profile && WebApp) return <div className="mobile-runtime">
    {lockedAudio.supported && <button
      className={`mobile-lock-toggle${lockedListening ? ' active' : ''}`}
      type="button"
      aria-pressed={lockedListening}
      disabled={busy}
      onClick={toggleLockedListening}
      title="Keep the private voice session available when the iPhone is locked"
    >
      <span>{lockedListening ? 'Locked listening on' : 'Enable locked listening'}</span>
      {lockedListening && <small>{lockedAudio.bluetooth ? 'Bluetooth audio' : 'iPhone audio'}</small>}
    </button>}
    <button className="mobile-disconnect" type="button" onClick={disconnect}>
      断开
    </button>
    {status && <div className="mobile-runtime-status" role="status">{status}</div>}
    <WebApp />
  </div>

  return <main className="mobile-onboarding">
    <div className="mobile-mark">Q</div>
    <h1>连接你的 Agent</h1>
    <p>Gateway 和后台 Agent 继续运行在你的电脑上，手机通过安全连接与它对话。</p>
    <button className="mobile-primary" type="button" disabled={busy} onClick={scan}>
      {busy ? '正在连接…' : '扫描配对码'}
    </button>
    <div className="mobile-divider"><span>或</span></div>
    <label>
      Gateway 连接码
      <textarea
        value={pairingCode}
        onChange={event => setPairingCode(event.target.value)}
        placeholder="粘贴 Gateway 连接码"
        spellCheck={false}
      />
    </label>
    <button type="button" disabled={busy || !pairingCode.trim()} onClick={() => pair(pairingCode)}>
      连接
    </button>
    <small role="status">{status}</small>
  </main>
}

createRoot(document.getElementById('root')).render(
  <StrictMode><MobileApp /></StrictMode>,
)
