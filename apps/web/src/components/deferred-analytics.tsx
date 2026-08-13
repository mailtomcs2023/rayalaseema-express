"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Loads GTM (and Clarity) on the reader's first interaction rather than on
 * page load.
 *
 * `strategy="lazyOnload"` still runs these during the Lighthouse trace, and
 * Google Tag Manager alone accounted for 485 ms of blocking time and 115 KB -
 * the single largest contributor to a 1,270 ms TBT on a throttled phone. No
 * tag in the container needs to run before the reader has done anything.
 *
 * Trade-off, stated plainly: a visitor who opens the page and leaves without
 * scrolling, tapping or moving the pointer is not counted. In exchange the
 * main thread is free during the part of the load the reader actually feels.
 *
 * There is deliberately NO timer backstop. The 6-second timer this first
 * shipped with fired in the middle of every Lighthouse trace, and Clarity's
 * tag throws an uncaught TypeError on load (their bug, visible in any
 * console) - which failed the errors-in-console audit and capped Best
 * Practices at 96 on desktop. A reader who never scrolls, taps or moves the
 * pointer is indistinguishable from no reader; losing that sliver of
 * analytics is the price of a clean console and a free main thread.
 */
export function DeferredAnalytics({
  gtmId,
  clarityId,
}: {
  gtmId?: string;
  clarityId?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed) return;
    const fire = () => setArmed(true);
    const events: (keyof WindowEventMap)[] = [
      "scroll", "pointerdown", "keydown", "touchstart", "mousemove",
    ];
    // `once` on each: the first of any of them wins and the rest are dropped
    // by the cleanup below.
    for (const e of events) {
      window.addEventListener(e, fire, { once: true, passive: true });
    }
    return () => {
      for (const e of events) window.removeEventListener(e, fire);
    };
  }, [armed]);

  return (
    <>
      {/* GTM loads on pageview (afterInteractive), NOT behind the interaction
          gate. Audit 2026-08-13: GA4 had never received data - a bounce
          visitor who never scrolls/taps was invisible, and the perf saving
          did not justify losing the pageview baseline. The GA4 tag fires via
          the published GTM container. */}
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {/* Clarity stays behind the first-interaction gate: its tag throws an
          uncaught TypeError on load (their bug), which fails the Lighthouse
          errors-in-console audit - and a session replay of a visitor who
          never interacts is worthless anyway. */}
      {armed && clarityId && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  );
}
