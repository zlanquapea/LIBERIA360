import {
  ArgumentsHost,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { SentryExceptionsFilter } from "./sentry-exceptions.filter";

jest.mock("@sentry/node");

function buildHost() {
  return {
    getArgByIndex: jest.fn().mockReturnValue({}),
  } as unknown as ArgumentsHost;
}

describe("SentryExceptionsFilter", () => {
  let httpAdapter: {
    isHeadersSent: jest.Mock;
    reply: jest.Mock;
    end: jest.Mock;
  };
  let filter: SentryExceptionsFilter;

  beforeEach(() => {
    httpAdapter = {
      isHeadersSent: jest.fn().mockReturnValue(false),
      reply: jest.fn(),
      end: jest.fn(),
    };
    // BaseExceptionFilter's constructor just stashes whatever's passed as
    // this.applicationRef — a minimal adapter stub covering the three
    // methods catch()/handleUnknownError() actually call is enough.
    filter = new SentryExceptionsFilter(httpAdapter as never);
    (Sentry.captureException as jest.Mock).mockClear();
  });

  it("does not report an expected 4xx HttpException (still replies normally)", () => {
    filter.catch(new NotFoundException("nope"), buildHost());
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalled();
  });

  it("reports a 5xx HttpException", () => {
    const exception = new InternalServerErrorException("boom");
    filter.catch(exception, buildHost());
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    expect(httpAdapter.reply).toHaveBeenCalled();
  });

  it("reports a non-HttpException (an unhandled bug, not an intentional throw)", () => {
    const exception = new Error("unexpected");
    filter.catch(exception, buildHost());
    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    expect(httpAdapter.reply).toHaveBeenCalled();
  });

  it("does not report a boundary case one step below 500 (499)", () => {
    const exception = new HttpException("client-ish", 499);
    filter.catch(exception, buildHost());
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
