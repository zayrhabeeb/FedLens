/**
 * Generates manifest.json for each browser target from one definition.
 * Chrome uses a service worker + side panel; Firefox (MV3) uses background
 * scripts + sidebar_action and needs browser_specific_settings.
 */
import { FEED_HOSTS } from './shared/feeds';

export type BrowserTarget = 'chrome' | 'firefox';

export const FIREFOX_EXTENSION_ID = 'fedlens@zayrhabeeb.github.io';

const ICONS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
};

export function buildManifest(target: BrowserTarget, version: string): Record<string, unknown> {
  const hostPermissions = [
    'https://raw.githubusercontent.com/*',
    ...FEED_HOSTS.map((host) => `https://${host}/*`),
  ];
  const common = {
    manifest_version: 3,
    name: 'FedLens',
    short_name: 'FedLens',
    version,
    description:
      'Global macro intelligence: indicators, news radar, events, policy forecasts and comparisons for 12 economies. Free and keyless.',
    icons: ICONS,
    action: { default_title: 'Open FedLens', default_icon: ICONS },
    permissions: ['storage', 'unlimitedStorage', 'activeTab', 'scripting'],
    host_permissions: hostPermissions,
    // Requested at runtime only when the user analyses an arbitrary page or
    // configures an optional BYOK/local LLM endpoint.
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    content_security_policy: {
      // 'wasm-unsafe-eval' is required only for the optional on-device model (ONNX Runtime WASM).
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  };

  if (target === 'chrome') {
    return {
      ...common,
      minimum_chrome_version: '116',
      permissions: [...common.permissions, 'sidePanel'],
      background: { service_worker: 'background.js', type: 'module' },
      side_panel: { default_path: 'index.html' },
    };
  }

  return {
    ...common,
    background: { scripts: ['background.js'], type: 'module' },
    sidebar_action: {
      default_panel: 'index.html',
      default_title: 'FedLens',
      default_icon: ICONS,
      open_at_install: false,
    },
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_EXTENSION_ID,
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}
