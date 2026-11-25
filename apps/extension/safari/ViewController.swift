// The Mac app's window: Main.html, told whether Pipeup is on in Safari. Links open in the person's browser; the sample
// page opens in Safari. Kept in apps/extension/safari and copied over the converter's own by tools/build-extension.mjs.

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "ai.pipeup.Pipeup.Extension"
let samplePage = URL(string: "https://pipeup-ai.github.io/pipeup/extension-test.html")!

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        self.webView.navigationDelegate = self
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        tellState()
    }

    // Asked again when the app comes back to the front: the person may have just ticked Pipeup in Safari.
    override func viewDidAppear() {
        super.viewDidAppear()
        NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.tellState()
        }
    }

    func tellState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            let enabled = (state != nil && error == nil) ? (state!.isEnabled ? "true" : "false") : "undefined"
            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    self.webView.evaluateJavaScript("show(\(enabled), true)")
                } else {
                    self.webView.evaluateJavaScript("show(\(enabled), false)")
                }
            }
        }
    }

    // Support, Privacy and Source open in the person's own browser, not in this window.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.scheme == "https" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.body as? String {
        case "open-preferences":
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
                DispatchQueue.main.async {
                    NSApplication.shared.terminate(nil)
                }
            }
        case "open-sample":
            // In Safari itself, whatever the default browser is: that is where Pipeup is on.
            if let safari = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") {
                NSWorkspace.shared.open([samplePage], withApplicationAt: safari, configuration: NSWorkspace.OpenConfiguration())
            } else {
                NSWorkspace.shared.open(samplePage)
            }
        default:
            return
        }
    }
}
