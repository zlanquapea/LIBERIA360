import { Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { initErrorTracking } from "./error-tracking";

jest.mock("@sentry/node");

describe("initErrorTracking", () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    (Sentry.init as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not call Sentry.init and warns when no DSN is set", () => {
    initErrorTracking("", "production");
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SENTRY_DSN"));
  });

  it("calls Sentry.init with the DSN and environment when configured", () => {
    initErrorTracking("https://key@sentry.example.com/1", "production");
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@sentry.example.com/1",
        environment: "production",
      }),
    );
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
