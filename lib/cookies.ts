const HOST_PREFIX = "__Host-";

export const assessmentSessionMaxAgeSeconds = 60 * 60 * 24;

export const nurseSessionMaxAgeSeconds = 60 * 60 * 8;

export function isSecureDeployment() {
  return process.env.NODE_ENV === "production";
}

export function assessmentSessionCookieName() {
  return prefixed("custodia_assessment_session");
}

export function nurseSessionCookieName() {
  return prefixed("custodia_nurse_session");
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: isSecureDeployment(),
  } as const;
}

function prefixed(name: string) {
  return isSecureDeployment() ? `${HOST_PREFIX}${name}` : name;
}
