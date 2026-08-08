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
 * A 6-second timer is the backstop so genuinely passive readers still count.
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
    const timer = window.setTimeout(fire, 6000);
    return () => {
      for (const e of events) window.removeEventListener(e, fire);
      window.clearTimeout(timer);
    };
  }, [armed]);

  if (!armed) return null;

  return (
    <>
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {clarityId && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  );
}
