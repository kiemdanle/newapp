package com.expyrico.app

import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "Expyrico"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return DefaultReactActivityDelegate(
            this,
            mainComponentName,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        )
    }

    private var defaultBackInvoked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)

        val backCallback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (defaultBackInvoked) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                    defaultBackInvoked = false
                } else {
                    val delegate = reactActivityDelegate
                    if (!delegate.onBackPressed()) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        }
        onBackPressedDispatcher.addCallback(this, backCallback)
    }

    override fun invokeDefaultOnBackPressed() {
        defaultBackInvoked = true
        onBackPressedDispatcher.onBackPressed()
    }
}
