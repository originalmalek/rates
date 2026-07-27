interface Props {
  gaId: string;
  /**
   * Same-origin path prefix that Caddy reverse-proxies to Google (the /mx block
   * in caddy/Caddyfile). Empty means load gtag.js straight from
   * googletagmanager.com — ad-blockers kill that by domain, but it's the only
   * form GA's own "tag detected" check recognises, so keep it off until the
   * property is confirmed receiving data.
   */
  proxy?: string;
}

/**
 * GA4 via gtag.js, emitted verbatim into the server-rendered HTML.
 *
 * Deliberately NOT a client component and deliberately not next/script: with
 * `afterInteractive` the tag is injected only after hydration, so it never
 * appears in view-source and GA's detector reports "tag not found".
 */
export default function Analytics({ gaId, proxy }: Props) {
  const src = proxy
    ? `${proxy}/l.js?id=${gaId}`
    : `https://www.googletagmanager.com/gtag/js?id=${gaId}`;

  // gtag.js appends "/g/collect" to transport_url itself, so the prefix is bare.
  const config = proxy
    ? `gtag('config', '${gaId}', { transport_url: window.location.origin + '${proxy}' });`
    : `gtag('config', '${gaId}');`;

  return (
    <>
      <script async src={src} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${config}`,
        }}
      />
    </>
  );
}
