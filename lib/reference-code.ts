const REFERENCE_CODE_PREFIX = "CST-";
const REFERENCE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REFERENCE_CODE_LENGTH = 12;
const LEGACY_REFERENCE_CODE_LENGTH = 8;
const LEGACY_REFERENCE_CODE_ALPHABET = "0123456789ABCDEF";

const AMBIGUOUS_CHARACTERS: Record<string, string> = {
  I: "1",
  L: "1",
  O: "0",
  U: "V",
};

export function createReferenceCode(): string {
  const bytes = new Uint8Array(REFERENCE_CODE_LENGTH);

  crypto.getRandomValues(bytes);

  let code = "";

  for (const byte of bytes) {
    code += REFERENCE_CODE_ALPHABET[byte & 31];
  }

  return `${REFERENCE_CODE_PREFIX}${code}`;
}

export function normalizeReferenceCode(input: string): string | null {
  const stripped = input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/^CST/, "");

  if (stripped.length === LEGACY_REFERENCE_CODE_LENGTH) {
    return isFromAlphabet(stripped, LEGACY_REFERENCE_CODE_ALPHABET)
      ? `${REFERENCE_CODE_PREFIX}${stripped}`
      : null;
  }

  if (stripped.length !== REFERENCE_CODE_LENGTH) {
    return null;
  }

  const corrected = stripped.replace(/[ILOU]/g, (character) => AMBIGUOUS_CHARACTERS[character]);

  return isFromAlphabet(corrected, REFERENCE_CODE_ALPHABET)
    ? `${REFERENCE_CODE_PREFIX}${corrected}`
    : null;
}

function isFromAlphabet(value: string, alphabet: string) {
  return value.split("").every((character) => alphabet.includes(character));
}
