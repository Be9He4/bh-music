package com.bh.music;

import static androidx.core.view.WindowCompat.enableEdgeToEdge;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Android 15 enforces edge-to-edge; older versions should let the
        // system keep WebView content above the navigation bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            enableEdgeToEdge(getWindow());
        }
        registerPlugin(LocalMusicPlugin.class);
        registerPlugin(BilibiliProxyPlugin.class);
        registerPlugin(AudioRoutePlugin.class);
        registerPlugin(WebViewLoginPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int nightModeFlags = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDarkMode = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
        PluginHandle handle = getBridge().getPlugin("LocalMusicPlugin");
        if (handle != null) {
            ((LocalMusicPlugin) handle.getInstance()).notifyDarkModeChange(isDarkMode);
        }
    }
}
