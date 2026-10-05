import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConsultationsService } from "./consultations.service";
import {
  ClinicStaffRole,
  ConsultationPaymentMethod,
  ConsultationPaymentStatus,
  ConsultationStatus,
  DoctorVerificationStatus,
} from "./entities/clinic.enums";

const clinic = {
  id: "clinic-1",
  name: "Hope Clinic",
  slug: "hope",
  location: "Monrovia",
  telephone: "0777",
  address: "Sinkor",
  mtnMomoNumber: "0886 000 111",
  orangeMoneyNumber: null,
};
const doctor = {
  id: "doc-1",
  userId: "doctor-user",
  fullName: "Musu Kollie",
  specialty: "Family medicine",
  licenceNumber: "LMDC-1",
  verificationStatus: DoctorVerificationStatus.VERIFIED,
  consultFee: 500,
  consultClinic: clinic,
  availableNow: true,
};

function consult(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    clinicId: "clinic-1",
    clinic,
    doctor,
    doctorUserId: "doctor-user",
    patientUserId: "patient-1",
    patientName: "Comfort Doe",
    reason: "Cough for a week and a fever at night",
    fee: 500,
    paymentMethod: ConsultationPaymentMethod.MTN_MOMO,
    paymentReference: "MP123",
    paymentStatus: ConsultationPaymentStatus.AWAITING_VERIFICATION,
    status: ConsultationStatus.REQUESTED,
    ePrescriptionId: null,
    ...overrides,
  };
}

function setup() {
  const consultations = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "c-1", ...x })),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(async () => consult()),
    find: jest.fn(async (): Promise<unknown[]> => []),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const messageQb: Record<string, jest.Mock> = {};
  for (const m of ["select", "addSelect", "where", "andWhere", "groupBy"])
    messageQb[m] = jest.fn(() => messageQb);
  messageQb.getRawMany = jest.fn(async (): Promise<unknown[]> => []);
  messageQb.getOne = jest.fn();
  const messages = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({
      id: "m-1",
      createdAt: new Date(),
      readAt: null,
      ...x,
    })),
    update: jest.fn(async () => ({ affected: 0 })),
    find: jest.fn(async (): Promise<unknown[]> => []),
    createQueryBuilder: jest.fn(() => messageQb),
  };
  const doctorQb: Record<string, jest.Mock> = {};
  for (const m of [
    "innerJoinAndSelect",
    "innerJoin",
    "where",
    "andWhere",
    "orderBy",
    "addOrderBy",
  ])
    doctorQb[m] = jest.fn(() => doctorQb);
  doctorQb.getMany = jest.fn(async (): Promise<unknown[]> => [doctor]);
  const doctors = {
    findOne: jest.fn(async () => doctor),
    findOneOrFail: jest.fn(async () => doctor),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => doctorQb),
  };
  const clinics = { findOne: jest.fn(async () => clinic) };
  const staff = {};
  const prescriptions = { find: jest.fn(async (): Promise<unknown[]> => []) };
  const clinicsService = {
    assertMember: jest.fn(async () => ({ role: ClinicStaffRole.DOCTOR })),
  };
  const storage = {
    savePrivate: jest.fn(async () => ({ key: "private/voice-1" })),
    readPrivate: jest.fn(async () => ({ buffer: Buffer.from("audio") })),
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const service = new ConsultationsService(
    consultations as never,
    messages as never,
    doctors as never,
    clinics as never,
    staff as never,
    prescriptions as never,
    clinicsService as never,
    storage as never,
    notifications as never,
  );
  return {
    service,
    consultations,
    messages,
    messageQb,
    doctors,
    clinics,
    clinicsService,
    storage,
    notifications,
  };
}

const booking = {
  doctorId: "doc-1",
  reason: "Cough for a week and a fever at night",
  redFlags: [] as string[],
  noRedFlagsConfirmed: true,
  paymentMethod: ConsultationPaymentMethod.MTN_MOMO,
  paymentReference: "MP123",
};

describe("ConsultationsService booking", () => {
  it("sends anyone with an emergency sign to emergency care instead", async () => {
    const { service, consultations } = setup();
    await expect(
      service.request("patient-1", "Comfort", {
        ...booking,
        redFlags: ["chest_pain"],
      }),
    ).rejects.toThrow(/emergency care/);
    await expect(
      service.request("patient-1", "Comfort", {
        ...booking,
        noRedFlagsConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(consultations.save).not.toHaveBeenCalled();
  });

  it("books a paid consultation and tells the doctor to check the payment", async () => {
    const { service, consultations, notifications } = setup();
    const out = await service.request("patient-1", "Comfort Doe", booking);
    expect(consultations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorUserId: "doctor-user",
        fee: 500,
        paymentAccount: "0886 000 111",
        paymentStatus: ConsultationPaymentStatus.AWAITING_VERIFICATION,
        status: ConsultationStatus.REQUESTED,
        triageConfirmedAt: expect.any(Date),
      }),
    );
    expect(out.viewerRole).toBe("patient");
    expect(notifications.create).toHaveBeenCalledWith(
      "doctor-user",
      expect.objectContaining({
        type: "consultation.requested",
        body: expect.stringContaining("MP123"),
      }),
    );
  });

  it("refuses a payment method the clinic doesn't take, and a reused transaction ID", async () => {
    const { service, consultations } = setup();
    await expect(
      service.request("patient-1", "C", {
        ...booking,
        paymentMethod: ConsultationPaymentMethod.ORANGE_MONEY,
      }),
    ).rejects.toThrow(/doesn't take Orange Money/);
    consultations.save.mockRejectedValueOnce({ code: "23505" });
    await expect(service.request("patient-1", "C", booking)).rejects.toThrow(
      ConflictException,
    );
  });

  it("won't let a doctor book themselves", async () => {
    const { service } = setup();
    await expect(
      service.request("doctor-user", "Musu", booking),
    ).rejects.toThrow(/yourself/);
  });
});

describe("ConsultationsService workflow", () => {
  it("starts the consultation when the doctor confirms payment", async () => {
    const { service, consultations, notifications } = setup();
    consultations.findOne.mockResolvedValue(consult());
    await service.verifyPayment("doctor-user", "c-1", true);
    expect(consultations.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-1" }),
      expect.objectContaining({
        status: ConsultationStatus.ACTIVE,
        paymentStatus: ConsultationPaymentStatus.PAID,
        acceptedAt: expect.any(Date),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "patient-1",
      expect.objectContaining({
        title: "Dr Musu Kollie has started your consultation",
        link: "/account/consultations/c-1",
      }),
    );
  });

  it("only lets the doctor verify, and hides it from strangers", async () => {
    const { service, consultations } = setup();
    consultations.findOne.mockResolvedValue(consult());
    await expect(
      service.verifyPayment("patient-1", "c-1", true),
    ).rejects.toThrow(/Only the doctor/);
    await expect(service.get("stranger", "c-1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("owes a refund when the patient cancels after paying", async () => {
    const { service, consultations } = setup();
    consultations.findOne.mockResolvedValue(consult());
    await service.cancel("patient-1", "c-1");
    expect(consultations.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ConsultationStatus.CANCELLED,
        paymentStatus: ConsultationPaymentStatus.REFUND_DUE,
      }),
    );
  });

  it("explains when the consultation already moved on", async () => {
    const { service, consultations } = setup();
    consultations.findOne.mockResolvedValue(
      consult({ status: ConsultationStatus.ACTIVE }),
    );
    consultations.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.cancel("patient-1", "c-1")).rejects.toThrow(
      /already started/,
    );
  });

  it("closes with the doctor's advice", async () => {
    const { service, consultations } = setup();
    consultations.findOne.mockResolvedValue(
      consult({ status: ConsultationStatus.ACTIVE }),
    );
    await service.complete("doctor-user", "c-1", {
      outcome: "advice" as never,
      summary:
        "Rest, drink plenty of water, and come in if the fever lasts past Friday.",
    });
    expect(consultations.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
      expect.objectContaining({
        status: ConsultationStatus.COMPLETED,
        completedAt: expect.any(Date),
      }),
    );
  });
});

describe("ConsultationsService messages", () => {
  it("keeps voice notes private and refuses other file types", async () => {
    const { service, consultations, storage, messages } = setup();
    consultations.findOne.mockResolvedValue(
      consult({ status: ConsultationStatus.ACTIVE }),
    );
    await expect(
      service.sendVoice(
        "patient-1",
        "c-1",
        { buffer: Buffer.from("x"), mimeType: "image/png" },
        5,
      ),
    ).rejects.toThrow(/voice recording/);
    const sent = await service.sendVoice(
      "patient-1",
      "c-1",
      { buffer: Buffer.from("x"), mimeType: "audio/webm;codecs=opus" },
      12,
    );
    expect(storage.savePrivate).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "audio/webm" }),
    );
    expect(messages.save).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceKey: "private/voice-1",
        voiceSeconds: 12,
        fromDoctor: false,
      }),
    );
    expect(sent).toEqual(
      expect.objectContaining({
        mine: true,
        voice: { seconds: 12, mimeType: "audio/webm" },
      }),
    );
    expect(sent).not.toHaveProperty("voiceKey");
  });

  it("won't take messages once the consultation is closed", async () => {
    const { service, consultations } = setup();
    consultations.findOne.mockResolvedValue(
      consult({ status: ConsultationStatus.COMPLETED }),
    );
    await expect(
      service.sendMessage("patient-1", "c-1", "Thank you"),
    ).rejects.toThrow(/closed/);
  });

  it("plays a voice note only for the two people in the consultation", async () => {
    const { service, consultations, messageQb } = setup();
    messageQb.getOne.mockResolvedValue({
      id: "m-1",
      consultationId: "c-1",
      voiceKey: "k",
      voiceMime: "audio/ogg",
    });
    consultations.findOne.mockResolvedValue(consult());
    await expect(service.voice("stranger", "m-1")).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.voice("doctor-user", "m-1")).resolves.toEqual(
      expect.objectContaining({ mimeType: "audio/ogg" }),
    );
  });
});

describe("ConsultationsService doctor settings", () => {
  it("needs a clinic that takes mobile money before offering consultations", async () => {
    const { service, clinics, doctors } = setup();
    clinics.findOne.mockResolvedValueOnce({
      ...clinic,
      mtnMomoNumber: null,
    } as never);
    await expect(
      service.saveConsultSettings("doctor-user", {
        consultFee: 500,
        consultClinicId: "clinic-1",
        availableNow: true,
      }),
    ).rejects.toThrow(/MTN MoMo or Orange Money/);
    await service.saveConsultSettings("doctor-user", {
      consultFee: null,
      availableNow: true,
    });
    expect(doctors.update).toHaveBeenCalledWith(
      { id: "doc-1" },
      { consultFee: null, consultClinicId: null, availableNow: false },
    );
  });
});
