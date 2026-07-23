/**
 * Faro Web SDK initializer for the michaellamb.dev landing page.
 * Adapted from grafana-faro-proxy/client/faro-init.js.
 *
 * Telemetry routes through grafana.michaellamb.dev as the `landing` app
 * (LANDING_INGEST_TOKEN in grafana-faro-proxy). SDK versions are pinned to
 * a minor range so upstream majors can't silently break production.
 */
(function () {
  const APP_NAME = 'landing';
  const APP_VERSION = '1.0.0';
  const PROXY_ORIGIN = 'https://grafana.michaellamb.dev';
  const SDK_VERSION = '^1.4.0';

  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const faroUrl = isLocalDev
    ? `http://localhost:8787/faro-proxy?app=${APP_NAME}`
    : `${PROXY_ORIGIN}/faro-proxy?app=${APP_NAME}`;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  loadScript(`https://unpkg.com/@grafana/faro-web-sdk@${SDK_VERSION}/dist/bundle/faro-web-sdk.iife.js`)
    .then(() => {
      window.GrafanaFaroWebSdk.initializeFaro({
        url: faroUrl,
        app: {
          name: APP_NAME,
          version: APP_VERSION,
          environment: isLocalDev ? 'development' : 'production',
        },
      });
      return loadScript(
        `https://unpkg.com/@grafana/faro-web-tracing@${SDK_VERSION}/dist/bundle/faro-web-tracing.iife.js`
      );
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
