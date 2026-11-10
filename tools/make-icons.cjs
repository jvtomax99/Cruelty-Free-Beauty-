// Renders the app icons from assets/logo.svg. Run from the repo root: node tools/make-icons.cjs
// Home-screen icons are full squares (the phone rounds them); the maskable one
// shrinks the art so Android's circle crop never cuts the ears.
const { chromium } = require('playwright');
const fs = require('fs');
const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(fs.readFileSync('assets/logo.svg', 'utf8'));
const jobs = [
  ['assets/icons/icon-192.png', 192, .86], ['assets/icons/icon-512.png', 512, .86],
  ['assets/icons/icon-maskable-512.png', 512, .66], ['assets/icons/apple-touch-icon.png', 180, .84]
];
(async () => {
  const b = await chromium.launch();
  for (const [out, size, scale] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;
      background:radial-gradient(90% 90% at 70% 20%,#F6E4E0,#F0D2CE)"><img src="${svg}" style="width:${Math.round(size*scale)}px"></body>`);
    await p.screenshot({ path: out }); await p.close();
  }
  await b.close();
})();
