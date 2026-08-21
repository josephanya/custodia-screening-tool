import { createScryptHash } from "../lib/password-hash";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run auth:hash -- <password>");
  process.exit(1);
}

console.log(createScryptHash(password));
