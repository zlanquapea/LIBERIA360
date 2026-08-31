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

  it("routes general car-rental questions to the focused renting guidance", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How do car rentals work?",
      currentPath: "/car-rentals",
    });

    expect(response.source).toBe("knowledge");
    expect(response.answer).toContain("To rent a car");
    expect(response.answer).toContain("Select Request to book");
    expect(response.answer).toContain("no payment is taken");
    expect(response.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "carRentals", href: "/car-rentals" }),
        expect.objectContaining({ id: "bookings", href: "/account/bookings" }),
      ]),
    );
  });

  it("routes hourly car-rental questions to the focused hourly guidance", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "Can I rent a car by the hour with a driver?",
    });

    expect(response.answer).toContain("hourly rental is available");
    expect(response.answer).toContain("choose By hour");
    expect(response.answer).not.toContain("peer-to-peer marketplace");
  });

  it("routes car-listing questions to owner instructions", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How do I list my car?",
    });

    expect(response.answer).toContain("open My Car Listings");
    expect(response.answer).toContain("You do not need a business");
    expect(response.answer).toContain("Submit the listing for review");
  });

  it("routes driver-option questions to driver guidance", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "Can I rent a car with a driver?",
    });

    expect(response.answer).toContain(
      "Some car listings offer a driver option",
    );
    expect(response.answer).toContain("additional driver fee");
    expect(response.answer).not.toContain("peer-to-peer marketplace");
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

    const response = await service.ask({
      message: "Can you explain the ad dashboard?",
    });

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

  it("answers creator-photo change questions directly", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How do I change my creator photo?",
    });

    expect(response.answer).toContain("photo action menu");
    expect(response.answer).toContain("adjust zoom and position");
    expect(response.answer).not.toContain(
      "The Creators area helps people discover",
    );
  });

  it("answers creator booking receipt questions from the creator perspective", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How do creators receive bookings?",
    });

    expect(response.answer).toContain(
      "booking request from your creator profile",
    );
    expect(response.answer).toContain("Bookings area");
    expect(response.answer).not.toContain("Open a business or creator profile");
  });

  it("answers booking-message location questions directly", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "Where are my booking messages?",
    });

    expect(response.answer).toContain("go to Bookings");
    expect(response.answer).toContain("If you are a creator");
    expect(response.answer).not.toContain("Open a business or creator profile");
  });

  it("answers ad-placement questions directly", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({ message: "Where will my ad appear?" });

    expect(response.answer).toContain(
      "Sponsored section on the LIBERIA360 homepage",
    );
    expect(response.answer).toContain("Account → My Ads");
    expect(response.answer).not.toContain("choose New ad");
  });

  it("answers approval-time questions honestly", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How long does approval take?",
    });

    expect(response.answer).toContain(
      "does not currently publish a guaranteed approval time",
    );
    expect(response.answer).toContain("My Places");
    expect(response.answer).not.toContain("LIBERIA360 helps people discover");
  });

  it("routes creator-post saving questions to the save guidance", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "How do I save a creator post?",
    });

    expect(response.answer).toContain("private bookmark");
    expect(response.answer).toContain("Unsave");
  });

  it("routes comment reply questions to the comment guidance", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "Can people like and reply to comments?",
    });

    expect(response.answer).toContain("Tap Reply");
    expect(response.answer).toContain("nested");
  });

  it("routes event ticket purchase questions to the ticket guidance", async () => {
    const service = new AssistantService(config());
    const response = await service.ask({ message: "How do I buy a ticket for a paid event?" });
    expect(response.answer).toContain("payment reference");
    expect(response.answer).toContain("ticket type");
    expect(response.actions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "myTickets" })]));
  });

  it("routes QR download questions to My Tickets guidance", async () => {
    const service = new AssistantService(config());
    const response = await service.ask({ message: "Where can I download my QR ticket?" });
    expect(response.answer).toContain("Account → My Tickets");
    expect(response.answer).toContain("Download QR");
    expect(response.answer).toContain("cancelled");
  });

  it("routes organizer scan questions to one-time redemption guidance", async () => {
    const service = new AssistantService(config());
    const response = await service.ask({ message: "How does an organizer scan and validate a ticket?" });
    expect(response.answer).toContain("dedicated scanner page");
    expect(response.answer).toContain("already used");
    expect(response.answer).toContain("wrong-event");
  });

  it("routes customer service questions safely", async () => {
    const service = new AssistantService(config());
    const response = await service.ask({ message: "How do I contact customer service about a ticket problem?" });
    expect(response.answer).toContain("cannot");
    expect(response.answer).toContain("payment credentials");
    expect(response.answer).toContain("support-center page");
  });

  it("does not invent details about This Extraordinary Life", async () => {
    const service = new AssistantService(config());
    const response = await service.ask({ message: "What is This Extraordinary Life?" });
    expect(response.answer).toContain("do not yet have confirmed details");
    expect(response.answer).toContain("official description");
  });

  it("does not pretend to know unrelated questions", async () => {
    const service = new AssistantService(config());

    const response = await service.ask({
      message: "What is the weather on Mars?",
    });

    expect(response.source).toBe("knowledge");
    expect(response.answer).toContain("not sure");
    expect(response.answer).not.toContain("15 counties");
  });
});
