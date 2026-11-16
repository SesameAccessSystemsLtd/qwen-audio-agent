import AVFAudio
import Capacitor
import Foundation

private final class LockedAudioSessionController {
    static let shared = LockedAudioSessionController()

    private let session = AVAudioSession.sharedInstance()
    private var engine = AVAudioEngine()
    private var observers: [NSObjectProtocol] = []
    private(set) var enabled = false
    var onRouteChanged: ((JSObject) -> Void)?

    private init() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: session,
            queue: .main
        ) { [weak self] notification in
            self?.handleInterruption(notification)
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: session,
            queue: .main
        ) { [weak self] _ in
            guard let self = self else { return }
            if self.enabled && !self.engine.isRunning { try? self.startAudioIO() }
            self.onRouteChanged?(self.status())
        })
        observers.append(center.addObserver(
            forName: AVAudioSession.mediaServicesWereResetNotification,
            object: session,
            queue: .main
        ) { [weak self] _ in
            guard let self = self, self.enabled else { return }
            self.engine = AVAudioEngine()
            try? self.startAudioIO()
            self.onRouteChanged?(self.status())
        })
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    func activate() throws -> JSObject {
        enabled = true
        do {
            try startAudioIO()
            return status()
        } catch {
            enabled = false
            throw error
        }
    }

    func deactivate() throws -> JSObject {
        enabled = false
        engine.stop()
        try session.setActive(false, options: [.notifyOthersOnDeactivation])
        return status()
    }

    func status() -> JSObject {
        let route = session.currentRoute
        let inputTypes = route.inputs.map { $0.portType.rawValue }
        let outputTypes = route.outputs.map { $0.portType.rawValue }
        let bluetoothTypes: Set<AVAudioSession.Port> = [
            .bluetoothHFP,
            .bluetoothA2DP,
            .bluetoothLE,
        ]
        return [
            "active": enabled && engine.isRunning,
            "inputRoutes": inputTypes,
            "outputRoutes": outputTypes,
            "bluetooth": route.inputs.contains { bluetoothTypes.contains($0.portType) }
                || route.outputs.contains { bluetoothTypes.contains($0.portType) },
        ]
    }

    private func startAudioIO() throws {
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetooth, .defaultToSpeaker]
        )
        try session.setPreferredSampleRate(48_000)
        try session.setPreferredIOBufferDuration(0.02)
        try session.setActive(true)
        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }
    }

    private func handleInterruption(_ notification: Notification) {
        guard
            enabled,
            let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        if type == .began {
            engine.pause()
            onRouteChanged?(status())
            return
        }

        let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
        if options.contains(.shouldResume) {
            try? startAudioIO()
        }
        onRouteChanged?(status())
    }
}

@objc(LockedAudioPlugin)
public class LockedAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LockedAudioPlugin"
    public let jsName = "LockedAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        LockedAudioSessionController.shared.onRouteChanged = { [weak self] status in
            self?.notifyListeners("routeChanged", data: status)
        }
    }

    @objc func activate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                call.resolve(try LockedAudioSessionController.shared.activate())
            } catch {
                call.reject("Unable to start locked-screen audio", nil, error)
            }
        }
    }

    @objc func deactivate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                call.resolve(try LockedAudioSessionController.shared.deactivate())
            } catch {
                call.reject("Unable to stop locked-screen audio", nil, error)
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(LockedAudioSessionController.shared.status())
        }
    }
}

final class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(LockedAudioPlugin.self)
    }
}
