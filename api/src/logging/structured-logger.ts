import { ConsoleLogger, LoggerService, LogLevel } from "@nestjs/common";

type Level = LogLevel | "fatal";

/**
 * One-JSON-object-per-line logging in production, so a real log
 * aggregator (CloudWatch, Datadog, whatever ends up in front of this) can
 * parse/query/filter log lines instead of grepping colored text meant for
 * a terminal. Delegates straight to Nest's own `ConsoleLogger` outside
 * production — local dev keeps today's human-readable, colored output
 * completely unchanged.
 *
 * Passed as the `logger` option to `NestFactory.create()` (not
 * `app.useLogger()` after the fact) so it's in effect for Nest's own
 * startup logs too (`RouterExplorer`'s "Mapped {...} route" lines, etc.) —
 * and because every `new Logger(context)` instance used throughout this
 * codebase (PushService, MailService, ...) delegates to whichever logger
 * was configured this way, this one change covers all of them.
 */
export class StructuredLogger implements LoggerService {
  private readonly devLogger = new ConsoleLogger();
  private readonly json: boolean;

  constructor(nodeEnv: string) {
    this.json = nodeEnv === "production";
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("log", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("verbose", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  private write(
    level: Level,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.json) {
      const method = this.devLogger[level as keyof ConsoleLogger] as (
        ...args: unknown[]
      ) => void;
      method?.call(this.devLogger, message, ...optionalParams);
      return;
    }

    // Nest's own internal calls (and every `new Logger(context)` call
    // site in this codebase) pass the logger "context" as the last
    // optional param, as a plain string — e.g. logger.warn("SMTP not
    // configured...", "MailService"). Pull it out into its own field
    // instead of dumping it into an undifferentiated `extra` array.
    const params = [...optionalParams];
    const context =
      typeof params[params.length - 1] === "string"
        ? (params.pop() as string)
        : undefined;

    const line = {
      level,
      message: typeof message === "string" ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      ...(params.length > 0 ? { extra: params } : {}),
    };

    const stream =
      level === "error" || level === "fatal" ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(line)}\n`);
  }
}
