export function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;

  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function retryAfterSeconds(now: Date, windowStart: Date, windowSeconds: number): number {
  const elapsedSeconds = Math.floor((now.getTime() - windowStart.getTime()) / 1000);

  return Math.max(1, windowSeconds - elapsedSeconds);
}
