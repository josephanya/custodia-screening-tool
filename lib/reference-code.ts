const REFERENCE_CODE_PREFIX = "KYR-";
const REFERENCE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERENCE_CODE_GROUP_LENGTH = 4;
const REFERENCE_CODE_GROUPS = 2;
const REFERENCE_CODE_LENGTH = REFERENCE_CODE_GROUP_LENGTH * REFERENCE_CODE_GROUPS;
const LEGACY_REFERENCE_CODE_PREFIX = "CST-";
const LEGACY_REFERENCE_CODE_LENGTH_LONG = 12;
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

  const groups: string[] = [];

  for (let group = 0; group < REFERENCE_CODE_GROUPS; group += 1) {
    let code = "";

    for (let index = 0; index < REFERENCE_CODE_GROUP_LENGTH; index += 1) {
      code += REFERENCE_CODE_ALPHABET[bytes[group * REFERENCE_CODE_GROUP_LENGTH + index] & 31];
    }

    groups.push(code);
  }

  return `${REFERENCE_CODE_PREFIX}${groups.join("-")}`;
}

export function normalizeReferenceCode(input: string): string | null {
  const stripped = input
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/^KYR/, "");

  if (stripped.startsWith("CST")) {
    return normalizeLegacyReferenceCode(stripped.replace(/^CST/, ""));
  }

  if (stripped.length === LEGACY_REFERENCE_CODE_LENGTH) {
    const corrected = stripped.replace(/[ILOU]/g, (character) => AMBIGUOUS_CHARACTERS[character]);

    if (isFromAlphabet(corrected, LEGACY_REFERENCE_CODE_ALPHABET)) {
      return `${LEGACY_REFERENCE_CODE_PREFIX}${corrected}`;
    }
  }

  if (stripped.length !== REFERENCE_CODE_LENGTH) {
    return null;
  }

  if (!isFromAlphabet(stripped, REFERENCE_CODE_ALPHABET)) {
    return null;
  }

  return `${REFERENCE_CODE_PREFIX}${stripped.slice(0, REFERENCE_CODE_GROUP_LENGTH)}-${stripped.slice(REFERENCE_CODE_GROUP_LENGTH)}`;
}

function normalizeLegacyReferenceCode(stripped: string): string | null {
  if (stripped.length !== LEGACY_REFERENCE_CODE_LENGTH && stripped.length !== LEGACY_REFERENCE_CODE_LENGTH_LONG) {
    return null;
  }

  const corrected = stripped.replace(/[ILOU]/g, (character) => AMBIGUOUS_CHARACTERS[character]);

  return isFromAlphabet(corrected, LEGACY_REFERENCE_CODE_ALPHABET)
    ? `${LEGACY_REFERENCE_CODE_PREFIX}${corrected}`
    : null;
}

function isFromAlphabet(value: string, alphabet: string) {
  return value.split("").every((character) => alphabet.includes(character));
}
