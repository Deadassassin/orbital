package com.orbital.browser;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Orbital";
    private WebView contentWebView;
    private WebView bridgeWebView;
    private SwipeRefreshLayout swipeRefresh;
    private ViewGroup sharedParent;
    private int currentZoom = 100;
    private boolean adBlockEnabled = false;
    private boolean trackerBlockEnabled = false;
    private boolean blockScripts = false;
    private boolean desktopMode = false;

    private static final Set<String> AD_DOMAINS = new HashSet<>(Arrays.asList(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com",
        "googletagservices.com", "adservice.google.com", "adserver.adnxs.com",
        "adnxs.com", "adsrvr.org", "pubmatic.com", "openx.net",
        "casalemedia.com", "moatads.com", "adsafeprotected.com",
        "amazon-adsystem.com", "aax.amazon-adsystem.com", "adzerk.net",
        "tribalfusion.com", "revcontent.com", "sharethrough.com",
        "criteo.com", "criteo.net", "outbrain.com", "taboola.com",
        "taboolasyndication.com", "scorecardresearch.com", "quantserve.com",
        "exelator.com", "bluekai.com", "demdex.net", "krxd.net",
        "1rx.io", "bidswitch.net", "adform.net", "contextweb.com",
        "rlcdn.com", "mathtag.com", "advertising.com", "adtech.us",
        "2o7.net", "omtrdc.net", "everesttech.net", "media.net",
        "propellerads.com", "popads.net", "adbrite.com", "admarvel.com",
        "adsafeprotected.com", "apex.go.sonobi.com", "prebid.js",
        "criteo.com", "rubiconproject.com", "spotxchange.com",
        "indexww.com", "lijit.com", "contextweb.com", "pubmatic.com"
    ));

    private static final Set<String> TRACKER_DOMAINS = new HashSet<>(Arrays.asList(
        "google-analytics.com", "googletagmanager.com", "facebook.com/tr",
        "facebook.net", "connect.facebook.net", "analytics.twitter.com",
        "ads.twitter.com", "static.ads-twitter.com", "pixel.quantserve.com",
        "scorecardresearch.com", "metrics.cnn.com", "omniture.com",
        "samsungads.com", "branch.io", "adjust.com", "appsflyer.com",
        "amplitude.com", "mixpanel.com", "segment.io", "segment.com",
        "hotjar.com", "mouseflow.com", "crazyegg.com", "fullstory.com",
        "luckyorange.com", "clicky.com", "chartbeat.com", "comscore.com",
        "nr-data.net", "newrelic.com", "datadog.com", "mouseflow.com",
        "inspectlet.com", "sessioncam.com", "smartlook.com", "heap.io",
        "posthog.com", "matomo.org", "piwik.org", "wt-safetag.com",
        "collector.github.com", "a.quora.com", "bounceexchange.com"
    ));

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
            bridgeWebView = getBridge().getWebView();
            bridgeWebView.setBackgroundColor(Color.TRANSPARENT);
            sharedParent = (ViewGroup) bridgeWebView.getParent();
            setupContentWebView();
        } catch (Exception e) {
            Log.e(TAG, "onCreate error", e);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupContentWebView() {
        try {
            contentWebView = new WebView(this);
            contentWebView.setBackgroundColor(Color.WHITE);

            WebSettings s = contentWebView.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setLoadWithOverviewMode(true);
            s.setUseWideViewPort(true);
            s.setBuiltInZoomControls(true);
            s.setDisplayZoomControls(false);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            s.setAllowFileAccess(true);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);
            s.setUserAgentString("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");

            final String MOBILE_UA = s.getUserAgentString();
            final String DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

            contentWebView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (url == null) return false;
                    try {
                        String scheme = android.net.Uri.parse(url).getScheme();
                        if ("http".equals(scheme) || "https".equals(scheme) ||
                            "about".equals(scheme) || "data".equals(scheme) ||
                            "javascript".equals(scheme) || "blob".equals(scheme))
                            return false;
                        startActivity(new android.content.Intent(
                            android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)));
                        return true;
                    } catch (Exception e) {
                        Log.w(TAG, "overrideUrl: " + url, e);
                        return false;
                    }
                }

                @Override
                public void onPageStarted(WebView view, String url, Bitmap favicon) {
                    if (url != null) updateBridgeUrl(url);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    try {
                        if (swipeRefresh != null)
                            swipeRefresh.setRefreshing(false);
                        bridgeWebView.evaluateJavascript("window.onRefreshState(false)", null);
                        if (currentZoom != 100) {
                            contentWebView.evaluateJavascript(
                                "document.body.style.zoom = '" + currentZoom + "%'", null);
                        }
                        if (adBlockEnabled) {
                            injectAdBlocker();
                        }
                        bridgeWebView.evaluateJavascript("window.onPageDone()", null);
                    } catch (Exception e) {
                        Log.e(TAG, "onPageFinished error", e);
                    }
                }

                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (!adBlockEnabled && !trackerBlockEnabled) return null;
                    try {
                        String url = request.getUrl().toString();
                        String host = request.getUrl().getHost();
                        if (host == null) return null;
                        if (blockScripts && url.contains(".js")) {
                            return emptyResponse();
                        }
                        if (adBlockEnabled && isAdDomain(host)) {
                            Log.d(TAG, "Blocked ad: " + host);
                            return emptyResponse();
                        }
                        if (trackerBlockEnabled && isTrackerDomain(url, host)) {
                            Log.d(TAG, "Blocked tracker: " + host);
                            return emptyResponse();
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "shouldInterceptRequest error", e);
                    }
                    return null;
                }
            });

            contentWebView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onReceivedTitle(WebView view, String title) {
                    if (title != null && !title.isEmpty()) {
                        try {
                            String escaped = title.replace("\\", "\\\\").replace("'", "\\'");
                            bridgeWebView.evaluateJavascript("window.onTitleChanged('" + escaped + "')", null);
                        } catch (Exception e) {
                            Log.e(TAG, "onReceivedTitle error", e);
                        }
                    }
                }
            });

            swipeRefresh = new SwipeRefreshLayout(this);
            swipeRefresh.setColorSchemeColors(Color.rgb(26, 115, 232));
            swipeRefresh.setOnRefreshListener(() -> {
                try {
                    if (contentWebView != null) contentWebView.reload();
                    bridgeWebView.evaluateJavascript("window.onRefreshState(true)", null);
                } catch (Exception e) {
                    Log.e(TAG, "refresh error", e);
                }
            });
            swipeRefresh.addView(contentWebView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

            bridgeWebView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void navigate(final String url, final int topPx, final int bottomPx) {
                    runOnUiThread(() -> {
                        try {
                            if (url == null || url.isEmpty()) { hide(); return; }
                            attachContent();
                            float d = getResources().getDisplayMetrics().density;
                            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) swipeRefresh.getLayoutParams();
                            lp.topMargin = Math.round(topPx * d);
                            lp.bottomMargin = Math.round(bottomPx * d);
                            swipeRefresh.setLayoutParams(lp);
                            swipeRefresh.setVisibility(ViewGroup.VISIBLE);
                            contentWebView.loadUrl(url);
                        } catch (Exception e) {
                            Log.e(TAG, "navigate error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void hide() {
                    runOnUiThread(() -> {
                        try {
                            if (swipeRefresh != null)
                                swipeRefresh.setVisibility(ViewGroup.GONE);
                        } catch (Exception e) {
                            Log.e(TAG, "hide error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void overlayShow() {
                    runOnUiThread(() -> {
                        try {
                            if (swipeRefresh != null)
                                swipeRefresh.setVisibility(ViewGroup.GONE);
                        } catch (Exception e) {
                            Log.e(TAG, "overlayShow error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void overlayHide() {
                    runOnUiThread(() -> {
                        try {
                            if (swipeRefresh != null && contentWebView != null) {
                                String url = contentWebView.getUrl();
                                if (url != null && !url.equals("about:blank")) {
                                    swipeRefresh.setVisibility(ViewGroup.VISIBLE);
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "overlayHide error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void goBack() {
                    runOnUiThread(() -> {
                        try {
                            if (contentWebView != null && contentWebView.canGoBack())
                                contentWebView.goBack();
                            else
                                hide();
                        } catch (Exception e) {
                            Log.e(TAG, "goBack error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void goForward() {
                    runOnUiThread(() -> {
                        try {
                            if (contentWebView != null && contentWebView.canGoForward())
                                contentWebView.goForward();
                        } catch (Exception e) {
                            Log.e(TAG, "goForward error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void reload() {
                    runOnUiThread(() -> {
                        try {
                            if (contentWebView != null) contentWebView.reload();
                        } catch (Exception e) {
                            Log.e(TAG, "reload error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setDataSaver(boolean enabled) {
                    runOnUiThread(() -> {
                        try {
                            contentWebView.getSettings().setLoadsImagesAutomatically(!enabled);
                        } catch (Exception e) {
                            Log.e(TAG, "setDataSaver error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setZoom(final int percent) {
                    runOnUiThread(() -> {
                        try {
                            currentZoom = percent;
                            if (contentWebView != null) {
                                contentWebView.evaluateJavascript(
                                    "document.body.style.zoom = '" + percent + "%'", null);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "setZoom error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setAdBlock(boolean enabled) {
                    runOnUiThread(() -> {
                        try {
                            adBlockEnabled = enabled;
                            if (enabled && contentWebView != null) injectAdBlocker();
                        } catch (Exception e) {
                            Log.e(TAG, "setAdBlock error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setTrackerBlock(boolean enabled) {
                    runOnUiThread(() -> {
                        try {
                            trackerBlockEnabled = enabled;
                        } catch (Exception e) {
                            Log.e(TAG, "setTrackerBlock error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setBlockScripts(boolean enabled) {
                    runOnUiThread(() -> {
                        try {
                            blockScripts = enabled;
                            contentWebView.getSettings().setJavaScriptEnabled(!enabled);
                        } catch (Exception e) {
                            Log.e(TAG, "setBlockScripts error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void setDesktopMode(boolean enabled) {
                    runOnUiThread(() -> {
                        try {
                            desktopMode = enabled;
                            WebSettings ws = contentWebView.getSettings();
                            if (enabled) {
                                ws.setUserAgentString(DESKTOP_UA);
                                ws.setLoadWithOverviewMode(true);
                                ws.setUseWideViewPort(true);
                            } else {
                                ws.setUserAgentString(MOBILE_UA);
                                ws.setLoadWithOverviewMode(true);
                                ws.setUseWideViewPort(true);
                            }
                            if (contentWebView.getUrl() != null) contentWebView.reload();
                        } catch (Exception e) {
                            Log.e(TAG, "setDesktopMode error", e);
                        }
                    });
                }

                @JavascriptInterface
                public void clearCache() {
                    runOnUiThread(() -> {
                        try {
                            contentWebView.clearCache(true);
                            contentWebView.clearHistory();
                            contentWebView.clearFormData();
                            bridgeWebView.evaluateJavascript("window.onCacheCleared()", null);
                        } catch (Exception e) {
                            Log.e(TAG, "clearCache error", e);
                        }
                    });
                }
            }, "AndroidBrowser");

            attachContent();
        } catch (Exception e) {
            Log.e(TAG, "setupContentWebView error", e);
        }
    }

    private void injectAdBlocker() {
        try {
            String js = "(function(){" +
                "var s=document.querySelectorAll('[id*=\"ad\"],[class*=\"ad\"]," +
                "[id*=\"banner\"],[class*=\"banner\"],[id*=\"sponsor\"]," +
                "[class*=\"sponsor\"],[id*=\"promo\"],[class*=\"promo\"]," +
            "[id*=\"google_ads\"],[id*=\"taboola\"],[class*=\"taboola\"]," +
            "ins.adsbygoogle');" +
                "for(var i=0;i<s.length;i++){s[i].style.display='none'}" +
                "var f=document.querySelectorAll('iframe[src*=\"ad\"],iframe[src*=\"doubleclick\"]');" +
                "for(var i=0;i<f.length;i++){f[i].style.display='none'}" +
                "})();";
            contentWebView.evaluateJavascript(js, null);
        } catch (Exception e) {
            Log.e(TAG, "injectAdBlocker error", e);
        }
    }

    private WebResourceResponse emptyResponse() {
        return new WebResourceResponse("text/plain", "utf-8",
            new ByteArrayInputStream("".getBytes()));
    }

    private boolean isAdDomain(String host) {
        for (String d : AD_DOMAINS) {
            if (host.equals(d) || host.endsWith("." + d)) return true;
        }
        return false;
    }

    private boolean isTrackerDomain(String url, String host) {
        for (String d : TRACKER_DOMAINS) {
            if (host.equals(d) || host.endsWith("." + d)) return true;
        }
        if (url.contains("facebook.com/tr")) return true;
        return false;
    }

    private void updateBridgeUrl(String url) {
        try {
            String escaped = url.replace("\\", "\\\\").replace("'", "\\'");
            bridgeWebView.evaluateJavascript("window.onUrlChanged('" + escaped + "')", null);
        } catch (Exception e) {
            Log.e(TAG, "updateBridgeUrl error", e);
        }
    }

    private void attachContent() {
        try {
            if (swipeRefresh == null) return;
            if (swipeRefresh.getParent() != null) return;
            if (sharedParent != null) {
                swipeRefresh.setVisibility(ViewGroup.GONE);
                sharedParent.addView(swipeRefresh);
            }
        } catch (Exception e) {
            Log.e(TAG, "attachContent error", e);
        }
    }

    @Override
    public void onBackPressed() {
        try {
            if (swipeRefresh != null && swipeRefresh.getVisibility() == ViewGroup.VISIBLE) {
                if (contentWebView != null && contentWebView.canGoBack()) {
                    contentWebView.goBack();
                } else {
                    swipeRefresh.setVisibility(ViewGroup.GONE);
                    bridgeWebView.evaluateJavascript("window.onNativeClose()", null);
                }
            } else {
                super.onBackPressed();
            }
        } catch (Exception e) {
            Log.e(TAG, "onBackPressed error", e);
            super.onBackPressed();
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (swipeRefresh != null) {
                ViewGroup parent = (ViewGroup) swipeRefresh.getParent();
                if (parent != null) parent.removeView(swipeRefresh);
            }
            if (contentWebView != null) contentWebView.destroy();
        } catch (Exception e) {
            Log.e(TAG, "onDestroy error", e);
        }
        super.onDestroy();
    }
}
