/**
 * Faro Web SDK initializer for the michaellamb.dev landing page.
 * Adapted from grafana-faro-proxy/client/faro-init.js.
 *
 * Telemetry routes through grafana.michaellamb.dev as the `landing` app
 * (LANDING_INGEST_TOKEN in grafana-faro-proxy). SDK bundles are pinned to
 * EXACT versions and guarded with Subresource Integrity: unpkg resolves a
 * floating range server-side per request, so a range in the URL means the
 * page executes whatever the CDN returns at load time. Exact version + SRI
 * means the browser refuses anything that is not the reviewed bytes.
 *
 * To upgrade: bump the version, re-fetch the URL, and recompute the hash
 *   curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
 */
(function () {
  const APP_NAME = 'landing';
  const APP_VERSION = '1.0.0';
  const PROXY_ORIGIN = 'https://grafana.michaellamb.dev';

  const SDK = {
    core: {
      url: 'https://unpkg.com/@grafana/faro-web-sdk@1.19.0/dist/bundle/faro-web-sdk.iife.js',
      integrity: 'sha384-AitrXVjbrKDuMxgQcS6OFQOJwzOB2TN/2ZBd2QOGo57UCKtiLVbVtsXRcCrClWoL',
    },
    tracing: {
      url: 'https://unpkg.com/@grafana/faro-web-tracing@1.19.0/dist/bundle/faro-web-tracing.iife.js',
      integrity: 'sha384-g27gE4olnCLQ4CYZOJj3V1CulsIi0U3yuGtvk7v76tU2gWdNM1eQYiVPCIi0T9md',
    },
  };

  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const faroUrl = isLocalDev
    ? `http://localhost:8787/faro-proxy?app=${APP_NAME}`
    : `${PROXY_ORIGIN}/faro-proxy?app=${APP_NAME}`;

  function loadScript({ url, integrity }) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.integrity = integrity;
      // Required for SRI on a cross-origin script; without it the browser
      // cannot read the response to verify the hash and blocks the load.
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(s);
    });
  }

  loadScript(SDK.core)
    .then(() => {
      window.GrafanaFaroWebSdk.initializeFaro({
        url: faroUrl,
        app: {
          name: APP_NAME,
          version: APP_VERSION,
          environment: isLocalDev ? 'development' : 'production',
        },
      });
      return loadScript(SDK.tracing);
    })
    .then(() => {
      window.GrafanaFaroWebSdk.faro.instrumentations.add(
        new window.GrafanaFaroWebTracing.TracingInstrumentation()
      );
      window.GrafanaFaroWebSdk.faro.api.pushEvent('page_view', {
        page: window.location.pathname,
      });
    })
    .catch((err) => {
      // Never let telemetry init break the page.
      // eslint-disable-next-line no-console
      console.warn('Faro init failed:', err);
    });
})();
