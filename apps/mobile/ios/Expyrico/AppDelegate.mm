#import "AppDelegate.h"
#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  @try {
    if ([FIRApp defaultApp] == nil) {
      NSString *filePath = [[NSBundle mainBundle] pathForResource:@"GoogleService-Info" ofType:@"plist"];
      if (filePath != nil) {
        FIROptions *options = [[FIROptions alloc] initWithContentsOfFile:filePath];
        if (options != nil) {
          [FIRApp configureWithOptions:options];
        }
      }
    }
  } @catch (NSException *exception) {
    NSLog(@"Firebase initialization error: %@", exception.reason);
  }

  self.moduleName = @"Expyrico";
  self.initialProps = @{};

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];
  self.window.backgroundColor = [UIColor systemBackgroundColor];
  if (self.window.rootViewController.view != nil) {
    self.window.rootViewController.view.backgroundColor = [UIColor systemBackgroundColor];
  }
  return result;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
