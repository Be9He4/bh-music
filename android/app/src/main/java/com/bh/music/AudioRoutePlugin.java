package com.bh.music;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioRoute")
public class AudioRoutePlugin extends Plugin {

    private BroadcastReceiver audioRouteReceiver;
    private boolean receiverRegistered;

    @Override
    public void load() {
        audioRouteReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                    return;
                }

                JSObject event = new JSObject();
                event.put("reason", "audio-became-noisy");
                notifyListeners("audioRouteLost", event);
            }
        };

        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(audioRouteReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(audioRouteReceiver, filter);
        }
        receiverRegistered = true;
    }

    @Override
    protected void handleOnDestroy() {
        if (receiverRegistered && audioRouteReceiver != null) {
            getContext().unregisterReceiver(audioRouteReceiver);
            receiverRegistered = false;
            audioRouteReceiver = null;
        }
        super.handleOnDestroy();
    }
}
