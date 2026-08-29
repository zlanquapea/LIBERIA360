import { ConfigService } from "@nestjs/config";
import { AssistantService } from "./assistant.service";
import type { AppConfig } from "../config/configuration";

function config(overrides: Partial<AppConfig["assistant"]> = {}) {
  const assistant: AppConfig["assistant"] = {
    apiKey: "",
    apiBase: "https://example.test/v1",
    model: "gpt-5-mini",
    ...overrides,
  };
  return {
    get: jest.fn((key: string) =>
      key === "assistant" ? assistant : undefined,
    ),
  } as unknown as ConfigService<AppConfig, true>;
}

describe("AssistantService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("answers advertising questions from approved knowledge when no AI key is configured", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How can I advertise my business?",
      currentPath: "/account",
    });

    expect(response.source).toBe("knowledge");
    expect(response.answer).toContain("My Ads");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ads", href: "/account/my-ads" }),
      ]),
    );
  });

  it("returns safe guidance for password and sensitive-information questions", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "Should I share my password or payment details here?",
    });

    expect(response.answer).toContain("Never share your password");
    expect(response.source).toBe("knowledge");
  });

  it("uses a structured GPT answer and removes action IDs outside the approved map", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answer: "Open My Ads to create and manage an advertisement.",
                  actionIds: ["ads", "malicious-external-link"],
                  followUps: ["Where will my ad appear?"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const service = new AssistantService(config({ apiKey: "test-key" }));

    const response = await service.ask({ message: "Help me advertise" });

    expect(response.source).toBe("ai");
    expect(response.actions).toEqual([
      expect.objectContaining({ id: "ads", href: "/account/my-ads" }),
    ]);
    expect(response.followUps).toEqual(["Where will my ad appear?"]);
  });

  it("falls back to approved knowledge when the AI provider is unavailable", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const service = new AssistantService(config({ apiKey: "test-key" }));

    const response = await service.ask({ message: "How do bookings work?" });

    expect(response.source).toBe("knowledge");
    expect(response.answer).toContain("booking");
  });
});
