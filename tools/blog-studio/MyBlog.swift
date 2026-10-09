import AppKit
import WebKit

@objcMembers final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var devProcess: Process?
    private var syncProcess: Process?
    private var statusLabel: NSTextField?
    private var logView: NSTextView?
    private var dailyTimer: Timer?
    private var isQuitting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupWindow()
        setupMenu()
        startDevServer()
        startDailyTimer()
        NSApp.activate(ignoringOtherApps: true)
        window?.orderFrontRegardless()
        window?.makeKeyAndOrderFront(nil)
    }

    private func setupWindow() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1250, height: 850),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered,
                              defer: false)
        window.title = "MyBlog"
        window.contentViewController = WebViewController()

        let controller = NSWindowController(window: window)
        controller.window = window
        window.windowController = controller
        controller.showWindow(nil)

        self.window = window
        self.webView = nil

        window.setFrameAutosaveName("MyBlog")
        window.setFrame(NSScreen.main?.visibleFrame.insetBy(dx: 80, dy: 80) ?? window.frame, display: true)
        window.center()
        window.orderFrontRegardless()
        window.makeKeyAndOrderFront(nil)
        webViewController?.setDelegate(self)
        webView = webViewController?.webView
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        window?.orderFrontRegardless()
        window?.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        isQuitting = true
        dailyTimer?.invalidate()
        if let process = devProcess, process.isRunning {
            process.terminate()
        }
        if let process = syncProcess, process.isRunning {
            process.terminate()
        }
    }

    private var webViewController: WebViewController? {
        window?.contentViewController as? WebViewController
    }

    private func setupUI() {
        let root = NSVisualEffectView()
        root.blendingMode = .behindWindow
        root.material = .windowBackground
        root.state = .active
        root.frame = window!.contentView!.bounds
        root.autoresizingMask = [.width, .height]

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")
        root.addSubview(webView)
        self.webView = webView

        let statusLabel = NSTextField(labelWithString: "Starting MyBlog…")
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 12, weight: .medium)
        statusLabel.textColor = .secondaryLabelColor
        root.addSubview(statusLabel)
        self.statusLabel = statusLabel

        let logScroll = NSScrollView()
        logScroll.hasVerticalScroller = true
        logScroll.drawsBackground = true
        logScroll.documentView = NSTextView()
        if let tv = logScroll.documentView as? NSTextView {
            tv.isEditable = false
            tv.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            tv.textColor = .labelColor
            tv.backgroundColor = .textBackgroundColor
            tv.autoresizingMask = [.width]
            logView = tv
        }
        logScroll.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(logScroll)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: statusLabel.topAnchor),

            statusLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -12),
            statusLabel.heightAnchor.constraint(equalToConstant: 24),

            logScroll.topAnchor.constraint(equalTo: statusLabel.bottomAnchor),
            logScroll.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            logScroll.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            logScroll.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -8),
        ])

        window?.contentView = root
    }

    private func setupMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu(title: "MyBlog")
        appMenu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu

        let fileItem = NSMenuItem()
        mainMenu.addItem(fileItem)
        let fileMenu = NSMenu(title: "MyBlog")
        fileMenu.addItem(NSMenuItem(title: "Reload Page", action: #selector(WebViewController.reloadPage), keyEquivalent: "r"))
        fileMenu.addItem(NSMenuItem(title: "Go to Admin", action: #selector(WebViewController.openAdmin), keyEquivalent: "a"))
        fileMenu.addItem(NSMenuItem(title: "Go to Site Home", action: #selector(WebViewController.openHome), keyEquivalent: "h"))
        fileMenu.addItem(NSMenuItem(title: "Open in Browser", action: #selector(WebViewController.openInBrowser), keyEquivalent: "b"))
        fileMenu.addItem(NSMenuItem(title: "Open Repo in Finder", action: #selector(WebViewController.openRepo), keyEquivalent: "f"))
        fileMenu.addItem(.separator())
        fileMenu.addItem(NSMenuItem(title: "Restart Local Server", action: #selector(AppDelegate.restartServer), keyEquivalent: "r"))
        fileMenu.addItem(NSMenuItem(title: "Sync Now", action: #selector(AppDelegate.syncNow), keyEquivalent: "s"))
        fileMenu.addItem(NSMenuItem(title: "Push to GitHub", action: #selector(AppDelegate.pushNow), keyEquivalent: "p"))
        fileItem.submenu = fileMenu
        NSApp.mainMenu = mainMenu
    }

    @objc private func restartServer() {
        guard let process = devProcess, process.isRunning else {
            startDevServer()
            return
        }

        process.terminate()
        DispatchQueue.global().async { [weak self] in
            process.waitUntilExit()
            DispatchQueue.main.async {
                self?.devProcess = nil
                self?.startDevServer()
            }
        }
    }

    @objc private func syncNow() { startSync() }

    @objc private func pushNow() { startSync(action: "push") }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        appendLog("Loaded \(webView.url?.absoluteString ?? "")")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        appendLog("Load failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        appendLog("Could not load: \(error.localizedDescription)")
    }

    private func startDevServer() {
        guard devProcess == nil,
              let script = Bundle.main.url(forResource: "start-dev", withExtension: "sh") else { return }

        let process = Process()
        process.executableURL = script
        process.currentDirectoryURL = URL(fileURLWithPath: workspaceRoot().path)

        var environment = ProcessInfo.processInfo.environment
        environment["BLOG_STUDIO_REPO"] = workspaceRoot().path
        environment["BLOG_STUDIO_PORT"] = "4321"
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\(environment["PATH"] ?? "")"
        process.environment = environment
        process.standardInput = FileHandle.nullDevice

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            let message = String(data: data, encoding: .utf8) ?? "<binary output>"
            DispatchQueue.main.async {
                self?.logView?.textStorage?.append(
                    NSAttributedString(string: message + "\n", attributes: [
                        .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular),
                        .foregroundColor: NSColor.labelColor
                    ])
                )
            }
        }

        errorPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            let message = String(data: data, encoding: .utf8) ?? "<binary output>"
            DispatchQueue.main.async {
                self?.logView?.textStorage?.append(
                    NSAttributedString(string: message + "\n", attributes: [
                        .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular),
                        .foregroundColor: NSColor.labelColor
                    ])
                )
            }
        }

        process.terminationHandler = { [weak self] process in
            let status = process.terminationStatus
            DispatchQueue.main.async {
                self?.devProcess = nil
                self?.appendLog("Astro exited with status \(status).")
                self?.statusLabel?.stringValue = status == 0 ? "Server stopped" : "Server exited (\(status))"
            }
        }

        do {
            try process.run()
            devProcess = process
            webViewController?.waitForServer()
            statusLabel?.stringValue = "Starting Astro…"
        } catch {
            statusLabel?.stringValue = "Could not start server"
            appendLog("Failed to start Astro: \(error.localizedDescription)")
        }
    }

    private func stopDevServer() {
        if let process = devProcess, process.isRunning {
            process.terminate()
        }
        devProcess = nil
    }

    private func startSync(action: String = "sync") {
        guard syncProcess == nil,
              let script = Bundle.main.url(forResource: "sync-blog", withExtension: "sh") else { return }

        let process = Process()
        process.executableURL = script
        process.currentDirectoryURL = workspaceRoot()
        var environment = ProcessInfo.processInfo.environment
        environment["BLOG_STUDIO_REPO"] = workspaceRoot().path
        environment["BLOG_SYNC_SOURCE"] = "app"
        environment["BLOG_SYNC_BRANCH"] = "main"
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\(environment["PATH"] ?? "")"
        process.environment = environment
        process.arguments = [action]
        process.standardInput = FileHandle.nullDevice

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        outputPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                handle.readabilityHandler = nil
                return
            }
            let message = String(data: data, encoding: .utf8) ?? "<binary output>"
            DispatchQueue.main.async { self?.appendLog(message) }
        }

        errorPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                handle.readabilityHandler = nil
                return
            }
            let message = String(data: data, encoding: .utf8) ?? "<binary output>"
            DispatchQueue.main.async { self?.appendLog(message) }
        }

        process.terminationHandler = { [weak self] process in
            let status = process.terminationStatus
            DispatchQueue.main.async {
                self?.syncProcess = nil
                let label = action == "push" ? "Push" : "Sync"
                self?.appendLog("\(label) finished with status \(status).")
                self?.statusLabel?.stringValue = status == 0 ? "\(label) complete" : "\(label) failed"
            }
        }

        do {
            try process.run()
            syncProcess = process
            statusLabel?.stringValue = action == "push" ? "Pushing to GitHub…" : "Syncing locally…"
        } catch {
            statusLabel?.stringValue = action == "push" ? "Could not push" : "Could not sync"
            appendLog("Failed to start \(action): \(error.localizedDescription)")
        }
    }

    private func startDailyTimer() {
        dailyTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.checkDailySync()
        }
    }

    private func checkDailySync() {
        let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: Date())
        guard let year = parts.year, let month = parts.month, let day = parts.day,
              let hour = parts.hour, let minute = parts.minute,
              hour >= 23, minute >= 30 else { return }

        let key = String(format: "blogStudioLastSync.%04d.%02d.%02d", year, month, day)
        let defaults = UserDefaults.standard
        guard defaults.string(forKey: key) == nil else { return }

        defaults.set("done", forKey: key)
        startSync()
    }

    private func appendLog(_ message: String) {
        logView?.textStorage?.append(
            NSAttributedString(string: message + "\n", attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 11, weight: .regular),
                .foregroundColor: NSColor.labelColor
            ])
        )
        print(message)
    }
}

final class WebViewController: NSViewController, WKUIDelegate {
    private(set) var webView: WKWebView!

    override func loadView() {
        let root = NSView()
        root.translatesAutoresizingMaskIntoConstraints = false

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        root.addSubview(webView)
        view = root

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])
    }

    override var representedObject: Any? {
        didSet {
            if let delegate = representedObject as? AppDelegate {
                webView.navigationDelegate = delegate
            }
        }
    }

    func setDelegate(_ delegate: AppDelegate) {
        webView.navigationDelegate = delegate
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        let messageLines = message.components(separatedBy: .newlines)
        alert.messageText = messageLines.first ?? "请确认此操作"
        alert.informativeText = messageLines.dropFirst().joined(separator: "\n")
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确认")
        alert.addButton(withTitle: "取消")

        NSApp.activate(ignoringOtherApps: true)
        if let presentingWindow = webView.window ?? NSApp.keyWindow {
            presentingWindow.makeKeyAndOrderFront(nil)
            alert.beginSheetModal(for: presentingWindow) { response in
                completionHandler(response == .alertFirstButtonReturn)
            }
        } else {
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }
    }

    @objc func reloadPage() { webView.reload() }

    @objc func openAdmin() {
        if let url = URL(string: "http://127.0.0.1:4321/admin/") {
            webView.load(URLRequest(url: url))
        }
    }

    @objc func openHome() {
        if let url = URL(string: "http://127.0.0.1:4321/") {
            webView.load(URLRequest(url: url))
        }
    }

    @objc func openInBrowser() {
        if let url = webView.url ?? URL(string: "http://127.0.0.1:4321/admin/") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func openRepo() {
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: workspaceRootPath())
    }

    func waitForServer() {
        DispatchQueue.global().async {
            for _ in 0..<160 {
                if self.isServerReady() {
                    DispatchQueue.main.async {
                        self.openAdmin()
                    }
                    return
                }
                Thread.sleep(forTimeInterval: 0.25)
            }
        }
    }

    private func isServerReady() -> Bool {
        guard let url = URL(string: "http://127.0.0.1:4321") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1
        var ready = false
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { _, response, error in
            if error == nil, let response = response as? HTTPURLResponse,
               (200..<500).contains(response.statusCode) {
                ready = true
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 1)
        return ready
    }
}

private func workspaceRootPath() -> String {
    Bundle.main.object(forInfoDictionaryKey: "RepoPath") as? String
        ?? NSString(string: "~/Desktop/blog").expandingTildeInPath
}

private func workspaceRoot() -> URL {
    URL(fileURLWithPath: workspaceRootPath())
}

var appDelegate = AppDelegate()
var app = NSApplication.shared
app.setActivationPolicy(.regular)
app.delegate = appDelegate
app.run()
