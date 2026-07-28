const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_SOURCE = `package com.anonymous.wallepi

import android.app.WallpaperManager
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.io.IOException

@ReactModule(name = WallepiWallpaperModule.NAME)
class WallepiWallpaperModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = NAME

  @ReactMethod
  fun setWallpaper(uriString: String, target: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N && target != "home") {
      promise.reject("UNSUPPORTED_TARGET", "Lock-screen wallpaper requires Android 7.0 or newer.")
      return
    }

    val which = when (target) {
      "home" -> WallpaperManager.FLAG_SYSTEM
      "lock" -> WallpaperManager.FLAG_LOCK
      "both" -> WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK
      else -> { promise.reject("INVALID_TARGET", "Target must be home, lock, or both."); return }
    }

    try {
      val input = reactApplicationContext.contentResolver.openInputStream(Uri.parse(uriString))
        ?: throw IOException("Could not read the downloaded wallpaper.")
      input.use { WallpaperManager.getInstance(reactApplicationContext).setStream(it, null, true, which) }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SET_WALLPAPER_FAILED", "Could not set wallpaper.", error)
    }
  }

  companion object { const val NAME = "WallepiWallpaper" }
}
`;

const PACKAGE_SOURCE = `package com.anonymous.wallepi

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class WallepiWallpaperPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == WallepiWallpaperModule.NAME) WallepiWallpaperModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(WallepiWallpaperModule.NAME to ReactModuleInfo(
      WallepiWallpaperModule.NAME, WallepiWallpaperModule::class.java.name, false, false, false, false
    ))
  }
}
`;

module.exports = function withWallepiWallpaper(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    if (!permissions.some((permission) => permission.$?.['android:name'] === 'android.permission.SET_WALLPAPER')) {
      permissions.push({ $: { 'android:name': 'android.permission.SET_WALLPAPER' } });
    }
    manifest['uses-permission'] = permissions;
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const packagePath = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/anonymous/wallepi');
    fs.mkdirSync(packagePath, { recursive: true });
    fs.writeFileSync(path.join(packagePath, 'WallepiWallpaperModule.kt'), MODULE_SOURCE);
    fs.writeFileSync(path.join(packagePath, 'WallepiWallpaperPackage.kt'), PACKAGE_SOURCE);

    const applicationPath = path.join(packagePath, 'MainApplication.kt');
    let application = fs.readFileSync(applicationPath, 'utf8');
    if (!application.includes('add(WallepiWallpaperPackage())')) {
      const updatedApplication = application.replace(
        /(PackageList\(this\)\.packages\.apply \{\n)/,
        '$1          add(WallepiWallpaperPackage())\n'
      );
      if (updatedApplication === application) {
        throw new Error('Unable to register WallepiWallpaperPackage in MainApplication.kt.');
      }
      application = updatedApplication;
      fs.writeFileSync(applicationPath, application);
    }
    return config;
  }]);
};
