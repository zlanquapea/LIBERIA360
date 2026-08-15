import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      service: "liberia360-api",
      timestamp: new Date().toISOString(),
    };
  }
}
