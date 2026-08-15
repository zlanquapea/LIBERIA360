import { Test, TestingModule } from "@nestjs/testing";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";
import { QueryPlacesDto } from "./dto/query-places.dto";

describe("PlacesController", () => {
  let controller: PlacesController;
  let service: { findAll: jest.Mock; findBySlug: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn(), findBySlug: jest.fn() };

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
});
