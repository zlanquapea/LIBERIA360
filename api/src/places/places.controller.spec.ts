import { Test, TestingModule } from "@nestjs/testing";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";
import { QueryPlacesDto } from "./dto/query-places.dto";
import { User } from "../users/entities/user.entity";
import { PlaceType } from "./entities/place.enums";

describe("PlacesController", () => {
  let controller: PlacesController;
  let service: {
    findAll: jest.Mock;
    findBySlug: jest.Mock;
    submitPlace: jest.Mock;
    findMine: jest.Mock;
    updateMine: jest.Mock;
  };
  const user = { id: "user-1" } as User;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findBySlug: jest.fn(),
      submitPlace: jest.fn(),
      findMine: jest.fn(),
      updateMine: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [{ provide: PlacesService, useValue: service }],
    }).compile();

    controller = module.get(PlacesController);
  });

  it("delegates listing to PlacesService.findAll with the parsed query", async () => {
    const query: QueryPlacesDto = { sort: "name", page: 1, limit: 20 };
    const expected = {
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(query);

    expect(service.findAll).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it("delegates single-place lookup to PlacesService.findBySlug", async () => {
    const expected = { id: "1", slug: "test-beach", name: "Test Beach" };
    service.findBySlug.mockResolvedValue(expected);

    const result = await controller.findOne("test-beach");

    expect(service.findBySlug).toHaveBeenCalledWith("test-beach");
    expect(result).toBe(expected);
  });

  it("delegates self-service submission to PlacesService.submitPlace as the current user", async () => {
    const dto = {
      name: "Kpatawee Waterfall",
      description: "A scenic waterfall.",
      type: PlaceType.NATURE_SITE,
      categoryId: "category-1",
      countyId: "county-1",
      city: "Gbarnga",
      latitude: 6.9,
      longitude: -9.4,
    };
    const expected = { id: "place-1", ...dto };
    service.submitPlace.mockResolvedValue(expected);

    const result = await controller.submit(user, dto);

    expect(service.submitPlace).toHaveBeenCalledWith("user-1", dto);
    expect(result).toBe(expected);
  });

  it("delegates GET /places/mine to PlacesService.findMine as the current user", async () => {
    const expected = [{ id: "place-1" }];
    service.findMine.mockResolvedValue(expected);

    const result = await controller.mine(user);

    expect(service.findMine).toHaveBeenCalledWith("user-1");
    expect(result).toBe(expected);
  });

  it("delegates PATCH /places/:id to PlacesService.updateMine as the current user", async () => {
    const dto = { name: "New name" };
    const expected = { id: "place-1", name: "New name" };
    service.updateMine.mockResolvedValue(expected);

    const result = await controller.updateMine(user, "place-1", dto);

    expect(service.updateMine).toHaveBeenCalledWith("user-1", "place-1", dto);
    expect(result).toBe(expected);
  });
});
