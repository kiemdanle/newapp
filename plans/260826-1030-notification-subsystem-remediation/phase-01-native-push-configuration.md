---
phase: 1
title: "Native Push Configuration"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Native Push Configuration

## Overview
Configures the native Android and iOS application environments to support Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs). This includes integrating Gradle plugins, defining notification channels and background handlers on Android, and setting up entitlements, background modes, and native Firebase initialization on iOS.

<!-- Updated: Red-Team Review - Added programmatic Android Notification Channel creation & iOS aps-environment build mapping -->

---

## Requirements

### Functional Requirements
- Android native build must apply `com.google.gms.google-services` to process `google-services.json`.
- Android must establish a default high-importance notification channel (`expyrico_default`) with sound and vibration on app startup (in `MainApplication.kt` / `MainActivity.kt`) for Android 8.0+ (API 26+).
- React Native entry point (`apps/mobile/index.js`) must register a background message handler before `AppRegistry.registerComponent`.
- iOS must have the `aps-environment` entitlement mapped correctly in `Expyrico.entitlements` (`development` for debug, `production` for release/distribution).
- iOS `Info.plist` must include `UIBackgroundModes` with `remote-notification`.
- iOS `AppDelegate.mm` must initialize Firebase natively via `[FIRApp configure]` in `didFinishLaunchingWithOptions:`.

### Non-Functional Requirements
- Maintain compatibility with Gradle 8.6, AGP 8.6, Kotlin 2.0.21, and Android SDK 36.
- Maintain iOS 16.0 deployment target with Hermes engine.

---

## Architecture & Code Changes

### 1. Android Gradle Configuration
* **`apps/mobile/android/build.gradle`**:
  Add Google Services classpath:
  ```groovy
  buildscript {
      dependencies {
          classpath("com.android.tools.build:gradle:8.6.0")
          classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
          classpath("com.google.gms:google-services:4.4.2")
      }
  }
  ```
* **`apps/mobile/android/app/build.gradle`**:
  Apply Google Services plugin at the bottom of plugins:
  ```groovy
  plugins {
      id("com.android.application")
      id("org.jetbrains.kotlin.android")
      id("com.facebook.react")
      id("com.google.gms.google-services")
  }
  ```

### 2. Android Native Channel Creation & Manifest
* **`apps/mobile/android/app/src/main/java/com/expyrico/app/MainApplication.kt`**:
  Create the default notification channel on application startup:
  ```kotlin
  import android.app.NotificationChannel
  import android.app.NotificationManager
  import android.os.Build

  class MainApplication : Application(), ReactApplication {
      override fun onCreate() {
          super.onCreate()
          createNotificationChannels()
          SoLoader.init(this, OpenSourceMergedSoMapping)
          if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
              load()
          }
      }

      private fun createNotificationChannels() {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              val channelId = "expyrico_default"
              val name = "Expyrico Reminders"
              val descriptionText = "Notifications for expiring items and community updates"
              val importance = NotificationManager.IMPORTANCE_HIGH
              val channel = NotificationChannel(channelId, name, importance).apply {
                  description = descriptionText
                  enableVibration(true)
              }
              val notificationManager = getSystemService(NotificationManager::class.java)
              notificationManager?.createNotificationChannel(channel)
          }
      }
  }
  ```
* **`apps/mobile/android/app/src/main/AndroidManifest.xml`**:
  Add default notification channel meta-data inside `<application>`:
  ```xml
  <meta-data
      android:name="com.google.firebase.messaging.default_notification_channel_id"
      android:value="expyrico_default" />
  ```
* **`apps/mobile/index.js`**:
  Register background handler:
  ```javascript
  import 'react-native-gesture-handler';
  import { AppRegistry } from 'react-native';
  import messaging from '@react-native-firebase/messaging';
  import App from './src/App';

  // Must be registered outside component lifecycle before registerComponent
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Process data-only background push or sync signals if needed
  });

  AppRegistry.registerComponent('Expyrico', () => App);
  ```

### 3. iOS Entitlements, Info.plist & AppDelegate
* **`apps/mobile/ios/Expyrico/Expyrico.entitlements`**:
  Add `aps-environment`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
      <key>com.apple.developer.associated-domains</key>
      <array>
          <string>webcredentials:expyrico.invalid</string>
      </array>
      <key>aps-environment</key>
      <string>development</string>
  </dict>
  </plist>
  ```
* **`apps/mobile/ios/Expyrico/Info.plist`**:
  Add `UIBackgroundModes`:
  ```xml
  <key>UIBackgroundModes</key>
  <array>
      <string>remote-notification</string>
  </array>
  ```
* **`apps/mobile/ios/Expyrico/AppDelegate.mm`**:
  Import `<Firebase.h>` and call `[FIRApp configure];`:
  ```objc
  #import "AppDelegate.h"
  #import <Firebase.h>
  #import <React/RCTBundleURLProvider.h>

  @implementation AppDelegate

  - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
  {
    [FIRApp configure];
    self.moduleName = @"Expyrico";
    self.initialProps = @{};
    return [super application:application didFinishLaunchingWithOptions:launchOptions];
  }
  ```

---

## Related Code Files
- Modify: `apps/mobile/android/build.gradle`
- Modify: `apps/mobile/android/app/build.gradle`
- Modify: `apps/mobile/android/app/src/main/java/com/expyrico/app/MainApplication.kt`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `apps/mobile/index.js`
- Modify: `apps/mobile/ios/Expyrico/Expyrico.entitlements`
- Modify: `apps/mobile/ios/Expyrico/Info.plist`
- Modify: `apps/mobile/ios/Expyrico/AppDelegate.mm`

---

## Implementation Steps
1. Update `apps/mobile/android/build.gradle` with Google Services plugin classpath.
2. Apply `com.google.gms.google-services` plugin in `apps/mobile/android/app/build.gradle`.
3. Add `createNotificationChannels()` in `MainApplication.kt` to initialize the `expyrico_default` channel.
4. Add default notification channel meta-data in `apps/mobile/android/app/src/main/AndroidManifest.xml`.
5. Add `messaging().setBackgroundMessageHandler` in `apps/mobile/index.js`.
6. Add `aps-environment` key to `apps/mobile/ios/Expyrico/Expyrico.entitlements`.
7. Add `UIBackgroundModes` array with `remote-notification` in `apps/mobile/ios/Expyrico/Info.plist`.
8. Configure `[FIRApp configure]` inside `AppDelegate.mm`.

---

## Success Criteria
- [ ] Android Gradle sync and build passes with `:app:assembleDebug`.
- [ ] Notification channel `expyrico_default` is created on Android 8.0+ devices upon app launch.
- [ ] `google-services.json` is parsed into Android resources at compile time.
- [ ] iOS project passes `pod install` and compiles with Firebase initialized.
- [ ] Background messages on Android do not throw unhandled handler errors.
- [ ] iOS app initializes without crashing and registers for APNs tokens.

---

## Risk Assessment
- **Missing `google-services.json` in CI:** The build requires a valid or stub `google-services.json`. A fallback sample copy script will ensure CI builds remain green.
- **iOS CocoaPods linkage:** `@react-native-firebase` uses static frameworks / modular headers. `use_modular_headers!` is already in Podfile.
