import { SearchService } from "./search.service";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { BusinessReviewStatus } from "../businesses/entities/business.enums";
import { EventReviewStatus } from "../events/entities/event.enums";

function makeQueryBuilder(rows: unknown[]) {
  const wheres: Array<{ sql: string; params: unknown }> = [];
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn(() => qb),
    where: jest.fn((sql: string, params: unknown) => {
      wheres.push({ sql, params });
      return qb;
    }),
    andWhere: jest.fn((sql: string, params: unknown) => {
      wheres.push({ sql, params });
      return qb;
    }),
    addSelect: jest.fn(() => qb),
    setParameter: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return { qb, wheres };
}

function repoWith(rows: unknown[]) {
  const { qb, wheres } = makeQueryBuilder(rows);
  return {
    repo: { createQueryBuilder: jest.fn(() => qb) },
    wheres,
  };
}

describe("SearchService", () => {
  it("returns everything empty for a query under the minimum length", async () => {
    const place = repoWith([]);
    const business = repoWith([]);
    const event = repoWith([]);
    const creator = repoWith([]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    const result = await service.suggest("a");

    expect(result).toEqual({
      query: "a",
      places: [],
      businesses: [],
      events: [],
      creators: [],
    });
    expect(place.repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("only matches approved places, mapped to a place suggestion", async () => {
    const place = repoWith([
      {
        id: "p1",
        slug: "robertsport",
        name: "Robertsport",
        images: ["/uploads/robertsport.jpg"],
        type: "nature_site",
        city: "Robertsport",
        county: { name: "Grand Cape Mount" },
      },
    ]);
    const business = repoWith([]);
    const event = repoWith([]);
    const creator = repoWith([]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    const result = await service.suggest("rob");

    expect(place.wheres[0]).toEqual({
      sql: "place.reviewStatus = :status",
      params: { status: PlaceReviewStatus.APPROVED },
    });
    expect(result.places).toEqual([
      {
        kind: "place",
        id: "p1",
        slug: "robertsport",
        name: "Robertsport",
        image: "/uploads/robertsport.jpg",
        type: "nature_site",
        city: "Robertsport",
        county: { name: "Grand Cape Mount" },
      },
    ]);
  });

  it("only matches approved businesses", async () => {
    const place = repoWith([]);
    const business = repoWith([
      {
        id: "b1",
        slug: "sunset-hotel",
        name: "Sunset Hotel",
        images: [],
        logoImage: "/uploads/logo.jpg",
        type: "hotel",
        linkedPlace: {
          city: "Robertsport",
          county: { name: "Grand Cape Mount" },
        },
      },
    ]);
    const event = repoWith([]);
    const creator = repoWith([]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    const result = await service.suggest("sunset");

    expect(business.wheres[0]).toEqual({
      sql: "business.reviewStatus = :status",
      params: { status: BusinessReviewStatus.APPROVED },
    });
    expect(result.businesses).toEqual([
      {
        kind: "business",
        id: "b1",
        slug: "sunset-hotel",
        name: "Sunset Hotel",
        image: "/uploads/logo.jpg",
        type: "hotel",
        city: "Robertsport",
        county: { name: "Grand Cape Mount" },
      },
    ]);
  });

  it("only matches approved events", async () => {
    const place = repoWith([]);
    const business = repoWith([]);
    const event = repoWith([
      {
        id: "e1",
        name: "Surf Festival",
        images: [],
        category: "festival",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: null,
        locationText: null,
        place: { name: "Robertsport Beach" },
        county: { name: "Grand Cape Mount" },
      },
    ]);
    const creator = repoWith([]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    const result = await service.suggest("surf");

    expect(event.wheres[0]).toEqual({
      sql: "event.reviewStatus = :status",
      params: { status: EventReviewStatus.APPROVED },
    });
    expect(result.events).toEqual([
      {
        kind: "event",
        id: "e1",
        name: "Surf Festival",
        image: null,
        category: "festival",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: null,
        locationText: null,
        place: { name: "Robertsport Beach" },
        county: { name: "Grand Cape Mount" },
      },
    ]);
  });

  it("matches creators by name or username with no review-status gate", async () => {
    const place = repoWith([]);
    const business = repoWith([]);
    const event = repoWith([]);
    const creator = repoWith([
      {
        id: "c1",
        username: "surfguide",
        name: "Surf Guide",
        profileImage: null,
        category: "tour_guide",
        county: { name: "Grand Cape Mount" },
      },
    ]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    const result = await service.suggest("surf");

    expect(creator.wheres[0]).toEqual({
      sql: "(creator.name ILIKE :contains OR creator.username ILIKE :contains)",
      params: { contains: "%surf%" },
    });
    expect(result.creators).toEqual([
      {
        kind: "creator",
        id: "c1",
        username: "surfguide",
        name: "Surf Guide",
        image: null,
        category: "tour_guide",
        county: { name: "Grand Cape Mount" },
      },
    ]);
  });

  it("escapes ILIKE wildcard characters in the query", async () => {
    const place = repoWith([]);
    const business = repoWith([]);
    const event = repoWith([]);
    const creator = repoWith([]);
    const service = new SearchService(
      place.repo as any,
      business.repo as any,
      event.repo as any,
      creator.repo as any,
    );

    await service.suggest("50%_off");

    expect(place.wheres[1]).toEqual({
      sql: "place.name ILIKE :contains",
      params: { contains: "%50\\%\\_off%" },
    });
  });
});
