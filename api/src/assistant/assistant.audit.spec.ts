import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/configuration";
import { AssistantService } from "./assistant.service";

function config() {
  return {
    get: jest.fn((key: string) =>
      key === "assistant"
        ? {
            apiKey: "",
            apiBase: "https://example.test/v1",
            model: "gpt-5-mini",
          }
        : undefined,
    ),
  } as unknown as ConfigService<AppConfig, true>;
}

type AuditCase = {
  name: string;
  message: string;
  expected: string;
  notExpected?: string;
};

const auditCases: AuditCase[] = [
  {
    name: "overview",
    message: "What is this app about?",
    expected: "discover places",
  },
  {
    name: "search",
    message: "How can I find a hotel near me?",
    expected: "Use Search",
  },
  {
    name: "add business",
    message: "How do I list my business?",
    expected: "Add a place",
  },
  {
    name: "approval status",
    message: "Why is my listing still pending?",
    expected: "guaranteed approval time",
  },
  {
    name: "advertising setup",
    message: "How can I promote my business?",
    expected: "My Ads",
  },
  {
    name: "ad placement",
    message: "Where will my ad appear?",
    expected: "Sponsored section",
    notExpected: "choose New ad",
  },
  {
    name: "customer booking",
    message: "How do I book a creator?",
    expected: "booking option",
  },
  {
    name: "creator booking",
    message: "How do creators receive booking requests?",
    expected: "creator profile",
    notExpected: "Open a business or creator profile",
  },
  {
    name: "booking messages",
    message: "Where are my booking messages?",
    expected: "go to Bookings",
    notExpected: "Open a business or creator profile",
  },
  {
    name: "become creator",
    message: "How can I join the creator community?",
    expected: "Creator dashboard",
  },
  {
    name: "creator posts",
    message: "How do I publish a video post?",
    expected: "Create post",
  },
  {
    name: "creator photos",
    message: "How do I change my creator photo?",
    expected: "photo action menu",
    notExpected: "The Creators area helps people discover",
  },
  {
    name: "engagement",
    message: "Can people like and share creator posts?",
    expected: "signed-in users",
  },
  {
    name: "comment interactions",
    message: "Can users like and reply to comments?",
    expected: "Tap Reply",
  },
  {
    name: "save creator post",
    message: "How do I bookmark a creator post?",
    expected: "private bookmark",
  },
  {
    name: "events",
    message: "Where can I see upcoming events?",
    expected: "Events",
  },
  {
    name: "trips",
    message: "Can the app help me plan a weekend trip?",
    expected: "trip planner",
  },
  {
    name: "reviews and badges",
    message: "How do verification badges work?",
    expected: "administrators",
  },
  {
    name: "saved account",
    message: "Where can I find my saved places?",
    expected: "Saved area",
  },
  {
    name: "assistant capabilities",
    message: "What can you do?",
    expected: "LIBERIA360 Assistant",
  },
  {
    name: "safety",
    message: "Should I send you my password and payment details?",
    expected: "Never share your password",
  },
  {
    name: "unknown",
    message: "What is the weather on Mars?",
    expected: "not sure",
  },
];

describe("AssistantService comprehensive audit", () => {
  it.each(auditCases)(
    "answers $name accurately",
    async ({ message, expected, notExpected }) => {
      const response = await new AssistantService(config()).ask({ message });

      expect(response.answer).toContain(expected);
      if (notExpected) expect(response.answer).not.toContain(notExpected);
      expect(
        response.actions.every((action) => action.href.startsWith("/")),
      ).toBe(true);
    },
  );

  it("keeps every returned action on the approved same-origin map", async () => {
    for (const { message } of auditCases) {
      const response = await new AssistantService(config()).ask({ message });
      expect(
        response.actions.every((action) =>
          /^\/[a-z0-9/?=&._-]*$/i.test(action.href),
        ),
      ).toBe(true);
    }
  });
});

export {};

// Keep the imported shared config type referenced under isolated module compilation.
void (undefined as unknown as AppConfig);
