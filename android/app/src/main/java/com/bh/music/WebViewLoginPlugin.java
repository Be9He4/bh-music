package com.bh.music;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 通用 WebView 登录插件
 * 打开全屏 WebView 加载指定登录页，轮询 CookieManager 直到
 * 出现 successKey 对应的 Cookie，合并 cookieUrls 域下所有 Cookie
 * 后返回给 JS 层验证并持久化。
 */
@CapacitorPlugin(name = "WebViewLogin")
public class WebViewLoginPlugin extends Plugin {

    private static final long POLL_INTERVAL_MS = 1000;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Dialog loginDialog;
    private WebView loginWebView;
    private Runnable pollRunnable;
    private PluginCall pendingCall;

    private String successKey;
    private Set<String> cookieUrls = new LinkedHashSet<>();

    /**
     * 清空全局 CookieManager 中的残留 Cookie。
     * 用于退出登录时清除，避免下次打开登录页自动携带上次登录态。
     * 应用自身 API 请求走显式 Cookie 头，不依赖 CookieManager，清空无副作用。
     */
    @PluginMethod
    public void clearCookies(PluginCall call) {
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(value -> {
            cm.flush();
            call.resolve();
        });
    }

    @PluginMethod
    public void openLogin(PluginCall call) {
        if (pendingCall != null) {
            call.reject("Login dialog is already open");
            return;
        }
        String url = call.getString("url");
        JSArray cookieUrlsArg = call.getArray("cookieUrls");
        String successKeyArg = call.getString("successKey");
        String customUa = call.getString("userAgent");
        if (url == null || url.isEmpty() || cookieUrlsArg == null
                || successKeyArg == null || successKeyArg.isEmpty()) {
            call.reject("url, cookieUrls and successKey are required");
            return;
        }

        cookieUrls.clear();
        try {
            for (Object item : cookieUrlsArg.toList()) {
                if (item instanceof String && !((String) item).isEmpty()) {
                    cookieUrls.add((String) item);
                }
            }
        } catch (JSONException e) {
            call.reject("Invalid cookieUrls: " + e.getMessage());
            return;
        }
        if (cookieUrls.isEmpty()) {
            call.reject("cookieUrls must not be empty");
            return;
        }
        successKey = successKeyArg;

        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            call.reject("Activity not available");
            return;
        }
        pendingCall = call;
        final String ua = customUa;
        activity.runOnUiThread(() -> openLoginDialog(activity, url, ua));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void openLoginDialog(Activity activity, String url, String customUa) {
        WebView webView = new WebView(activity.getApplicationContext());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        if (customUa != null && !customUa.isEmpty()) {
            // 指定 UA（如桌面 Chrome），避免站点按移动端重定向丢失登录入口
            settings.setUserAgentString(customUa);
        } else {
            // 去掉默认 UA 中的 "wv" 标记，降低被站点风控拦截的概率
            String ua = settings.getUserAgentString();
            if (ua != null && ua.contains("wv")) {
                settings.setUserAgentString(ua.replace("wv", ""));
            }
        }

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // 放行非 http/https scheme（如 QQ 一键登录唤起手机 QQ 的 mqq:// 跳转）
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String requestUrl) {
                if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
                    return false;
                }
                try {
                    view.getContext().startActivity(
                            android.content.Intent.parseUri(requestUrl, 0));
                } catch (Exception ignored) {
                    // 目标应用不存在时留在 WebView 内继续
                }
                return true;
            }
        });
        webView.setBackgroundColor(Color.WHITE);
        webView.loadUrl(url);

        loginDialog = new Dialog(activity, android.R.style.Theme_NoTitleBar_Fullscreen);
        loginDialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        loginDialog.setContentView(webView);
        loginWebView = webView;
        loginDialog.setOnCancelListener(dialog -> cancelLogin());
        loginDialog.setOnDismissListener(dialog -> cleanup());
        loginDialog.show();

        startPolling();
    }

    private void startPolling() {
        stopPolling();
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                if (pendingCall == null) return;
                for (String cookieUrl : cookieUrls) {
                    String cookies = CookieManager.getInstance().getCookie(cookieUrl);
                    if (cookies != null && cookies.contains(successKey + "=")) {
                        finishLogin(collectCookies());
                        return;
                    }
                }
                mainHandler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
        mainHandler.postDelayed(pollRunnable, POLL_INTERVAL_MS);
    }

    private void stopPolling() {
        if (pollRunnable != null) {
            mainHandler.removeCallbacks(pollRunnable);
            pollRunnable = null;
        }
    }

    private String collectCookies() {
        Set<String> parts = new LinkedHashSet<>();
        for (String url : cookieUrls) {
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies == null || cookies.isEmpty()) continue;
            for (String part : cookies.split(";")) {
                String trimmed = part.trim();
                if (!trimmed.isEmpty()) parts.add(trimmed);
            }
        }
        return String.join("; ", parts);
    }

    private void finishLogin(String cookie) {
        stopPolling();
        dismissDialog();
        if (pendingCall != null) {
            PluginCall call = pendingCall;
            pendingCall = null;
            JSObject result = new JSObject();
            result.put("cookie", cookie);
            call.resolve(result);
        }
    }

    private void cancelLogin() {
        stopPolling();
        dismissDialog();
        if (pendingCall != null) {
            PluginCall call = pendingCall;
            pendingCall = null;
            call.resolve(null);
        }
    }

    private void dismissDialog() {
        if (loginDialog != null && loginDialog.isShowing()) {
            loginDialog.dismiss();
        }
    }

    private void cleanup() {
        if (loginWebView != null) {
            loginWebView.stopLoading();
            loginWebView.loadUrl("about:blank");
            loginWebView.removeAllViews();
            loginWebView.destroy();
            loginWebView = null;
        }
        loginDialog = null;
        // 对话框被系统关闭（非主动 resolve）时兜底释放 pendingCall
        if (pendingCall != null) {
            PluginCall call = pendingCall;
            pendingCall = null;
            call.resolve(null);
        }
    }
}
