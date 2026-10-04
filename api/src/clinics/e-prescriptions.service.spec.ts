import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  PharmacyStaffRole,
  PharmacyStatus,
} from "../pharmacies/entities/pharmacy.enums";
import { controlledMedicine } from "./controlled-medicines";
import {
  EPrescriptionsService,
  formatCode,
  normalizeCode,
  unavailableReason,
} from "./e-prescriptions.service";
import {
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
  EPrescriptionStatus,
} from "./entities/clinic.enums";

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

function rxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rx-1",
    code: "ABCD2345",
    verifyToken: "secret-token",
    clinicId: "clinic-1",
    clinic: {
      id: "clinic-1",
      name: "Hope Clinic",
      slug: "hope",
      address: "Sinkor",
      telephone: "0777",
    },
    doctor: {
      id: "doc-1",
      fullName: "Musu Kollie",
      specialty: "Family medicine",
      licenceNumber: "LMDC-1",
      verificationStatus: DoctorVerificationStatus.VERIFIED,
    },
    doctorUserId: "doctor-user",
    patientUserId: "patient-1",
    patientName: "Comfort Doe",
    patientAge: 30,
    patientPhone: "0886",
    notesForPharmacist: "Prefers syrup",
    status: EPrescriptionStatus.ISSUED,
    pharmacyId: null,
    pharmacy: null,
    expiresAt: future(),
    dispensedAt: null,
    items: [
      {
        id: "i1",
        position: 0,
        medicine: "Amoxicillin",
        strength: "500mg",
        dosage: "1 cap 3x daily",
        durationDays: 7,
        quantity: 21,
        instructions: null,
        productId: null,
      },
    ],
    createdAt: new Date(),
    ...overrides,
  };
}

function queryBuilder(result: unknown) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    "leftJoinAndSelect",
    "addSelect",
    "where",
    "andWhere",
    "orderBy",
    "take",
    "update",
    "set",
  ])
    qb[m] = jest.fn(() => qb);
  qb.getOne = jest.fn(async () => result);
  qb.getMany = jest.fn(async () => (Array.isArray(result) ? result : [result]));
  qb.execute = jest.fn(async () => result);
  return qb;
}

function setup() {
  const rxRepo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "rx-new", ...x })),
    exists: jest.fn(async () => false),
    update: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(),
    find: jest.fn(async (): Promise<unknown[]> => []),
    createQueryBuilder: jest.fn(),
  };
  const itemRepo = { create: jest.fn((x) => x) };
  const clinics = { findOne: jest.fn() };
  const doctors = { findOne: jest.fn() };
  const pharmacies = {
    findOne: jest.fn(),
    find: jest.fn(async (): Promise<unknown[]> => []),
  };
  const pharmacyStaff = {
    findOne: jest.fn(),
    find: jest.fn(async (): Promise<unknown[]> => []),
  };
  const products = {
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const inventory = { find: jest.fn(async (): Promise<unknown[]> => []) };
  const userRepo = { createQueryBuilder: jest.fn() };
  const clinicsService = {
    assertMember: jest.fn(async () => ({ role: ClinicStaffRole.DOCTOR })),
  };
  const users = {
    findById: jest.fn(async () => ({ id: "patient-1" })),
    findByEmail: jest.fn(),
  };
  const config = { get: jest.fn(() => "https://liberia360.test") };
  const notifications = { create: jest.fn(async () => undefined) };
  const service = new EPrescriptionsService(
    rxRepo as never,
    itemRepo as never,
    clinics as never,
    doctors as never,
    pharmacies as never,
    pharmacyStaff as never,
    products as never,
    inventory as never,
    userRepo as never,
    clinicsService as never,
    users as never,
    config as never,
    notifications as never,
  );
  return {
    service,
    rxRepo,
    clinics,
    doctors,
    pharmacies,
    pharmacyStaff,
    products,
    clinicsService,
    notifications,
  };
}

const issueDto = {
  patientUserId: "patient-1",
  patientName: "Comfort Doe",
  items: [
    {
      medicine: "Amoxicillin",
      strength: "500mg",
      dosage: "1 cap 3x daily",
      quantity: 21,
      productId: "prod-1",
    },
  ],
};

describe("e-prescription helpers", () => {
  it("flags controlled medicines however they're written", () => {
    expect(controlledMedicine("TRAMADOL 50mg")).toBe("tramadol");
    expect(controlledMedicine("diazepam-5")).toBe("diazepam");
    expect(controlledMedicine("Amoxicillin 500mg")).toBeNull();
  });

  it("reads a code however it was typed", () => {
    expect(normalizeCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });

  it("explains why a prescription can't be filled", () => {
    expect(
      unavailableReason(
        rxRow({ status: EPrescriptionStatus.CANCELLED }) as never,
      ),
    ).toMatch(/cancelled/);
    expect(unavailableReason(rxRow({ expiresAt: past() }) as never)).toMatch(
      /expired/,
    );
    expect(
      unavailableReason(
        rxRow({
          status: EPrescriptionStatus.READY,
          pharmacyId: "other",
          pharmacy: { name: "Other Pharmacy" },
        }) as never,
        "mine",
      ),
    ).toBe("Being prepared at Other Pharmacy");
    expect(unavailableReason(rxRow() as never, "mine")).toBeNull();
  });
});

describe("EPrescriptionsService.issue", () => {
  it("needs a verified clinic", async () => {
    const { service, clinics } = setup();
    clinics.findOne.mockResolvedValue({
      id: "clinic-1",
      status: ClinicStatus.PENDING,
    });
    await expect(
      service.issue("doctor-user", "clinic-1", issueDto as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it("needs a verified doctor", async () => {
    const { service, clinics, doctors } = setup();
    clinics.findOne.mockResolvedValue({
      id: "clinic-1",
      status: ClinicStatus.APPROVED,
    });
    doctors.findOne.mockResolvedValue({
      id: "doc-1",
      verificationStatus: DoctorVerificationStatus.PENDING,
    });
    await expect(
      service.issue("doctor-user", "clinic-1", issueDto as never),
    ).rejects.toThrow(/licence must be verified/);
  });

  it("refuses controlled medicines", async () => {
    const { service, clinics, doctors, rxRepo } = setup();
    clinics.findOne.mockResolvedValue({
      id: "clinic-1",
      status: ClinicStatus.APPROVED,
    });
    doctors.findOne.mockResolvedValue({
      id: "doc-1",
      verificationStatus: DoctorVerificationStatus.VERIFIED,
    });
    await expect(
      service.issue("doctor-user", "clinic-1", {
        ...issueDto,
        items: [{ medicine: "Morphine sulfate", dosage: "x", quantity: 1 }],
      } as never),
    ).rejects.toThrow(BadRequestException);
    expect(rxRepo.save).not.toHaveBeenCalled();
  });

  it("sends to the attached pharmacy and keeps only that pharmacy's products", async () => {
    const { service, clinics, doctors, rxRepo, products, notifications } =
      setup();
    clinics.findOne.mockResolvedValue({
      id: "clinic-1",
      status: ClinicStatus.APPROVED,
      pharmacyId: "ph-1",
      pharmacy: {
        id: "ph-1",
        name: "CarePoint",
        status: PharmacyStatus.APPROVED,
      },
    });
    doctors.findOne.mockResolvedValue({
      id: "doc-1",
      fullName: "Musu Kollie",
      verificationStatus: DoctorVerificationStatus.VERIFIED,
    });
    products.find.mockResolvedValue([]); // prod-1 isn't on CarePoint's shelf
    rxRepo.createQueryBuilder.mockReturnValue(
      queryBuilder(rxRow({ status: EPrescriptionStatus.SENT })),
    );

    const out = await service.issue("doctor-user", "clinic-1", {
      ...issueDto,
      sendToPharmacy: true,
    } as never);

    const saved = rxRepo.save.mock.calls[0][0];
    expect(saved).toEqual(
      expect.objectContaining({
        status: EPrescriptionStatus.SENT,
        pharmacyId: "ph-1",
        patientUserId: "patient-1",
      }),
    );
    expect(saved.items[0].productId).toBeNull();
    expect(saved.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(out.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(notifications.create).toHaveBeenCalledWith(
      "patient-1",
      expect.objectContaining({ type: "prescription.issued" }),
    );
  });
});

describe("EPrescriptionsService.verify", () => {
  it("hides everything without the right token", async () => {
    const { service, rxRepo } = setup();
    rxRepo.createQueryBuilder.mockReturnValue(queryBuilder(rxRow()));
    await expect(
      service.verify("ABCD-2345", "wrong", undefined),
    ).rejects.toThrow(NotFoundException);
  });

  it("shows only that it's genuine to a stranger with the QR", async () => {
    const { service, rxRepo, clinicsService } = setup();
    rxRepo.createQueryBuilder.mockReturnValue(queryBuilder(rxRow()));
    clinicsService.assertMember.mockRejectedValue(new ForbiddenException());
    const out = await service.verify("abcd2345", "secret-token", {
      id: "stranger",
    });
    expect(out.full).toBe(false);
    expect(out.items).toEqual([]);
    expect(out.patientName).toBe("C. D.");
    expect(out.doctor?.verified).toBe(true);
  });

  it("shows the medicines to pharmacy staff holding the QR", async () => {
    const { service, rxRepo, clinicsService, pharmacyStaff, pharmacies } =
      setup();
    rxRepo.createQueryBuilder.mockReturnValue(queryBuilder(rxRow()));
    clinicsService.assertMember.mockRejectedValue(new ForbiddenException());
    pharmacyStaff.find.mockResolvedValue([{ pharmacyId: "ph-1" }]);
    pharmacies.find.mockResolvedValue([{ id: "ph-1", name: "CarePoint" }]);
    const out = await service.verify("ABCD2345", "secret-token", {
      id: "pharmacist",
    });
    expect(out.full).toBe(true);
    expect(out.items).toHaveLength(1);
    expect(out.myPharmacies).toEqual([{ id: "ph-1", name: "CarePoint" }]);
  });
});

describe("EPrescriptionsService.dispense", () => {
  function counter(role: PharmacyStaffRole) {
    const ctx = setup();
    ctx.pharmacyStaff.findOne.mockResolvedValue({ role });
    ctx.pharmacies.findOne.mockResolvedValue({
      id: "ph-1",
      name: "CarePoint",
      status: PharmacyStatus.APPROVED,
    });
    return ctx;
  }

  it("is for pharmacists only", async () => {
    const { service } = counter(PharmacyStaffRole.MANAGER);
    await expect(service.dispense("u", "ph-1", "rx-1")).rejects.toThrow(
      /Only a pharmacist/,
    );
  });

  it("fills a prescription once and says why a second time fails", async () => {
    const { service, rxRepo, notifications } = counter(
      PharmacyStaffRole.PHARMACIST,
    );
    rxRepo.createQueryBuilder
      .mockReturnValueOnce(queryBuilder({ affected: 1 }))
      .mockReturnValueOnce(
        queryBuilder(
          rxRow({ status: EPrescriptionStatus.DISPENSED, pharmacyId: "ph-1" }),
        ),
      )
      .mockReturnValueOnce(queryBuilder({ affected: 0 }))
      .mockReturnValueOnce(
        queryBuilder(
          rxRow({
            status: EPrescriptionStatus.DISPENSED,
            pharmacyId: "ph-1",
            pharmacy: { name: "CarePoint" },
            dispensedAt: new Date(),
          }),
        ),
      );
    const first = await service.dispense("u", "ph-1", "rx-1");
    expect(first.status).toBe(EPrescriptionStatus.DISPENSED);
    expect(notifications.create).toHaveBeenCalledWith(
      "patient-1",
      expect.objectContaining({ title: "Dispensed at CarePoint" }),
    );
    await expect(service.dispense("u", "ph-1", "rx-1")).rejects.toThrow(
      ConflictException,
    );
  });
});

describe("EPrescriptionsService and app orders", () => {
  it("only lets the patient use an open prescription", async () => {
    const { service, rxRepo } = setup();
    rxRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.usableForOrder("someone", "rx-1")).rejects.toThrow(
      /isn't yours/,
    );
    rxRepo.findOne.mockResolvedValueOnce(
      rxRow({ status: EPrescriptionStatus.ORDERED }),
    );
    await expect(service.usableForOrder("patient-1", "rx-1")).rejects.toThrow(
      /Already ordered/,
    );
    rxRepo.findOne.mockResolvedValueOnce(rxRow());
    await expect(service.usableForOrder("patient-1", "rx-1")).resolves.toEqual(
      expect.objectContaining({ id: "rx-1" }),
    );
  });

  it("won't attach a prescription another order just took", async () => {
    const { service, rxRepo } = setup();
    rxRepo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      service.attachToOrder("rx-1", "order-1", "ph-1"),
    ).rejects.toThrow(ConflictException);
  });

  it("frees the prescription when its order is cancelled", async () => {
    const { service, rxRepo } = setup();
    await service.orderSettled("order-1", false);
    expect(rxRepo.update).toHaveBeenCalledWith(
      { pharmacyOrderId: "order-1", status: EPrescriptionStatus.ORDERED },
      {
        status: EPrescriptionStatus.ISSUED,
        pharmacyOrderId: null,
        pharmacyId: null,
      },
    );
  });
});
