// Renders the app + tray icons from SVG using Electron itself (no extra tooling).
//   npx electron scripts/make-icons.js
// Writes build/icon.png (1024², used by electron-builder for .icns/.ico/linux) and assets/tray*.png.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Big app icon: dark squircle, radar rings, gradient sweep, amber "blip".
const appIcon = (s) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d2030"/><stop offset="1" stop-color="#0a0b10"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#66d9ff" stop-opacity=".22"/><stop offset="1" stop-color="#66d9ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7b7cff" stop-opacity="0"/><stop offset="1" stop-color="#66d9ff" stop-opacity=".85"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="190" fill="url(#bg)"/>
  <rect x="101.5" y="101.5" width="821" height="821" rx="188.5" fill="none" stroke="url(#edge)" stroke-width="3"/>
  <circle cx="512" cy="512" r="330" fill="url(#glow)"/>
  <g fill="none" stroke="#66d9ff" stroke-opacity=".28" stroke-width="10">
    <circle cx="512" cy="512" r="300"/><circle cx="512" cy="512" r="200"/><circle cx="512" cy="512" r="100"/>
  </g>
  <path d="M512 512 L512 212 A300 300 0 0 1 772 362 Z" fill="url(#sweep)" opacity=".9"/>
  <line x1="512" y1="512" x2="772" y2="362" stroke="#bff1ff" stroke-width="12" stroke-linecap="round"/>
  <circle cx="512" cy="512" r="30" fill="#e8fbff"/>
  <circle cx="650" cy="300" r="34" fill="#ffb84d"/>
  <circle cx="650" cy="300" r="62" fill="none" stroke="#ffb84d" stroke-opacity=".45" stroke-width="10"/>
</svg>`;

// Tray glyph: monochrome rings + sweep (template image on macOS, light on Windows/Linux).
const trayIcon = (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 32 32">
  <g fill="none" stroke="${color}" stroke-width="2.4"><circle cx="16" cy="16" r="12.5"/><circle cx="16" cy="16" r="6.5" stroke-opacity=".6"/></g>
  <path d="M16 16 L16 3.5 A12.5 12.5 0 0 1 26.8 9.7 Z" fill="${color}" fill-opacity=".85"/>
  <circle cx="16" cy="16" r="2.4" fill="${color}"/>
</svg>`;

async function render(svg, size, file, canvas = Math.max(size, 256)) {
  const win = new BrowserWindow({ width: canvas, height: canvas, show: false, transparent: true, frame: false,
    webPreferences: { offscreen: true }, useContentSize: true });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 150));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: canvas, height: canvas });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, img.resize({ width: size, height: size }).toPNG());
  win.destroy();
  console.log('wrote', path.relative(ROOT, file));
}

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {}); // keep running between renders
app.whenReady().then(async () => {
  process.on('unhandledRejection', (e) => { console.error(e); app.exit(1); });
  await render(appIcon(1024), 1024, path.join(ROOT, 'build', 'icon.png'));
  await render(trayIcon('#000'), 16, path.join(ROOT, 'assets', 'trayTemplate.png'));
  await render(trayIcon('#000'), 32, path.join(ROOT, 'assets', 'trayTemplate@2x.png'));
  await render(trayIcon('#f4f4f6'), 32, path.join(ROOT, 'assets', 'tray.png'));
  await render(trayIcon('#f4f4f6'), 64, path.join(ROOT, 'assets', 'tray@2x.png'));
  app.quit();
});
