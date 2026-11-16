// Glicko-2 for a single game (each game is its own rating period).
// Knight Club rules on top of plain Glicko-2:
//   - rating change is capped at +/-50 per game while RD > 110 (provisional), +/-30 after
//   - RD is kept within [RD_MIN, RD_MAX]; rating never drops below R_FLOOR
export const DEFAULT_RATING = { r: 800, rd: 250, vol: 0.06, games: 0 };
export const PROVISIONAL_RD = 110;
const SCALE = 173.7178, TAU = 0.5, EPS = 1e-6;
const RD_MIN = 50, RD_MAX = 350, R_FLOOR = 100;

function g(phi) { return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI)); }

// a, b: {r, rd, vol}; score: 1 if a won, 0.5 draw, 0 lost (from a's point of view)
// returns new {r, rd, vol, delta} for a
export function update(a, b, score) {
  const mu = (a.r - 1500) / SCALE, phi = a.rd / SCALE, sigma = a.vol;
  const muj = (b.r - 1500) / SCALE, phij = b.rd / SCALE;
  const gj = g(phij);
  const E = 1 / (1 + Math.exp(-gj * (mu - muj)));
  const v = 1 / (gj * gj * E * (1 - E));
  const delta = v * gj * (score - E);
  // new volatility (Illinois algorithm, Glickman's paper step 5)
  const aa = Math.log(sigma * sigma);
  const f = x => {
    const ex = Math.exp(x);
    return ex * (delta * delta - phi * phi - v - ex) / (2 * Math.pow(phi * phi + v + ex, 2)) - (x - aa) / (TAU * TAU);
  };
  let A = aa, B;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(aa - k * TAU) < 0 && k < 100) k++; B = aa - k * TAU; }
  let fA = f(A), fB = f(B), iter = 0;
  while (Math.abs(B - A) > EPS && iter++ < 100) {
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const newVol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gj * (score - E);
  let r = SCALE * muNew + 1500;
  const cap = a.rd > PROVISIONAL_RD ? 50 : 30;
  let d = r - a.r;
  if (d > cap) d = cap; else if (d < -cap) d = -cap;
  r = Math.max(R_FLOOR, a.r + d);
  const rd = Math.min(RD_MAX, Math.max(RD_MIN, SCALE * phiNew));
  return { r, rd, vol: Math.min(0.2, Math.max(0.01, newVol)), delta: r - a.r };
}
