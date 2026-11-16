// Display-name sanitizing. Knight Club is used by kids, so names are short, plain and filtered.
// SUB words are rejected anywhere in the name; WORD words only as a whole word (avoids
// false positives such as "skill", "Sadie" or "scrap").
const SUB = ['fuck', 'fuk', 'shit', 'bitch', 'cunt', 'pussy', 'penis', 'vagina', 'porn', 'nigg', 'whore',
  'slut', 'dildo', 'jizz', 'asshole', 'retard', 'hitler', 'wank', 'twat', 'faggot', 'boner'];
const WORD = ['dick', 'cock', 'sex', 'sexy', 'nude', 'naked', 'rape', 'fag', 'kkk', 'bastard', 'damn', 'crap',
  'piss', 'arse', 'ass', 'cum', 'anal', 'kill', 'die', 'hate', 'stupid', 'idiot', 'dumb', 'loser', 'poop',
  'tits', 'boob', 'boobs', 'nazi', 'butt', 'balls', 'weed', 'drugs'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's' };

const deleet = s => s.toLowerCase().replace(/[0-9@$]/g, c => LEET[c] || '');
const squeeze = s => s.replace(/(.)\1+/g, '$1'); // "fuuuck" -> "fuck"

export function isClean(name) {
  const flat = deleet(name).replace(/[^a-z]/g, '');
  if (SUB.some(w => flat.includes(w) || squeeze(flat).includes(w))) return false;
  // whole words: split on separators and on lower->Upper camel case boundaries
  const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_-]+/).map(w => deleet(w).replace(/[^a-z]/g, ''));
  if (words.some(w => WORD.includes(w) || WORD.includes(squeeze(w)))) return false;
  return true;
}

// returns a clean name or null
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z0-9 _-]{2,20}$/.test(name)) return null;
  if (!/[A-Za-z0-9]/.test(name)) return null;
  if (!isClean(name)) return null;
  return name;
}
