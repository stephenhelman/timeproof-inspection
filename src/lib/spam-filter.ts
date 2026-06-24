// Lightweight, dependency-free heuristics for filtering automated form spam.
// Used by public lead-capture endpoints (contact form, etc.). The honeypot check
// is the primary defense; these heuristics catch the obvious bot payloads that
// honeypot-aware bots still send (random high-entropy strings, lettered phones).

// Returns true when a value looks like a random machine-generated token rather
// than a real name or place. Tuned against observed spam such as
// "HcIqmPlGKCDrlWtyAFgjpY" and "jrNUcXeWoynEDkiOmS": single tokens, no spaces,
// erratic capitalization, and an unnaturally low vowel ratio.
export function looksLikeGibberish(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (s.length < 8) return false; // short values can be legitimate
  if (/\s/.test(s)) return false; // real names and places contain spaces

  const letters = s.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 8) return false;

  const vowels = (letters.match(/[aeiouAEIOU]/g) ?? []).length;
  const vowelRatio = vowels / letters.length;
  if (vowelRatio < 0.25) return true; // almost no vowels: not a real word

  // A long run of consonants is a strong gibberish signal.
  if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(s)) return true;

  // Frequent case flips inside one token (HcIqmPlGK...) are a random-generator
  // signature; real names do not alternate case mid-word.
  let flips = 0;
  for (let i = 1; i < letters.length; i++) {
    const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase();
    const curUpper = letters[i] === letters[i].toUpperCase();
    if (prevUpper !== curUpper) flips++;
  }
  if (letters.length >= 12 && flips / letters.length > 0.5) return true;

  return false;
}

// Returns true when a phone string is plausibly a real phone number.
// Rejects anything containing letters (observed spam used "WxPGSXABreMnVjEf")
// and anything without a sane count of digits.
export function isPlausiblePhone(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s) return false;
  if (/[a-zA-Z]/.test(s)) return false; // phones never contain letters
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

// Returns true for a syntactically plausible email address.
export function isPlausibleEmail(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
