// Data access for the prototype.
// On GitHub Pages the data is fetched from ./data and ./img.
// In the single-file preview everything is embedded in window.__HANA_BUNDLE.
const B = typeof window !== 'undefined' ? window.__HANA_BUNDLE : null;
// cache busting: every build gets a new version, so browsers never reuse old screen data
const V = typeof __BUILD__ !== 'undefined' ? __BUILD__ : String(Date.now());
const IMG_RE = /img\/[0-9a-f]+\.(?:png|jpg|gif|webp|svg)/g;

function inlineImages(html) {
  if (!B || !html) return html;
  return html.replace(IMG_RE, (k) => B.img[k] || k);
}

export async function loadManifest() {
  if (B) return B.manifest;
  const r = await fetch('data/manifest.json?v=' + V, { cache: 'no-cache' });
  return r.json();
}

export async function loadGlyphs() {
  if (B) return B.glyphs;
  const r = await fetch('data/glyphs.svg?v=' + V);
  return r.text();
}

const cache = {};
export function loadScreen(file) {
  if (cache[file]) return cache[file];
  if (B) {
    const s = B.screens[file];
    cache[file] = Promise.resolve(s ? { ...s, html: inlineImages(s.html), fixed: inlineImages(s.fixed) } : null);
  } else {
    cache[file] = fetch(`data/screens/${file}.json?v=${V}`).then((r) => r.json());
  }
  return cache[file];
}
