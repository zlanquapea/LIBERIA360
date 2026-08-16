import { ConsoleLogger } from "@nestjs/common";
import { StructuredLogger } from "./structured-logger";

describe("StructuredLogger", () => {
  describe("outside production", () => {
    it("delegates to ConsoleLogger unchanged", () => {
      const delegateSpy = jest
        .spyOn(ConsoleLogger.prototype, "log")
        .mockImplementation();
      const logger = new StructuredLogger("development");

      logger.log("hello", "SomeContext");

      expect(delegateSpy).toHaveBeenCalledWith("hello", "SomeContext");
      delegateSpy.mockRestore();
    });
  });

  describe("in production", () => {
    let stdoutSpy: jest.SpyInstance;
    let stderrSpy: jest.SpyInstance;

    beforeEach(() => {
      stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("writes log/warn/debug/verbose as a single JSON line to stdout", () => {
      const logger = new StructuredLogger("production");
      logger.log("Server started", "Bootstrap");

      expect(stderrSpy).not.toHaveBeenCalled();
      const written = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(written).toMatchObject({
        level: "log",
        message: "Server started",
        context: "Bootstrap",
      });
      expect(typeof written.timestamp).toBe("string");
    });

    it("writes error/fatal to stderr, not stdout", () => {
      const logger = new StructuredLogger("production");
      logger.error("Something broke", "SomeService");

      expect(stdoutSpy).not.toHaveBeenCalled();
      const written = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(written).toMatchObject({
        level: "error",
        message: "Something broke",
        context: "SomeService",
      });
    });

    it("pulls a trailing string param out as `context` rather than dumping it into extra", () => {
      const logger = new StructuredLogger("production");
      logger.warn("SMTP not configured", "MailService");

      const written = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(written.context).toBe("MailService");
      expect(written.extra).toBeUndefined();
    });

    it("keeps non-context optional params under `extra`", () => {
      const logger = new StructuredLogger("production");
      logger.error("boom", { stack: "trace..." });

      const written = JSON.parse(stderrSpy.mock.calls[0][0] as string);
      expect(written.context).toBeUndefined();
      expect(written.extra).toEqual([{ stack: "trace..." }]);
    });

    it("stringifies a non-string message instead of writing [object Object]", () => {
      const logger = new StructuredLogger("production");
      logger.log({ event: "boot" });

      const written = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
      expect(written.message).toBe(JSON.stringify({ event: "boot" }));
    });
  });
});
