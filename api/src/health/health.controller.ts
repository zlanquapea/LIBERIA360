import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ApiExcludeController } from "@nestjs/swagger";

// Ops/orchestrator probes, not a resource a real API consumer reads docs
// for — left out of the generated OpenAPI doc (GET /api/docs) entirely.
@ApiExcludeController()
@Controller("health")
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Liveness — "is the process up and responding at all". Deliberately
  // doesn't touch the DB: a liveness probe that depends on the database
  // means a DB blip gets an orchestrator to kill and restart a perfectly
  // healthy process, which doesn't fix the DB and just adds churn.
  @Get()
  check() {
    return {
      status: "ok",
      service: "liberia360-api",
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness — "is this instance actually able to serve a real request
  // right now". Distinct from liveness on purpose: right after a fresh
  // deploy (DB pool still connecting, migrations still running against a
  // cold instance) the process is alive but shouldn't have traffic routed
  // to it yet — that's exactly what a readiness probe is for. Returns 503
  // (not a caught/hidden error) so a load balancer or orchestrator's
  // readiness check fails the way it's supposed to.
  @Get("ready")
  async ready() {
    try {
      await this.dataSource.query("SELECT 1");
    } catch (error) {
      throw new ServiceUnavailableException(
        `Database is not reachable: ${(error as Error).message}`,
      );
    }
    return {
      status: "ok",
      service: "liberia360-api",
      timestamp: new Date().toISOString(),
    };
  }
}
