// electron-builder afterPack hook.
// When no real signing certificate is configured, the packed macOS app is left with Electron's
// original (now invalid) signature, so downloaded copies show as "damaged". Re-sign it ad-hoc
// so macOS shows the normal "unidentified developer" prompt instead.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const realSigning = process.env.CSC_LINK || process.env.CSC_NAME || process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false';
  if (realSigning) return; // electron-builder will sign it properly

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing  app=${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
