"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { analyticsConfig, flushPendingMetaEvents, recordAnalyticsError, trackRouteChange } from "@/lib/analytics";

const { googleAnalyticsId, googleTagManagerId, metaPixelId } = analyticsConfig;

export function Analytics() {
  const pathname = usePathname();
  const trackedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (trackedPathname.current === pathname) return;
    trackedPathname.current = pathname;
    trackRouteChange(pathname);
  }, [pathname]);

  return (
    <>
      <span hidden aria-hidden="true" data-analytics-root />
      {googleAnalyticsId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
            onError={() => recordAnalyticsError("ga4", "script_load")}
          />
          <Script id="google-analytics" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(googleAnalyticsId)}, { anonymize_ip: true, send_page_view: false });
          `}</Script>
        </>
      ) : null}

      {googleTagManagerId ? (
        <>
          <Script id="google-tag-manager" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;j.onerror=function(){w[l].push({event:'analytics_error',analytics_event:'script_load',analytics_integration:'gtm'})};f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer',${JSON.stringify(googleTagManagerId)});
          `}</Script>
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" /></noscript>
        </>
      ) : null}

      {metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive" onReady={flushPendingMetaEvents}>{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;t.onerror=function(){(f.dataLayer=f.dataLayer||[]).push({event:'analytics_error',analytics_event:'script_load',analytics_integration:'meta'})};s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', ${JSON.stringify(metaPixelId)});
        `}</Script>
      ) : null}
    </>
  );
}
