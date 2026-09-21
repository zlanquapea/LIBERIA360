import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { TripNotificationsService } from "./trip-notifications.service";
import { TripNotificationDelivery } from "./entities/trip-notification-delivery.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";

const ORGANIZER = {
  id: "organizer-1",
  name: "Organizer",
  email: "organizer@example.com",
};
const PARTICIPANT = {
  id: "participant-1",
  name: "Participant",
  email: "participant@example.com",
};

function makeTrip(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: "trip-1",
    userId: ORGANIZER.id,
    user: ORGANIZER,
    title: "Weekend in Robertsport",
    startDate: null,
    endDate: null,
    cancelledAt: null,
    destination: null,
    ...overrides,
  } as Itinerary;
}

function inMs(ms: number): Date {
  return new Date(Date.now() + ms);
}

describe("TripNotificationsService", () => {
  let service: TripNotificationsService;
  let deliveryRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let itineraryRepo: { find: jest.Mock };
  let collaboratorRepo: { find: jest.Mock };
  let notificationsService: { create: jest.Mock };
  let mailService: { sendTripNotification: jest.Mock };

  beforeEach(async () => {
    deliveryRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn((data) => data),
    };
    itineraryRepo = { find: jest.fn().mockResolvedValue([]) };
    collaboratorRepo = { find: jest.fn().mockResolvedValue([]) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    mailService = {
      sendTripNotification: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripNotificationsService,
        {
          provide: getRepositoryToken(TripNotificationDelivery),
          useValue: deliveryRepo,
        },
        { provide: getRepositoryToken(Itinerary), useValue: itineraryRepo },
        {
          provide: getRepositoryToken(ItineraryCollaborator),
          useValue: collaboratorRepo,
        },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("https://liberia360.example"),
          },
        },
      ],
    }).compile();

    service = module.get(TripNotificationsService);
  });

  // Regression guard for the product ask itself: 3 days, 1 day, 6 hours,
  // and 1 hour before departure — not the event-reminder service's own
  // 2d/1d/30m windows, which this deliberately does not reuse.
  it.each([
    ["reminder_3d", 259_200_000],
    ["reminder_1d", 86_400_000],
    ["reminder_6h", 21_600_000],
    ["reminder_1h", 3_600_000],
  ])(
    "fires %s exactly at its window before departure",
    async (kind, offsetMs) => {
      itineraryRepo.find.mockResolvedValue([
        makeTrip({ startDate: inMs(offsetMs) }),
      ]);
      await service.processDueReminders();
      expect(notificationsService.create).toHaveBeenCalledWith(
        ORGANIZER.id,
        expect.objectContaining({ type: "trip.reminder" }),
      );
      const deliveryCreateCalls = deliveryRepo.create.mock.calls.map(
        (call) => call[0],
      );
      expect(deliveryCreateCalls).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind })]),
      );
    },
  );

  it("does not fire for a trip whose departure isn't inside any reminder window", async () => {
    itineraryRepo.find.mockResolvedValue([
      makeTrip({ startDate: inMs(12 * 3_600_000) }), // 12h out — between 1d and 6h
    ]);
    await service.processDueReminders();
    expect(notificationsService.create).not.toHaveBeenCalled();
    expect(mailService.sendTripNotification).not.toHaveBeenCalled();
  });

  it("notifies both the organizer and every collaborator", async () => {
    itineraryRepo.find.mockResolvedValue([
      makeTrip({ startDate: inMs(3_600_000) }),
    ]);
    collaboratorRepo.find.mockResolvedValue([
      { userId: PARTICIPANT.id, user: PARTICIPANT },
    ]);
    await service.processDueReminders();
    expect(notificationsService.create).toHaveBeenCalledWith(
      ORGANIZER.id,
      expect.objectContaining({ type: "trip.reminder" }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      PARTICIPANT.id,
      expect.objectContaining({ type: "trip.reminder" }),
    );
    expect(mailService.sendTripNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: ORGANIZER.email }),
    );
    expect(mailService.sendTripNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: PARTICIPANT.email }),
    );
  });

  it("never duplicates a recipient who is both organizer and their own collaborator row", async () => {
    itineraryRepo.find.mockResolvedValue([
      makeTrip({ startDate: inMs(3_600_000) }),
    ]);
    collaboratorRepo.find.mockResolvedValue([
      { userId: ORGANIZER.id, user: ORGANIZER },
    ]);
    await service.processDueReminders();
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
  });

  it("skips a trip with no startDate set", async () => {
    itineraryRepo.find.mockResolvedValue([makeTrip({ startDate: null })]);
    await service.processDueReminders();
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  // The query itself filters cancelledAt IS NULL, but a defensive check
  // here would be redundant dead code — verified instead by confirming
  // the query filter is actually wired (see the where-clause assertion).
  it("queries only non-cancelled trips within the lookahead window", async () => {
    itineraryRepo.find.mockResolvedValue([]);
    await service.processDueReminders();
    expect(itineraryRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cancelledAt: expect.objectContaining({ type: "isNull" }),
        }),
      }),
    );
  });

  it("does not re-notify a recipient once a delivery row already recorded both channels sent", async () => {
    itineraryRepo.find.mockResolvedValue([
      makeTrip({ startDate: inMs(3_600_000) }),
    ]);
    deliveryRepo.findOne.mockResolvedValue({
      itineraryId: "trip-1",
      recipientUserId: ORGANIZER.id,
      kind: "reminder_1h",
      inAppSent: true,
      emailSent: true,
      sentAt: new Date(),
    });
    await service.processDueReminders();
    expect(notificationsService.create).not.toHaveBeenCalled();
    expect(mailService.sendTripNotification).not.toHaveBeenCalled();
    expect(deliveryRepo.save).not.toHaveBeenCalled();
  });

  it("includes the trip's destination name in the reminder copy when set", async () => {
    itineraryRepo.find.mockResolvedValue([
      makeTrip({
        startDate: inMs(3_600_000),
        destination: { name: "Robertsport" } as never,
      }),
    ]);
    await service.processDueReminders();
    expect(notificationsService.create).toHaveBeenCalledWith(
      ORGANIZER.id,
      expect.objectContaining({ body: expect.stringContaining("Robertsport") }),
    );
  });
});
