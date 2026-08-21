type LogFields = Record<string, unknown>;

export function logEvent(event: string, fields: LogFields = {}) {
  write("info", event, fields);
}

export function logWarning(event: string, fields: LogFields = {}) {
  write("warn", event, fields);
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  write("error", event, {
    ...fields,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function write(level: "info" | "warn" | "error", event: string, fields: LogFields) {
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}
