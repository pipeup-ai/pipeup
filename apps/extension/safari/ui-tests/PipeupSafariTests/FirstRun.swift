// The newcomer's first run in Safari: open the sample page, press Pipeup in the toolbar, comment on this page, write one
// comment, see it counted (Your comments on this page). Design note: docs/design/safari-ui-tests.md.
//
// Screenshots and accessibility trees are attachments in the result bundle; tools/safari-ui-test.mjs exports them. The
// runner is sandboxed and gets no environment from xcodebuild, so the page's address is fixed here.
import AppKit
import XCTest

final class FirstRunTests: XCTestCase {
  let safari = XCUIApplication(bundleIdentifier: "com.apple.Safari")
  let url = "http://localhost:8792/extension-test.html"
  var step = 0
  /// Safari's windows reach accessibility as dialogs, with an identifier that names them; the main one comes first.
  lazy var window = safari.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'SafariWindow'")).firstMatch

  /// Safari's address field. The toolbar is the person's: a run must leave it as it found it.
  lazy var addressField = window.descendants(matching: .any)["WEB_BROWSER_ADDRESS_AND_SEARCH_FIELD"]

  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  override func tearDownWithError() throws {
    // The tab the test opened, closed whatever happened; the screenshots keep what it showed.
    let close = window.buttons["_XCUI:CloseWindow"]
    if window.exists && window.title.hasPrefix("Lumen launch plan") {
      press(.escape)
      checkToolbar("after")
      if close.exists { close.click() }
    }
  }

  /// Safari is the app in front, so keys sent now reach it and nothing else. Keys go out only then: a person using
  /// another app while the test runs would otherwise get them, and a stray key has cost Safari's toolbar its address
  /// field before.
  var safariInFront: Bool { NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Safari" }

  func type(_ text: String) {
    guard safariInFront else { return XCTFail("Safari isn't the app in front; nothing typed") }
    safari.typeText(text)
  }

  func press(_ key: XCUIKeyboardKey) {
    guard safariInFront else { return XCTFail("Safari isn't the app in front; no key pressed") }
    safari.typeKey(key, modifierFlags: [])
  }

  /// Fails when Safari's toolbar has no address field, naming the way to put it back.
  func checkToolbar(_ when: String) {
    if !window.exists || addressField.exists { return }
    shot("toolbar-" + when)
    XCTFail("Safari's toolbar has lost its address field (\(when) the test). Put it back with: open -a Terminal tools/safari-toolbar-reset.command")
  }

  /// A screenshot of Safari's window and any popover over it, numbered in the order taken. The rest of the screen is
  /// cut away: it's someone's desktop.
  func shot(_ name: String) {
    step += 1
    let screen = XCUIScreen.main.screenshot()
    var data = screen.pngRepresentation
    var rect = window.frame
    for i in 0..<safari.popovers.count { rect = rect.union(safari.popovers.element(boundBy: i).frame) }
    rect = rect.insetBy(dx: -16, dy: -16)
    if let source = CGImageSourceCreateWithData(data as CFData, nil),
       let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
       let points = NSScreen.main?.frame.width, points > 0 {
      let scale = CGFloat(image.width) / points
      let pixels = CGRect(x: rect.minX * scale, y: rect.minY * scale, width: rect.width * scale, height: rect.height * scale)
      if let cropped = image.cropping(to: pixels.intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))),
         let png = NSBitmapImageRep(cgImage: cropped).representation(using: .png, properties: [:]) {
        data = png
      }
    }
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.png")
    attachment.name = file(name, "png")
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// Safari's accessibility tree, for reading a step that went wrong.
  func dump(_ name: String) {
    let attachment = XCTAttachment(string: safari.debugDescription)
    attachment.name = file(name, "txt")
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  func file(_ name: String, _ ext: String) -> String { String(format: "%02d-%@.%@", step, name, ext) }

  /// Waits for an element; on a miss, keeps the screen and the tree, then fails.
  func expect(_ element: XCUIElement, _ what: String, within seconds: TimeInterval = 10) {
    if element.waitForExistence(timeout: seconds) { return }
    shot("missing-" + what)
    dump("missing-" + what)
    XCTFail("No \(what) within \(Int(seconds))s; see the screenshot and tree")
  }

  func testFirstRun() throws {
    // 1. The sample page, opened in Safari through LaunchServices rather than typed: keystrokes need Safari to hold the
    // keyboard, which it loses whenever the person uses another app while the test runs.
    let opened = expectation(description: "Safari opens the page")
    NSWorkspace.shared.open([URL(string: url)!], withApplicationAt: URL(fileURLWithPath: "/Applications/Safari.app"),
                            configuration: NSWorkspace.OpenConfiguration()) { _, _ in opened.fulfill() }
    wait(for: [opened], timeout: 20)
    safari.activate()
    expect(window, "safari-window", within: 20)
    checkToolbar("before")
    let page = safari.webViews.firstMatch
    expect(page.staticTexts["Lumen launch plan"], "sample-page", within: 20)
    shot("page")

    // 2. Pipeup in the toolbar.
    let toolbar = safari.toolbars.firstMatch
    let button = toolbar.buttons["Pipeup"]
    expect(button, "toolbar-button")
    button.click()
    // Safari may ask for the site first.
    let allow = safari.buttons.matching(NSPredicate(format: "title BEGINSWITH 'Allow' OR label BEGINSWITH 'Allow'")).firstMatch
    if allow.waitForExistence(timeout: 3) {
      shot("safari-asks")
      allow.click()
    }
    let start = safari.buttons["Comment on this page"]
    expect(start, "comment-on-this-page")
    shot("menu-first-visit")
    dump("menu-first-visit")

    // 3. Comment on this page.
    start.click()
    sleep(1)
    shot("comment-mode")

    // 4. One comment on the first paragraph.
    let paragraph = page.staticTexts.matching(NSPredicate(format: "value CONTAINS 'second week of May' OR label CONTAINS 'second week of May'")).firstMatch
    expect(paragraph, "first-paragraph")
    paragraph.click()
    // The comment box: Pipeup's textarea, labelled Comment, in the extension's own frame.
    let box = safari.textViews.matching(NSPredicate(format: "label == 'Comment' OR placeholderValue BEGINSWITH 'Comment'")).firstMatch
    expect(box, "comment-box")
    shot("comment-box")
    box.click()
    let sentence = "The survey should go out before the beta ends, not after."
    type(sentence)
    shot("typed")
    press(.return)
    // The comment's marker on the page names the paragraph and repeats the comment.
    expect(page.buttons.matching(NSPredicate(format: "title CONTAINS %@", sentence)).firstMatch, "comment-marker")
    shot("comment-made")

    // 5. The menu counts it.
    button.click()
    // The menu's rows are buttons with a title (Safari gives the popup's buttons no label).
    let count = safari.buttons.matching(NSPredicate(format: "title BEGINSWITH 'Your comments on this page'")).firstMatch
    expect(count, "comments-row")
    shot("menu-with-comment")
    dump("menu-with-comment")
    // Comments stay in this browser between runs, so earlier runs' comments count too.
    let n = Int(count.title.split(separator: " ").last ?? "") ?? 0
    XCTAssertGreaterThanOrEqual(n, 1, "The Your comments on this page row reads “\(count.title)”")
    // Six rows and More, no footer: nothing in the menu is called Comments you've made or Start commenting.
    XCTAssertFalse(safari.buttons["Start commenting"].exists, "Start commenting is now the Commenting switch")
    XCTAssertFalse(safari.links["Comments you've made"].exists, "Comments you've made is in Settings, under More")
  }
}
