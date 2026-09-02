import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { QueryPlacesDto } from "./query-places.dto";

describe("QueryPlacesDto", () => {
  it("accepts an empty query and applies defaults", async () => {
    const dto = plainToInstance(QueryPlacesDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe("featured");
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it("coerces page/limit query strings to numbers", async () => {
    const dto = plainToInstance(QueryPlacesDto, { page: "2", limit: "5" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(5);
  });

  it("rejects an unknown sort value", async () => {
    const dto = plainToInstance(QueryPlacesDto, { sort: "not-a-real-sort" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "sort")).toBe(true);
  });

  it("accepts the popular sort (Home's 'Discover this week')", async () => {
    const dto = plainToInstance(QueryPlacesDto, { sort: "popular" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe("popular");
  });

  it("rejects a limit above the max", async () => {
    const dto = plainToInstance(QueryPlacesDto, { limit: "999" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "limit")).toBe(true);
  });

  it("rejects an unknown place type", async () => {
    const dto = plainToInstance(QueryPlacesDto, { type: "spaceship" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });

  it("coerces priceMin/priceMax query strings to numbers", async () => {
    const dto = plainToInstance(QueryPlacesDto, {
      priceMin: "5",
      priceMax: "20",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.priceMin).toBe(5);
    expect(dto.priceMax).toBe(20);
  });

  it("rejects a negative priceMin/priceMax", async () => {
    const dto = plainToInstance(QueryPlacesDto, { priceMin: "-1" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "priceMin")).toBe(true);

    const dto2 = plainToInstance(QueryPlacesDto, { priceMax: "-1" });
    const errors2 = await validate(dto2);
    expect(errors2.some((e) => e.property === "priceMax")).toBe(true);
  });
});
