import { ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  function buildController(query: jest.Mock) {
    const dataSource = { query } as unknown as DataSource;
    return new HealthController(dataSource);
  }

  describe("check (liveness)", () => {
    it("reports ok without touching the database", async () => {
      const query = jest.fn();
      const controller = buildController(query);

      const result = controller.check();

      expect(result.status).toBe("ok");
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe("ready (readiness)", () => {
    it("reports ok when the database responds", async () => {
      const query = jest.fn().mockResolvedValue([{ "?column?": 1 }]);
      const controller = buildController(query);

      const result = await controller.ready();

      expect(result.status).toBe("ok");
      expect(query).toHaveBeenCalledWith("SELECT 1");
    });

    it("throws a 503 when the database is unreachable", async () => {
      const query = jest
        .fn()
        .mockRejectedValue(new Error("connection refused"));
      const controller = buildController(query);

      await expect(controller.ready()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
