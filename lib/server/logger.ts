type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, string | number | boolean | null | undefined>;

function writeLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const sanitizedFields = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    orderId: null,
    gatewayPaymentId: null,
    status: null,
    requestId: null,
    latencyMs: null,
    source: "application",
    ...sanitizedFields,
  });
  const stream = level === "info" ? process.stdout : process.stderr;
  stream.write(`${entry}\n`);
}

export const logger = {
  info(event: string, fields?: LogFields) {
    writeLog("info", event, fields);
  },
  warn(event: string, fields?: LogFields) {
    writeLog("warn", event, fields);
  },
  error(event: string, fields?: LogFields) {
    writeLog("error", event, fields);
  },
};
