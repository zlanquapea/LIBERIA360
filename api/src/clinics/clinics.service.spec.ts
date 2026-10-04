import { ConflictException, ForbiddenException } from "@nestjs/common";
import { PharmacyStaffRole } from "../pharmacies/entities/pharmacy.enums";
import { ClinicsService } from "./clinics.service";
import {
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
} from "./entities/clinic.enums";

function setup() {
  const clinicQb: Record<string, jest.Mock> = {};
  for (const m of ["addSelect", "leftJoinAndSelect", "where", "orderBy"])
    clinicQb[m] = jest.fn(() => clinicQb);
  clinicQb.getOneOrFail = jest.fn();
  clinicQb.getMany = jest.fn(async (): Promise<unknown[]> => []);
  const clinics = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "clinic-1", ...x })),
    update: jest.fn(async () => ({ affected: 1 })),
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(async () => ({
      id: "clinic-1",
      name: "Hope Clinic",
    })),
    createQueryBuilder: jest.fn(() => clinicQb),
  };
  const staff = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(async () => ({ affected: 1 })),
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
    count: jest.fn(async () => 1),
  };
  const doctors = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "doc-1", ...x })),
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
  };
  const pharmacies = { find: jest.fn(async (): Promise<unknown[]> => []) };
  const pharmacyStaff = {
    findOne: jest.fn(),
    find: jest.fn(async (): Promise<unknown[]> => []),
  };
  const users = {
    findByEmail: jest.fn(),
    findAdminIds: jest.fn(async () => ["admin-1"]),
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const service = new ClinicsService(
    clinics as never,
    staff as never,
    doctors as never,
    pharmacies as never,
    pharmacyStaff as never,
    users as never,
    notifications as never,
  );
  return {
    service,
    clinics,
    clinicQb,
    staff,
    doctors,
    pharmacyStaff,
    users,
    notifications,
  };
}

const profile = {
  name: "Hope Clinic",
  address: "15th Street, Sinkor",
  location: "Monrovia",
  telephone: "0777 123 456",
};

describe("ClinicsService", () => {
  it("only attaches a pharmacy the clinic admin manages", async () => {
    const { service, pharmacyStaff, clinics } = setup();
    pharmacyStaff.findOne.mockResolvedValue(null);
    await expect(
      service.create("user-1", { ...profile, pharmacyId: "ph-1" }),
    ).rejects.toThrow(ForbiddenException);
    expect(clinics.save).not.toHaveBeenCalled();
    expect(pharmacyStaff.findOne).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        pharmacyId: "ph-1",
        active: true,
        role: PharmacyStaffRole.MANAGER,
      },
    });
  });

  it("makes the applicant the clinic's admin and tells the platform admins", async () => {
    const { service, staff, notifications, clinics } = setup();
    staff.findOne.mockResolvedValue({ role: ClinicStaffRole.ADMIN });
    staff.find.mockResolvedValue([
      { clinicId: "clinic-1", role: ClinicStaffRole.ADMIN },
    ]);
    await service.create("user-1", profile).catch(() => undefined);
    expect(clinics.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ClinicStatus.PENDING }),
    );
    expect(staff.save).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "clinic-1",
        userId: "user-1",
        role: ClinicStaffRole.ADMIN,
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "admin-1",
      expect.objectContaining({ type: "admin.clinic_pending_review" }),
    );
  });

  it("sends an approved clinic back to review when its licence changes", async () => {
    const { service, staff, clinicQb, clinics } = setup();
    staff.findOne.mockResolvedValue({ role: ClinicStaffRole.ADMIN });
    clinicQb.getOneOrFail.mockResolvedValue({
      id: "clinic-1",
      status: ClinicStatus.APPROVED,
      licenceNumber: "MOH-1",
      pharmacyId: null,
    });
    await service
      .update("user-1", "clinic-1", { ...profile, licenceNumber: "MOH-2" })
      .catch(() => undefined);
    expect(clinics.update).toHaveBeenCalledWith(
      { id: "clinic-1" },
      expect.objectContaining({
        licenceNumber: "MOH-2",
        status: ClinicStatus.PENDING,
      }),
    );
  });

  it("never leaves a clinic without an admin", async () => {
    const { service, staff } = setup();
    staff.findOne
      .mockResolvedValueOnce({ role: ClinicStaffRole.ADMIN }) // caller
      .mockResolvedValueOnce({
        id: "s1",
        role: ClinicStaffRole.ADMIN,
        active: true,
      }); // target
    staff.count.mockResolvedValue(1);
    await expect(
      service.deactivateStaff("user-1", "clinic-1", "user-1"),
    ).rejects.toThrow(ConflictException);
  });

  it("only lets the front desk see, not prescribe", async () => {
    const { service, staff } = setup();
    staff.findOne.mockResolvedValue({ role: ClinicStaffRole.FRONT_DESK });
    await expect(
      service.assertMember("user-1", "clinic-1", [
        ClinicStaffRole.DOCTOR,
        ClinicStaffRole.ADMIN,
      ]),
    ).rejects.toThrow(ForbiddenException);
  });

  it("re-checks a doctor whose licence number changes", async () => {
    const { service, doctors } = setup();
    doctors.findOne.mockResolvedValue({
      id: "doc-1",
      userId: "user-1",
      fullName: "Musu Kollie",
      licenceNumber: "LMDC-1",
      verificationStatus: DoctorVerificationStatus.VERIFIED,
    });
    const saved = await service.saveDoctorProfile("user-1", {
      fullName: "Musu Kollie",
      specialty: "Family medicine",
      licenceNumber: "LMDC-2",
    });
    expect(saved.verificationStatus).toBe(DoctorVerificationStatus.PENDING);

    doctors.findOne.mockResolvedValue({
      ...saved,
      licenceNumber: "LMDC-2",
      verificationStatus: DoctorVerificationStatus.VERIFIED,
    });
    const unchanged = await service.saveDoctorProfile("user-1", {
      fullName: "Musu Kollie",
      specialty: "Paediatrics",
      licenceNumber: "LMDC-2",
    });
    expect(unchanged.verificationStatus).toBe(
      DoctorVerificationStatus.VERIFIED,
    );
  });
});
