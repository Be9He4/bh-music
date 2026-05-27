package com.otterhub.music;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;

/**
 * B站音频代理插件
 * 管理本地HTTP代理服务器的启动/停止，提供代理URL生成
 */
@CapacitorPlugin(name = "BilibiliProxy")
public class BilibiliProxyPlugin extends Plugin {

    private static BilibiliProxyServer proxyServer;
    private static final Object lock = new Object();

    @PluginMethod
    public void startServer(PluginCall call) {
        synchronized (lock) {
            if (proxyServer != null && proxyServer.isAlive()) {
                // 服务器已在运行
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("port", proxyServer.getListeningPort());
                call.resolve(result);
                return;
            }

            try {
                proxyServer = new BilibiliProxyServer();
                proxyServer.start();

                // 等待服务器启动
                int retries = 0;
                while (!proxyServer.isAlive() && retries < 50) {
                    Thread.sleep(100);
                    retries++;
                }

                if (proxyServer.isAlive()) {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("port", proxyServer.getListeningPort());
                    call.resolve(result);
                } else {
                    call.reject("Server failed to start");
                }
            } catch (IOException e) {
                call.reject("Failed to start server: " + e.getMessage());
            } catch (InterruptedException e) {
                call.reject("Server start interrupted");
            }
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        synchronized (lock) {
            if (proxyServer != null) {
                proxyServer.stop();
                proxyServer = null;
            }
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void getProxyUrl(PluginCall call) {
        String audioUrl = call.getString("audioUrl");
        String bvid = call.getString("bvid");

        if (audioUrl == null || bvid == null) {
            call.reject("Missing audioUrl or bvid parameter");
            return;
        }

        synchronized (lock) {
            if (proxyServer == null || !proxyServer.isAlive()) {
                call.reject("Proxy server not running");
                return;
            }

            String proxyUrl = proxyServer.getProxyUrl(audioUrl, bvid);
            if (proxyUrl != null) {
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("url", proxyUrl);
                call.resolve(result);
            } else {
                call.reject("Failed to generate proxy URL");
            }
        }
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        synchronized (lock) {
            boolean running = proxyServer != null && proxyServer.isAlive();
            JSObject result = new JSObject();
            result.put("running", running);
            if (running) {
                result.put("port", proxyServer.getListeningPort());
            }
            call.resolve(result);
        }
    }
}
