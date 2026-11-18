// Official game artwork. Steam titles use the publisher's library capsule from the Steam CDN;
// VALORANT, Fortnite and Minecraft are not on Steam, so their tile is the official logo
// (from Wikimedia) on a dark background in the game's colour.
import apex from './assets/covers/apex.webp';
import apexSm from './assets/covers/apex-sm.webp';
import cs2 from './assets/covers/cs2.webp';
import cs2Sm from './assets/covers/cs2-sm.webp';
import dota2 from './assets/covers/dota2.webp';
import dota2Sm from './assets/covers/dota2-sm.webp';
import fc26 from './assets/covers/fc26.webp';
import fc26Sm from './assets/covers/fc26-sm.webp';
import fortnite from './assets/covers/fortnite.webp';
import fortniteSm from './assets/covers/fortnite-sm.webp';
import minecraft from './assets/covers/minecraft.webp';
import minecraftSm from './assets/covers/minecraft-sm.webp';
import pubg from './assets/covers/pubg.webp';
import pubgSm from './assets/covers/pubg-sm.webp';
import rust from './assets/covers/rust.webp';
import rustSm from './assets/covers/rust-sm.webp';
import valorant from './assets/covers/valorant.webp';
import valorantSm from './assets/covers/valorant-sm.webp';
import warzone from './assets/covers/warzone.webp';
import warzoneSm from './assets/covers/warzone-sm.webp';

export const COVERS = {
  cs2: { src: cs2, sm: cs2Sm, label: 'Counter-Strike 2' },
  valorant: { src: valorant, sm: valorantSm, label: 'VALORANT' },
  fc26: { src: fc26, sm: fc26Sm, label: 'EA SPORTS FC 26' },
  dota2: { src: dota2, sm: dota2Sm, label: 'Dota 2' },
  warzone: { src: warzone, sm: warzoneSm, label: 'Call of Duty: Warzone' },
  apex: { src: apex, sm: apexSm, label: 'Apex Legends' },
  pubg: { src: pubg, sm: pubgSm, label: 'PUBG: BATTLEGROUNDS' },
  fortnite: { src: fortnite, sm: fortniteSm, label: 'Fortnite' },
  rust: { src: rust, sm: rustSm, label: 'Rust' },
  minecraft: { src: minecraft, sm: minecraftSm, label: 'Minecraft' },
};

/** A built-in key, an uploaded data URL, or nothing (the card then draws its own pattern). */
export const coverSrc = (cover) => (typeof cover === 'string' && cover.startsWith('data:image/') ? cover : COVERS[cover]?.src ?? null);
/** 200×300 version for thumbnails; uploaded covers have only one size. */
export const coverThumb = (cover) => (typeof cover === 'string' && cover.startsWith('data:image/') ? cover : COVERS[cover]?.sm ?? null);
/** srcset for a built-in cover (200w + 400w), so phones and small cards fetch the small file. */
export const coverSet = (cover) => (COVERS[cover] ? `${COVERS[cover].sm} 200w, ${COVERS[cover].src} 400w` : undefined);

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
