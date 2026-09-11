import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OpeningHoursEntryDto } from "./pharmacy.dto";

describe("OpeningHoursEntryDto", () => {
  it("rejects an open day with no times — such a day can never satisfy the directory's openNow filter", async () => {
    const dto = plainToInstance(OpeningHoursEntryDto, {
      dayOfWeek: 1,
      isClosed: false,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "opensAt")).toBe(true);
    expect(errors.some((e) => e.property === "closesAt")).toBe(true);
  });

  it("rejects an open day with only one of the two times set", async () => {
    const dto = plainToInstance(OpeningHoursEntryDto, {
      dayOfWeek: 1,
      isClosed: false,
      opensAt: "08:00",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "opensAt")).toBe(false);
    expect(errors.some((e) => e.property === "closesAt")).toBe(true);
  });

  it("accepts an open day with both times set", async () => {
    const dto = plainToInstance(OpeningHoursEntryDto, {
      dayOfWeek: 1,
      isClosed: false,
      opensAt: "08:00",
      closesAt: "20:00",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("allows a closed day to omit both times", async () => {
    const dto = plainToInstance(OpeningHoursEntryDto, {
      dayOfWeek: 1,
      isClosed: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
