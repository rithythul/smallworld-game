// The Small World planet: one round world, made from numbers, the same for every player.
// Distances are in world units (1 unit = 1 metre = 10 game px; x grows east, z grows south) with Small Town at 0,0.
// The planet is C units around. East-west wraps: walk far enough east and you come home from the west.
// North-south runs from the North Pole to the South Pole, so the climate follows latitude:
// snow at the poles, warm deserts and jungles near the equator, forests and meadows in between.
// Every noise here repeats exactly once around the planet, so there is no seam where the world wraps.
(function (root) {
  const C = 100000;                         // 100 km around
  const HOME_LAT = 30;                      // Small Town sits in the mild north
  const DEG = 360 / C;                      // degrees per unit, east-west and north-south
  const latOf = (z) => HOME_LAT - z * DEG;  // z grows south
  const zOfLat = (lat) => (HOME_LAT - lat) / DEG;
  const POLE_N = zOfLat(89.2), POLE_S = zOfLat(-89.2);   // you can walk right up to the poles
  const lonOf = (x) => { let l = (x * DEG) % 360; if (l > 180) l -= 360; if (l < -180) l += 360; return l; };
  const wrapX = (x) => x - Math.round(x / C) * C;         // the same place, in -C/2..C/2

  // value noise on a lattice that repeats every `per` cells east-west (per = C / wavelength, a whole number)
  const mod = (a, n) => ((a % n) + n) % n;
  function hash2(x, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z, per) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const x0 = mod(xi, per), x1 = mod(xi + 1, per);
    const a = hash2(x0, zi), b = hash2(x1, zi), c = hash2(x0, zi + 1), d = hash2(x1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // a few octaves; every wavelength divides C, so each octave wraps cleanly
  function fbm(x, z, wl, seed, oct = 3) {
    let s = 0, amp = 0.5, norm = 0, w = wl;
    for (let i = 0; i < oct; i++) {
      s += amp * vnoise(x / w + seed * 13.1, z / w + seed * 7.7 + i * 19.3, Math.round(C / w)); norm += amp;
      amp *= 0.5; w /= 2;
    }
    return s / norm;
  }
  const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

  // Towns keep the land around them dry: the region's rectangle (world units) gets a push towards land.
  let region = { x0: -150, x1: 150, z0: -170, z1: 150 };
  const setRegion = (r) => { region = r; };
  const regionDist = (x, z) => { const dx = Math.max(region.x0 - x, 0, x - region.x1), dz = Math.max(region.z0 - z, 0, z - region.z1); return Math.hypot(dx, dz); };

  const SEA = 0.47;
  // how much this spot is land (above SEA) or sea (below)
  function continent(x, z) {
    x = wrapX(x);
    let c = fbm(x, z, 12500, 1, 4) * 0.8 + fbm(x, z, 2500, 2, 2) * 0.2;
    c += 0.3 * Math.exp(-(regionDist(x, z) ** 2) / (2 * 2200 * 2200));   // home is always on land
    const lat = Math.abs(latOf(z)); if (lat > 78) c += (lat - 78) * 0.05;  // ice caps at the poles
    return c;
  }
  // mountain ranges: long bands where the hills get tall
  const ranges = (x, z) => smooth(0.58, 0.76, fbm(wrapX(x), z, 5000, 3, 3));

  // ground height and what kind of land, for one spot
  function sample(x, z) {
    const xw = wrapX(x), c = continent(xw, z), lat = latOf(z);
    if (c < SEA) {   // the sea: shallow near the coast, deep further out
      const deep = smooth(SEA, SEA - 0.08, c);
      return { h: -0.7 - deep * 7, ocean: true, biome: 'sea', lat, t: 0, m: 0, c };
    }
    const shore = smooth(SEA, SEA + 0.03, c);
    const mtn = ranges(xw, z);
    const bumps = Math.max(0, fbm(xw, z, 250, 4, 3) - 0.38) * (7 + 30 * mtn) + Math.max(0, fbm(xw, z, 50, 5, 2) - 0.5) * 1.4;
    const h = 0.15 + bumps * shore;
    let t = 1 - Math.abs(lat) / 90 + (fbm(xw, z, 1000, 6, 2) - 0.5) * 0.28 - h * 0.012;
    const m = fbm(xw, z, 1250, 7, 3);
    let biome;
    if (c < SEA + 0.012 && t > 0.3) biome = 'beach';
    else if (t < 0.26 || (h > 16 && t < 0.55)) biome = 'snow';
    else if (h > 11) biome = 'rock';
    else if (t < 0.4) biome = 'taiga';
    else if (t > 0.76 && m < 0.46) biome = 'desert';
    else if (t > 0.74 && m > 0.54) biome = 'jungle';
    else if (m > 0.58) biome = 'forest';
    else biome = 'meadow';
    return { h, ocean: false, biome, lat, t, m, c };
  }
  const BIOME = {
    meadow: { name: 'Meadows', icon: '🌼', ground: '#b4dc7a' },
    forest: { name: 'Forest', icon: '🌳', ground: '#93bf73' },
    taiga: { name: 'Pine Woods', icon: '🌲', ground: '#8fb38a' },
    snow: { name: 'Snowlands', icon: '❄️', ground: '#eef4fb' },
    rock: { name: 'Mountains', icon: '⛰️', ground: '#b9b1a6' },
    desert: { name: 'Desert', icon: '🌵', ground: '#ecd29a' },
    jungle: { name: 'Jungle', icon: '🌴', ground: '#76c064' },
    beach: { name: 'Beach', icon: '🏖️', ground: '#f1e2b3' },
    sea: { name: 'Ocean', icon: '🌊', ground: '#6fa8c4' },
  };
  // a compass direction, in words, from a to b (world units), the short way around the planet
  function heading(ax, az, bx, bz) {
    const dx = wrapX(bx - ax), dz = bz - az;
    const a = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    return { deg: a, word: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(a / 45) % 8], dist: Math.hypot(dx, dz) };
  }

  const Planet = { C, HOME_LAT, DEG, latOf, lonOf, zOfLat, POLE_N, POLE_S, wrapX, fbm, continent, sample, BIOME, SEA, setRegion, regionDist, heading, smooth };
  if (typeof module !== 'undefined' && module.exports) module.exports = Planet;
  else root.Planet = Planet;
})(typeof window !== 'undefined' ? window : globalThis);
