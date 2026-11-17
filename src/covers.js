// Official game artwork. Steam titles use the publisher's library capsule from the Steam CDN;
// VALORANT, Fortnite and Minecraft are not on Steam, so their tile is the official logo
// (from Wikimedia) on a dark background in the game's colour.
import apex from './assets/covers/apex.webp';
import cs2 from './assets/covers/cs2.webp';
import dota2 from './assets/covers/dota2.webp';
import fc26 from './assets/covers/fc26.webp';
import fortnite from './assets/covers/fortnite.webp';
import minecraft from './assets/covers/minecraft.webp';
import pubg from './assets/covers/pubg.webp';
import rust from './assets/covers/rust.webp';
import valorant from './assets/covers/valorant.webp';
import warzone from './assets/covers/warzone.webp';

export const COVERS = {
  cs2: { src: cs2, label: 'Counter-Strike 2' },
  valorant: { src: valorant, label: 'VALORANT' },
  fc26: { src: fc26, label: 'EA SPORTS FC 26' },
  dota2: { src: dota2, label: 'Dota 2' },
  warzone: { src: warzone, label: 'Call of Duty: Warzone' },
  apex: { src: apex, label: 'Apex Legends' },
  pubg: { src: pubg, label: 'PUBG: BATTLEGROUNDS' },
  fortnite: { src: fortnite, label: 'Fortnite' },
  rust: { src: rust, label: 'Rust' },
  minecraft: { src: minecraft, label: 'Minecraft' },
};

/** A built-in key, an uploaded data URL, or nothing (the card then draws its own pattern). */
export const coverSrc = (cover) => (typeof cover === 'string' && cover.startsWith('data:image/') ? cover : COVERS[cover]?.src ?? null);

/** Best built-in cover for a game name typed by an admin, e.g. "CS2" → cs2. */
export function guessCover(name = '') {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hints = { cs2: ['counterstrike', 'cs2', 'csgo'], valorant: ['valorant'], fc26: ['fc26', 'eafc', 'fifa'], dota2: ['dota'], warzone: ['warzone', 'callofduty', 'cod'], apex: ['apex'], pubg: ['pubg', 'battlegrounds'], fortnite: ['fortnite'], rust: ['rust'], minecraft: ['minecraft'] };
  return Object.entries(hints).find(([, hs]) => hs.some((h) => n.includes(h)))?.[0] ?? '';
}

/** Shrinks an uploaded image to a 400×600 WebP data URL so it fits in browser storage. */
export function fileToCover(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) return reject(new Error('فقط فایل تصویر (PNG، JPG، WebP) قبول می‌شه.'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('حجم تصویر باید کمتر از ۸ مگابایت باشه.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const W = 400, H = 600;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const k = Math.max(W / img.width, H / img.height);
      const w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      const out = c.toDataURL('image/webp', 0.78);
      resolve(out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('این فایل باز نشد؛ یه تصویر دیگه امتحان کن.')); };
    img.src = url;
  });
}
