/* Files go directly to the browser's download manager. Never fetch an APK/ZIP
 * into browser memory or claim that the website can observe its completion. */
(() => {
  'use strict';
  const api = 'https://api.github.com/repos/DevSidh/Ram-Prasad-Kirana-/releases/latest';
  const prefix = '/DevSidh/Ram-Prasad-Kirana-/releases/download/';
  const status = document.getElementById('release-status');
  const refresh = document.getElementById('refresh-release');
  const dialog = document.getElementById('download-help');
  const cacheKey = 'faststore-public-release-v3.3.4';
  let refreshing = false;

  function officialAsset(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname === 'github.com' &&
        !parsed.username && !parsed.password && !parsed.port && parsed.pathname.startsWith(prefix);
    } catch { return false; }
  }

  const links = Array.from(document.querySelectorAll('a[href]')).filter(link =>
    officialAsset(link.href) && /\.(apk|zip)$/i.test(new URL(link.href).pathname));
  links.forEach(link => {
    link.dataset.downloadPlatform = /\.apk$/i.test(new URL(link.href).pathname) ? 'android' : 'windows';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  function applyRelease(release) {
    if (!release || release.draft !== false || release.prerelease !== false ||
        !/^v?\d+\.\d+\.\d+(?:\+\d+)?$/.test(release.tag_name) || !Array.isArray(release.assets)) {
      throw new Error('No published stable release');
    }
    const version = release.tag_name.replace(/^v/, '');
    const assets = release.assets.filter(asset => typeof asset.name === 'string' &&
      Number.isSafeInteger(asset.size) && asset.size > 0 && officialAsset(asset.browser_download_url) &&
      new URL(asset.browser_download_url).pathname.startsWith(`${prefix}${release.tag_name}/`));
    const apk = assets.find(asset => /\.apk$/i.test(asset.name));
    const windows = assets.find(asset => /windows.*\.zip$/i.test(asset.name));
    if (!apk && !windows) throw new Error('No downloadable app assets');
    for (const [platform, asset] of [['android', apk], ['windows', windows]]) {
      if (!asset) continue; // Keep the known working link for this platform.
      const mb = `${(asset.size / 1024 / 1024).toFixed(1)} MB`;
      links.filter(link => link.dataset.downloadPlatform === platform).forEach(link => {
        link.href = asset.browser_download_url;
        link.setAttribute('aria-label', `Download ${platform === 'android' ? 'Android APK' : 'Windows ZIP'}, version ${version}, ${mb}`);
      });
    }
    if (apk) document.querySelectorAll('.subnote, #downloads .download p').forEach(element => {
      element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/Version\s+\d+\.\d+\.\d+(?:\+\d+)?/, `Version ${version}`);
      });
    });
    const descriptions = [];
    if (apk) descriptions.push(`Android ${version} · ${(apk.size / 1024 / 1024).toFixed(1)} MB`);
    if (windows) descriptions.push(`Windows ${version} · ${(windows.size / 1024 / 1024).toFixed(1)} MB`);
    status.textContent = `${descriptions.join(' | ')}. ${!apk || !windows ? 'The other platform uses its last published download link. ' : ''}Your browser manages the download.`;
  }

  async function loadLatest(force = false) {
    if (refreshing) return;
    refreshing = true;
    refresh.disabled = true;
    try {
      if (!force) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
          if (cached && Date.now() >= cached.time && Date.now() - cached.time < 15 * 60 * 1000) {
            applyRelease(cached.release);
            return;
          }
        } catch { /* Blocked storage must not block downloads. */ }
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let release;
      try {
        const response = await fetch(api, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/vnd.github+json' }, cache: force ? 'reload' : 'default' });
        if (!response.ok) throw new Error(`Release check returned ${response.status}`);
        release = await response.json();
      } finally { clearTimeout(timeout); }
      applyRelease(release);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), release })); } catch { /* Optional cache. */ }
    } catch {
      status.textContent = 'Could not check the latest release right now. The existing official download links still work. Retry the check or open GitHub releases.';
    } finally {
      refreshing = false;
      refresh.disabled = false;
    }
  }

  links.forEach(link => link.addEventListener('click', () => {
    const android = link.dataset.downloadPlatform === 'android';
    document.getElementById('download-instructions').textContent = android
      ? 'Android: after the APK finishes, open Files → Downloads and tap it. Choose Update; do not uninstall FastStore. Allow installation from your browser only if Android asks. If a Samsung message names Auto Blocker, use the Auto Blocker guide in Download & installation help. The app cannot change phone security settings.'
      : 'Windows: after the ZIP finishes, extract the whole folder, then open RamPrasadBilling.exe. Keep all included files together and preserve your store records.';
    document.getElementById('download-retry').href = link.href;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    // Do not preventDefault: the browser receives the original GitHub asset URL.
  }));
  document.querySelectorAll('.download-close, .download-close-button').forEach(button =>
    button.addEventListener('click', () => dialog.close()));
  refresh.addEventListener('click', () => loadLatest(true));
  loadLatest();
})();
