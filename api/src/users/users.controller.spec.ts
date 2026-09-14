import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  function buildController(countActive: jest.Mock) {
    const usersService = { countActive } as unknown as UsersService;
    return new UsersController(usersService);
  }

  describe("getStats", () => {
    it("returns the active-user count as totalUsers", async () => {
      const countActive = jest.fn().mockResolvedValue(1234);
      const controller = buildController(countActive);

      const result = await controller.getStats();

      expect(result).toEqual({ totalUsers: 1234 });
      expect(countActive).toHaveBeenCalled();
    });
  });
});
