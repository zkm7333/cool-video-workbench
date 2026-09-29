#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
@interface Studio : NSObject <NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate>
@property NSWindow *window;
@property WKWebView *web;
@property NSTask *backend;
@property NSURL *url;
@property int attempts;
@end
@implementation Studio
-(void)applicationDidFinishLaunching:(NSNotification*)n {
 [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular]; NSApp.appearance=[NSAppearance appearanceNamed:NSAppearanceNameAqua];
 NSMenu *menu=[NSMenu new];NSMenuItem *appItem=[NSMenuItem new];NSMenu *appMenu=[NSMenu new];[appMenu addItemWithTitle:@"关于 ShotCraft Studio" action:@selector(about:) keyEquivalent:@""];[appMenu addItem:NSMenuItem.separatorItem];[appMenu addItemWithTitle:@"退出 ShotCraft Studio" action:@selector(terminate:) keyEquivalent:@"q"];appItem.submenu=appMenu;[menu addItem:appItem];
 NSMenuItem *edit=[NSMenuItem new];edit.title=@"编辑";NSMenu *em=[[NSMenu alloc]initWithTitle:@"编辑"];NSArray *labels=@[@"撤销",@"剪切",@"复制",@"粘贴",@"全选"];NSArray *actions=@[@"undo:",@"cut:",@"copy:",@"paste:",@"selectAll:"];NSArray *keys=@[@"z",@"x",@"c",@"v",@"a"];for(int i=0;i<5;i++)[em addItemWithTitle:labels[i] action:NSSelectorFromString(actions[i]) keyEquivalent:keys[i]];edit.submenu=em;[menu addItem:edit];NSApp.mainMenu=menu;
 WKWebViewConfiguration *cfg=[WKWebViewConfiguration new];cfg.mediaTypesRequiringUserActionForPlayback=WKAudiovisualMediaTypeNone;self.web=[[WKWebView alloc]initWithFrame:NSZeroRect configuration:cfg];self.web.UIDelegate=self;self.web.navigationDelegate=self;[self.web setValue:@NO forKey:@"drawsBackground"];
 self.window=[[NSWindow alloc]initWithContentRect:NSMakeRect(0,0,1440,920) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable|NSWindowStyleMaskResizable backing:NSBackingStoreBuffered defer:NO];self.window.title=@"ShotCraft Studio · 手动视频工作台";self.window.minSize=NSMakeSize(1100,720);self.window.backgroundColor=[NSColor colorWithRed:.98 green:.98 blue:.99 alpha:1];self.window.contentView=self.web;[self.window setFrameAutosaveName:@"ShotCraftStudioWindow"];[self.window center];[self.window makeKeyAndOrderFront:nil];[NSApp activateIgnoringOtherApps:YES];
 [self.web loadHTMLString:@"<body style='background:#f8f9fb;color:#4264f5;font-family:-apple-system;display:grid;place-items:center;height:95vh'><div><h2>ShotCraft Studio</h2><p style='color:#737781'>正在打开你的创作空间…</p></div></body>" baseURL:nil];self.url=[NSURL URLWithString:@"http://127.0.0.1:5296"];[self check:NO];
}
-(void)check:(BOOL)started {
 [[[NSURLSession sharedSession] dataTaskWithURL:[self.url URLByAppendingPathComponent:@"api/health"] completionHandler:^(NSData *data,NSURLResponse *r,NSError *e){NSDictionary *obj=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;dispatch_async(dispatch_get_main_queue(),^{if([obj[@"app"] isEqual:@"shotcraft-desktop"]){[self.web loadRequest:[NSURLRequest requestWithURL:self.url]];}else if(!started){[self start];}else if(self.attempts++<45){dispatch_after(dispatch_time(DISPATCH_TIME_NOW,.5*NSEC_PER_SEC),dispatch_get_main_queue(),^{[self check:YES];});}else{[self error:@"本地服务未能启动。请查看 Documents/Codex/ShotCraft Studio/desktop.log。"];}});} ] resume];
}
-(void)start {
 NSString *resources=NSBundle.mainBundle.resourcePath;NSString *studio=[resources stringByAppendingPathComponent:@"studio"];
 NSString *data=[NSHomeDirectory() stringByAppendingPathComponent:@"Documents/Codex/ShotCraft Studio"];[NSFileManager.defaultManager createDirectoryAtPath:data withIntermediateDirectories:YES attributes:nil error:nil];NSString *log=[data stringByAppendingPathComponent:@"desktop.log"];[NSFileManager.defaultManager createFileAtPath:log contents:nil attributes:nil];
 self.backend=[NSTask new];self.backend.executableURL=[NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"node"]];self.backend.arguments=@[[studio stringByAppendingPathComponent:@"server/server.mjs"]];self.backend.currentDirectoryURL=[NSURL fileURLWithPath:studio];NSMutableDictionary *env=[NSProcessInfo.processInfo.environment mutableCopy];env[@"PATH"]=@"/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin";env[@"STUDIO_DATA"]=data;self.backend.environment=env;self.backend.standardOutput=[NSFileHandle fileHandleForWritingAtPath:log];self.backend.standardError=self.backend.standardOutput;
 NSError *error=nil;if([self.backend launchAndReturnError:&error])[self check:YES];else[self error:error.localizedDescription];
}
-(void)error:(NSString*)message {NSAlert *a=[NSAlert new];a.messageText=@"工作台无法打开";a.informativeText=message;[a runModal];}
-(void)about:(id)sender {NSAlert *a=[NSAlert new];a.messageText=@"ShotCraft Studio 1.0";a.informativeText=@"手动视频工作台\n基于 Video Shotcraft 与 Remotion\n工程和素材保存在本机。";[a runModal];}
-(BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)sender{return YES;}
-(NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication*)sender { [self.web evaluateJavaScript:@"window.dispatchEvent(new Event('beforeunload')); true;" completionHandler:^(id value,NSError *error){dispatch_after(dispatch_time(DISPATCH_TIME_NOW,.8*NSEC_PER_SEC),dispatch_get_main_queue(),^{[sender replyToApplicationShouldTerminate:YES];});}];return NSTerminateLater; }
-(void)applicationWillTerminate:(NSNotification*)n{if(self.backend.running)[self.backend terminate];}
-(void)webView:(WKWebView*)web runOpenPanelWithParameters:(WKOpenPanelParameters*)parameters initiatedByFrame:(WKFrameInfo*)frame completionHandler:(void(^)(NSArray<NSURL*>*))completion {NSOpenPanel *p=[NSOpenPanel openPanel];p.allowsMultipleSelection=parameters.allowsMultipleSelection;p.canChooseDirectories=NO;[p beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result){completion(result==NSModalResponseOK?p.URLs:nil);}];}
-(void)webView:(WKWebView*)web runJavaScriptAlertPanelWithMessage:(NSString*)message initiatedByFrame:(WKFrameInfo*)frame completionHandler:(void(^)(void))completion {NSAlert *a=[NSAlert new];a.messageText=message;[a beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse r){completion();}];}
-(void)webView:(WKWebView*)web runJavaScriptConfirmPanelWithMessage:(NSString*)message initiatedByFrame:(WKFrameInfo*)frame completionHandler:(void(^)(BOOL))completion {NSAlert *a=[NSAlert new];a.messageText=message;[a addButtonWithTitle:@"确定"];[a addButtonWithTitle:@"取消"];[a beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse r){completion(r==NSAlertFirstButtonReturn);}];}
-(void)webView:(WKWebView*)web decidePolicyForNavigationAction:(WKNavigationAction*)action decisionHandler:(void(^)(WKNavigationActionPolicy))decision {NSURL *u=action.request.URL;if([u.host isEqual:@"127.0.0.1"]||[u.scheme isEqual:@"about"]||[u.scheme isEqual:@"blob"]){decision(WKNavigationActionPolicyAllow);}else{if([@[@"http",@"https"] containsObject:u.scheme])[NSWorkspace.sharedWorkspace openURL:u];decision(WKNavigationActionPolicyCancel);}}
@end
int main(int argc,const char *argv[]){@autoreleasepool{NSApplication *app=NSApplication.sharedApplication;Studio *delegate=[Studio new];app.delegate=delegate;[app run];}return 0;}
