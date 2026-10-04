import { assertGuideDate, defaultAvailability } from "./availability";
import { GuidesService } from "./guides.service";

const today = "2026-10-04";

it("rejects impossible, past, blocked and non-working dates", () => {
  const schedule = {
    ...defaultAvailability,
    enabled: true,
    weekdays: [1],
    blockedDates: ["2026-10-12"],
  };
  for (const date of ["2026-02-31", "2026-10-03", "2026-10-04", "2026-10-12"])
    expect(() => assertGuideDate(date, schedule, [], today)).toThrow();
  expect(() =>
    assertGuideDate("2026-10-05", schedule, [], today),
  ).not.toThrow();
  expect(() =>
    assertGuideDate("2026-10-05", schedule, ["2026-10-05"], today),
  ).toThrow();
});

it("keeps unscheduled guides request-based but excludes confirmed dates", () => {
  expect(() =>
    assertGuideDate("2026-10-06", defaultAvailability, [], today),
  ).not.toThrow();
  expect(() =>
    assertGuideDate("2026-10-06", defaultAvailability, ["2026-10-06"], today),
  ).toThrow();
});

it("checks for a competing confirmed booking inside the guide lock", async () => {
  const booking = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    status: "requested",
    requestedDate: "2099-10-05",
    experience: { guide: { id: "guide", userId: "owner" } },
  };
  const repo = {
    findOne: jest.fn().mockResolvedValue(booking),
    findOneOrFail: jest.fn().mockResolvedValue(booking),
    save: jest.fn(),
  };
  const guideRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: "guide", availability: defaultAvailability }),
  };
  const manager = {
    getRepository: jest
      .fn()
      .mockReturnValueOnce(repo)
      .mockReturnValueOnce(guideRepo),
    query: jest.fn().mockResolvedValue([{ id: "another-confirmed-booking" }]),
  };
  const service = new GuidesService(
    {} as never,
    {} as never,
    {
      manager: {
        transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { assertCanContact: jest.fn().mockResolvedValue(undefined) } as never,
  );
  await expect(
    service.respond("owner", booking.id, { status: "confirmed" } as never),
  ).rejects.toThrow("unavailable");
  expect(guideRepo.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ lock: { mode: "pessimistic_write" } }),
  );
  expect(repo.save).not.toHaveBeenCalled();
});
