import AppKit
import WebKit

class StudioDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, NSWindowDelegate {
 var window:NSWindow!; var web:WKWebView!; var backend:Process?; var logHandle:FileHandle?; var attempts=0
 let url=URL(string:"http://127.0.0.1:5296")!
 func applicationDidFinishLaunching(_ notification:Notification){
  NSApp.setActivationPolicy(.regular)
  let menu=NSMenu();let item=NSMenuItem();let appMenu=NSMenu();appMenu.addItem(withTitle:"关于 ShotCraft Studio",action:#selector(about),keyEquivalent:"");appMenu.addItem(NSMenuItem.separator());appMenu.addItem(withTitle:"退出 ShotCraft Studio",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q");item.submenu=appMenu;menu.addItem(item)
  let edit=NSMenuItem(title:"编辑",action:nil,keyEquivalent:"");let em=NSMenu(title:"编辑");for (name,sel,key) in [("撤销","undo:","z"),("剪切","cut:","x"),("复制","copy:","c"),("粘贴","paste:","v"),("全选","selectAll:","a")]{em.addItem(withTitle:name,action:Selector(sel),keyEquivalent:key)};edit.submenu=em;menu.addItem(edit);NSApp.mainMenu=menu
  let config=WKWebViewConfiguration();config.preferences.javaScriptCanOpenWindowsAutomatically=false;config.mediaTypesRequiringUserActionForPlayback=[]
  web=WKWebView(frame:.zero,configuration:config);web.uiDelegate=self;web.navigationDelegate=self;web.setValue(false,forKey:"drawsBackground");if #available(macOS 13.3,*){web.isInspectable=true}
  window=NSWindow(contentRect:NSRect(x:0,y:0,width:1440,height:920),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false);window.title="ShotCraft Studio · 手动视频工作台";window.minSize=NSSize(width:1100,height:720);window.backgroundColor=NSColor(calibratedRed:0.08,green:0.10,blue:0.08,alpha:1);window.contentView=web;window.delegate=self;window.setFrameAutosaveName("ShotCraftStudioWindow");window.center();window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true)
  web.loadHTMLString("<body style='background:#141716;color:#d6ee83;font-family:-apple-system;display:grid;place-items:center;height:95vh'><div><h2>ShotCraft Studio</h2><p style='color:#a2aba2'>正在打开你的剪辑工作台…</p></div></body>",baseURL:nil)
  checkExisting()
 }
 func checkExisting(){URLSession.shared.dataTask(with:url.appendingPathComponent("api/health")){data,_,_ in DispatchQueue.main.async{if let d=data,let obj=try? JSONSerialization.jsonObject(with:d) as? [String:Any],obj["app"] as? String == "shotcraft-desktop"{self.web.load(URLRequest(url:self.url))}else{self.startServer()}}}.resume()}
 func startServer(){
  let resources=Bundle.main.resourceURL!;let studio=resources.appendingPathComponent("studio");let node=resources.appendingPathComponent("node")
  let dataDir=FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Codex/ShotCraft Studio");try? FileManager.default.createDirectory(at:dataDir,withIntermediateDirectories:true)
  let log=dataDir.appendingPathComponent("desktop.log");FileManager.default.createFile(atPath:log.path,contents:nil);logHandle=try? FileHandle(forWritingTo:log)
  let process=Process();process.executableURL=node;process.arguments=[studio.appendingPathComponent("server/server.mjs").path];process.currentDirectoryURL=studio;var env=ProcessInfo.processInfo.environment;env["PATH"]="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin";env["STUDIO_DATA"]=dataDir.path;process.environment=env;process.standardOutput=logHandle;process.standardError=logHandle;backend=process
  do{try process.run();poll()}catch{showError("无法启动本地服务：\(error.localizedDescription)")}
 }
 func poll(){attempts+=1;URLSession.shared.dataTask(with:url.appendingPathComponent("api/health")){data,_,_ in DispatchQueue.main.async{if let d=data,let obj=try? JSONSerialization.jsonObject(with:d) as? [String:Any],obj["app"] as? String == "shotcraft-desktop"{self.web.load(URLRequest(url:self.url))}else if self.attempts<45{DispatchQueue.main.asyncAfter(deadline:.now()+0.5){self.poll()}}else{self.showError("服务启动超时。请查看 Documents/Codex/ShotCraft Studio/desktop.log。")}}}.resume()}
 func showError(_ text:String){let a=NSAlert();a.messageText="工作台暂时无法打开";a.informativeText=text;a.runModal()}
 @objc func about(){let a=NSAlert();a.messageText="ShotCraft Studio";a.informativeText="手动视频工作台 · 1.0\n基于 Video Shotcraft 与 Remotion\n素材和工程保存在本机。";a.runModal()}
 func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool{true}
 func applicationWillTerminate(_ notification:Notification){web.evaluateJavaScript("window.dispatchEvent(new Event('beforeunload'))");if backend?.isRunning == true{backend?.terminate()}}
 func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void){let p=NSOpenPanel();p.allowsMultipleSelection=parameters.allowsMultipleSelection;p.canChooseDirectories=false;p.beginSheetModal(for:window){response in completionHandler(response == .OK ? p.urls:nil)}}
 func webView(_ webView:WKWebView,runJavaScriptAlertPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping()->Void){let a=NSAlert();a.messageText=message;a.beginSheetModal(for:window){_ in completionHandler()}}
 func webView(_ webView:WKWebView,runJavaScriptConfirmPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping(Bool)->Void){let a=NSAlert();a.messageText=message;a.addButton(withTitle:"确定");a.addButton(withTitle:"取消");a.beginSheetModal(for:window){r in completionHandler(r == .alertFirstButtonReturn)}}
 func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let u=navigationAction.request.url else{decisionHandler(.cancel);return};if u.host=="127.0.0.1"||u.scheme=="about"||u.scheme=="blob"{decisionHandler(.allow)}else{if ["https","http"].contains(u.scheme ?? ""){NSWorkspace.shared.open(u)};decisionHandler(.cancel)}}
}
let app=NSApplication.shared
let delegate=StudioDelegate();app.delegate=delegate;app.run()
