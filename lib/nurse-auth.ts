import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { nurseSessionCookieName, nurseSessionMaxAgeSeconds, sessionCookieOptions } from "@/lib/cookies";
import { safeEquals, verifyScryptHash } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";

const SESSION_TOKEN_BYTES = 32;
const LAST_SEEN_REFRESH_MS = 60 * 1000;

export type NurseSession = {
  id: string;
  expiresAt: Date;
};

export function isNurseAuthConfigured() {
  return Boolean(process.env.NURSE_DASHBOARD_PASSWORD_HASH ?? process.env.NURSE_DASHBOARD_PASSWORD);
}

export function verifyNursePassword(password: string) {
  const configuredHash = process.env.NURSE_DASHBOARD_PASSWORD_HASH;

  if (configuredHash) {
    return verifyScryptHash(password, configuredHash);
  }

  const configuredPassword = process.env.NURSE_DASHBOARD_PASSWORD;

  if (!configuredPassword) {
    return false;
  }

  return safeEquals(password, configuredPassword);
}

export async function startNurseSession(context: { ipHash: string; userAgent: string | null }) {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const session = await prisma.nurseSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + nurseSessionMaxAgeSeconds * 1000),
      ipHash: context.ipHash,
      userAgent: context.userAgent,
    },
  });
  const cookieStore = await cookies();

  cookieStore.set(nurseSessionCookieName(), token, sessionCookieOptions(nurseSessionMaxAgeSeconds));

  return session;
}

export async function readNurseSession(): Promise<NurseSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(nurseSessionCookieName())?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.nurseSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, expiresAt: true, revokedAt: true, lastSeenAt: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    await prisma.nurseSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return { id: session.id, expiresAt: session.expiresAt };
}

export async function revokeNurseSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(nurseSessionCookieName())?.value;

  cookieStore.set(nurseSessionCookieName(), "", { ...sessionCookieOptions(0), maxAge: 0 });

  if (!token) {
    return false;
  }

  const { count } = await prisma.nurseSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return count > 0;
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
