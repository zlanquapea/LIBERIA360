import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { slugify } from "../common/slugify";
import { NotificationsService } from "../notifications/notifications.service";
import type { NotificationType } from "../notifications/entities/notification.entity";
import {
  Pharmacy,
  PharmacyStaff,
} from "../pharmacies/entities/pharmacy.entity";
import {
  PharmacyStaffRole,
  PharmacyStatus,
} from "../pharmacies/entities/pharmacy.enums";
import { UsersService } from "../users/users.service";
import {
  AssignClinicStaffDto,
  ClinicProfileDto,
  ClinicVerificationDto,
  DoctorProfileDto,
  DoctorVerificationDto,
} from "./dto/clinic.dto";
import { Clinic, ClinicStaff, DoctorProfile } from "./entities/clinic.entity";
import {
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
} from "./entities/clinic.enums";

/** The public face of a doctor: never their user id or licence notes. */
export function publicDoctor(d: DoctorProfile) {
  return {
    id: d.id,
    fullName: d.fullName,
    specialty: d.specialty,
    licenceNumber: d.licenceNumber,
    photoUrl: d.photoUrl,
    bio: d.bio,
    verified: d.verificationStatus === DoctorVerificationStatus.VERIFIED,
  };
}

export function publicPharmacy(p: Pharmacy | null | undefined) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    address: p.address,
    location: p.location,
    telephone: p.telephone,
    approved: p.status === PharmacyStatus.APPROVED,
  };
}

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    @InjectRepository(Clinic) private readonly clinics: Repository<Clinic>,
    @InjectRepository(ClinicStaff)
    private readonly staff: Repository<ClinicStaff>,
    @InjectRepository(DoctorProfile)
    private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    @InjectRepository(PharmacyStaff)
    private readonly pharmacyStaff: Repository<PharmacyStaff>,
    private readonly users: UsersService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────

  async directory() {
    const clinics = await this.clinics.find({
      where: { status: ClinicStatus.APPROVED },
      relations: { pharmacy: true },
      order: { name: "ASC" },
    });
    const doctors = await this.verifiedDoctorsByClinic(
      clinics.map((c) => c.id),
    );
    return clinics.map((c) => ({
      ...this.publicClinic(c),
      doctors: doctors.get(c.id) ?? [],
    }));
  }

  async one(slug: string) {
    const clinic = await this.clinics.findOne({
      where: { slug, status: ClinicStatus.APPROVED },
      relations: { pharmacy: true },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");
    const doctors = await this.verifiedDoctorsByClinic([clinic.id]);
    return {
      ...this.publicClinic(clinic),
      doctors: doctors.get(clinic.id) ?? [],
    };
  }

  private publicClinic(c: Clinic) {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      address: c.address,
      location: c.location,
      telephone: c.telephone,
      about: c.about,
      logoUrl: c.logoUrl,
      coverUrl: c.coverUrl,
      pharmacy:
        c.pharmacy?.status === PharmacyStatus.APPROVED
          ? publicPharmacy(c.pharmacy)
          : null,
    };
  }

  /** Verified doctors on active staff, grouped by clinic. */
  private async verifiedDoctorsByClinic(clinicIds: string[]) {
    const out = new Map<string, ReturnType<typeof publicDoctor>[]>();
    if (!clinicIds.length) return out;
    const members = await this.staff.find({
      where: {
        clinicId: In(clinicIds),
        active: true,
        role: In([ClinicStaffRole.DOCTOR, ClinicStaffRole.ADMIN]),
      },
    });
    if (!members.length) return out;
    const profiles = await this.doctors.find({
      where: {
        userId: In([...new Set(members.map((m) => m.userId))]),
        verificationStatus: DoctorVerificationStatus.VERIFIED,
      },
    });
    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    for (const m of members) {
      const p = byUser.get(m.userId);
      if (!p) continue;
      out.set(m.clinicId, [...(out.get(m.clinicId) ?? []), publicDoctor(p)]);
    }
    return out;
  }

  // ── Membership ──────────────────────────────────────────────────────

  async assertMember(
    userId: string,
    clinicId: string,
    roles?: ClinicStaffRole[],
  ) {
    const member = await this.staff.findOne({
      where: { userId, clinicId, active: true },
    });
    if (!member)
      throw new ForbiddenException("You are not on this clinic's staff");
    if (roles && !roles.includes(member.role))
      throw new ForbiddenException(
        roles.length === 1 && roles[0] === ClinicStaffRole.ADMIN
          ? "Only a clinic admin can do this"
          : "Your role at this clinic can't do this",
      );
    return member;
  }

  /** Clinics the caller works at, with their role and whether they can prescribe. */
  async mine(userId: string) {
    const memberships = await this.staff.find({
      where: { userId, active: true },
    });
    if (!memberships.length) return [];
    const clinics = await this.clinics
      .createQueryBuilder("c")
      .addSelect("c.licenceNumber")
      .leftJoinAndSelect("c.pharmacy", "pharmacy")
      .where("c.id IN (:...ids)", { ids: memberships.map((m) => m.clinicId) })
      .orderBy("c.name", "ASC")
      .getMany();
    const doctor = await this.doctors.findOne({ where: { userId } });
    const role = new Map(memberships.map((m) => [m.clinicId, m.role]));
    return clinics.map((c) => ({
      ...c,
      pharmacy: publicPharmacy(c.pharmacy),
      myRole: role.get(c.id)!,
      canPrescribe:
        c.status === ClinicStatus.APPROVED &&
        role.get(c.id) !== ClinicStaffRole.FRONT_DESK &&
        doctor?.verificationStatus === DoctorVerificationStatus.VERIFIED,
    }));
  }

  async getMine(userId: string, clinicId: string) {
    await this.assertMember(userId, clinicId);
    const found = (await this.mine(userId)).find((c) => c.id === clinicId);
    if (!found) throw new NotFoundException("Clinic not found");
    return found;
  }

  // ── Clinic profile ──────────────────────────────────────────────────

  async create(userId: string, dto: ClinicProfileDto) {
    const pharmacyId = dto.pharmacyId
      ? await this.attachablePharmacy(userId, dto.pharmacyId)
      : null;
    const clinic = await this.clinics.save(
      this.clinics.create({
        name: dto.name.trim(),
        slug: `${slugify(dto.name)}-${Date.now().toString(36)}`,
        address: dto.address.trim(),
        location: dto.location.trim(),
        telephone: dto.telephone.trim(),
        about: dto.about?.trim() || null,
        logoUrl: dto.logoUrl || null,
        coverUrl: dto.coverUrl || null,
        licenceNumber: dto.licenceNumber?.trim() || null,
        pharmacyId,
        status: ClinicStatus.PENDING,
      }),
    );
    await this.staff.save(
      this.staff.create({
        clinicId: clinic.id,
        userId,
        role: ClinicStaffRole.ADMIN,
        active: true,
      }),
    );
    void this.notifyAdmins(
      "admin.clinic_pending_review",
      "New clinic to verify",
      `${clinic.name} (${clinic.location}) applied to join LIBERIA360.`,
    );
    return this.getMine(userId, clinic.id);
  }

  async update(userId: string, clinicId: string, dto: ClinicProfileDto) {
    await this.assertMember(userId, clinicId, [ClinicStaffRole.ADMIN]);
    const current = await this.clinics
      .createQueryBuilder("c")
      .addSelect("c.licenceNumber")
      .where("c.id = :id", { id: clinicId })
      .getOneOrFail();
    const patch: Partial<Clinic> = {
      name: dto.name.trim(),
      address: dto.address.trim(),
      location: dto.location.trim(),
      telephone: dto.telephone.trim(),
      ...(dto.about !== undefined ? { about: dto.about?.trim() || null } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl || null } : {}),
      ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl || null } : {}),
    };
    if (dto.pharmacyId !== undefined)
      patch.pharmacyId = dto.pharmacyId
        ? dto.pharmacyId === current.pharmacyId
          ? current.pharmacyId
          : await this.attachablePharmacy(userId, dto.pharmacyId)
        : null;
    // A new licence number is unchecked evidence: back to review.
    if (
      dto.licenceNumber !== undefined &&
      (dto.licenceNumber?.trim() || null) !== current.licenceNumber
    ) {
      patch.licenceNumber = dto.licenceNumber?.trim() || null;
      if (current.status === ClinicStatus.APPROVED)
        patch.status = ClinicStatus.PENDING;
    }
    await this.clinics.update({ id: clinicId }, patch);
    return this.getMine(userId, clinicId);
  }

  /** A clinic can only attach a pharmacy its admin also manages. */
  private async attachablePharmacy(userId: string, pharmacyId: string) {
    const manager = await this.pharmacyStaff.findOne({
      where: {
        userId,
        pharmacyId,
        active: true,
        role: PharmacyStaffRole.MANAGER,
      },
    });
    if (!manager)
      throw new ForbiddenException(
        "You can only attach a pharmacy you manage on LIBERIA360",
      );
    return pharmacyId;
  }

  /** Pharmacies the caller manages, to offer in the "attached pharmacy" picker. */
  async attachablePharmacies(userId: string) {
    const managed = await this.pharmacyStaff.find({
      where: { userId, active: true, role: PharmacyStaffRole.MANAGER },
    });
    if (!managed.length) return [];
    const list = await this.pharmacies.find({
      where: { id: In(managed.map((m) => m.pharmacyId)) },
      order: { name: "ASC" },
    });
    return list.map(publicPharmacy);
  }

  // ── Staff ───────────────────────────────────────────────────────────

  async listStaff(userId: string, clinicId: string) {
    await this.assertMember(userId, clinicId);
    const members = await this.staff.find({
      where: { clinicId },
      relations: { user: true },
      order: { createdAt: "ASC" },
    });
    const profiles = await this.doctors.find({
      where: { userId: In(members.map((m) => m.userId)) },
    });
    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    return members.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? "",
      email: m.user?.email ?? "",
      role: m.role,
      active: m.active,
      doctor: byUser.has(m.userId)
        ? {
            fullName: byUser.get(m.userId)!.fullName,
            specialty: byUser.get(m.userId)!.specialty,
            verificationStatus: byUser.get(m.userId)!.verificationStatus,
          }
        : null,
    }));
  }

  async assignStaff(
    userId: string,
    clinicId: string,
    dto: AssignClinicStaffDto,
  ) {
    await this.assertMember(userId, clinicId, [ClinicStaffRole.ADMIN]);
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException("No account found for that email");
    const existing = await this.staff.findOne({
      where: { clinicId, userId: user.id },
    });
    if (
      existing?.role === ClinicStaffRole.ADMIN &&
      existing.active &&
      dto.role !== ClinicStaffRole.ADMIN &&
      (await this.activeAdmins(clinicId)) <= 1
    )
      throw new ConflictException(
        "Assign another admin before changing the clinic's only admin",
      );
    await this.staff.save(
      Object.assign(
        existing ?? this.staff.create({ clinicId, userId: user.id }),
        { role: dto.role, active: true },
      ),
    );
    if (user.id !== userId) {
      const clinic = await this.clinics.findOneByOrFail({ id: clinicId });
      void this.notify(
        user.id,
        "clinic.staff_added",
        `You've joined ${clinic.name}`,
        dto.role === ClinicStaffRole.DOCTOR
          ? "Add your Medical Council licence so you can write prescriptions."
          : `You were added as ${dto.role.replace("_", " ")}.`,
        `/account/clinic-dashboard/${clinicId}`,
      );
    }
    return this.listStaff(userId, clinicId);
  }

  async deactivateStaff(userId: string, clinicId: string, staffUserId: string) {
    await this.assertMember(userId, clinicId, [ClinicStaffRole.ADMIN]);
    const member = await this.staff.findOne({
      where: { clinicId, userId: staffUserId },
    });
    if (!member) throw new NotFoundException("Staff member not found");
    if (
      member.role === ClinicStaffRole.ADMIN &&
      member.active &&
      (await this.activeAdmins(clinicId)) <= 1
    )
      throw new ConflictException("A clinic needs at least one admin");
    await this.staff.update({ id: member.id }, { active: false });
    return this.listStaff(userId, clinicId);
  }

  private activeAdmins(clinicId: string) {
    return this.staff.count({
      where: { clinicId, role: ClinicStaffRole.ADMIN, active: true },
    });
  }

  // ── Doctor profile ──────────────────────────────────────────────────

  myDoctorProfile(userId: string) {
    return this.doctors.findOne({ where: { userId } });
  }

  async saveDoctorProfile(userId: string, dto: DoctorProfileDto) {
    const existing = await this.doctors.findOne({ where: { userId } });
    const licence = dto.licenceNumber.trim();
    const licenceChanged = !existing || existing.licenceNumber !== licence;
    const nameChanged = existing && existing.fullName !== dto.fullName.trim();
    const saved = await this.doctors.save(
      Object.assign(existing ?? this.doctors.create({ userId }), {
        fullName: dto.fullName.trim(),
        specialty: dto.specialty.trim(),
        licenceNumber: licence,
        bio: dto.bio?.trim() || null,
        photoUrl: dto.photoUrl || null,
        // A new licence or name must be checked again before prescribing.
        ...(licenceChanged || nameChanged
          ? {
              verificationStatus: DoctorVerificationStatus.PENDING,
              verifiedAt: null,
              verifiedByUserId: null,
              verificationNotes: null,
            }
          : {}),
      }),
    );
    if (licenceChanged || nameChanged)
      void this.notifyAdmins(
        "admin.doctor_pending_review",
        "Doctor licence to verify",
        `${saved.fullName} (${saved.specialty}) · licence ${saved.licenceNumber}`,
      );
    return saved;
  }

  // ── Admin ───────────────────────────────────────────────────────────

  clinicApplications() {
    return this.clinics
      .createQueryBuilder("c")
      .addSelect("c.licenceNumber")
      .leftJoinAndSelect("c.pharmacy", "pharmacy")
      .orderBy("CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END", "ASC")
      .addOrderBy("c.createdAt", "DESC")
      .getMany();
  }

  async verifyClinic(
    adminId: string,
    clinicId: string,
    dto: ClinicVerificationDto,
  ) {
    const clinic = await this.clinics.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException("Clinic not found");
    if (dto.decision === ClinicStatus.REJECTED && !dto.notes)
      throw new BadRequestException("Say why the clinic was rejected");
    await this.clinics.update(
      { id: clinicId },
      { status: dto.decision, statusNotes: dto.notes ?? null },
    );
    const admins = await this.staff.find({
      where: { clinicId, role: ClinicStaffRole.ADMIN, active: true },
    });
    for (const a of admins)
      void this.notify(
        a.userId,
        "clinic.review_decided",
        dto.decision === ClinicStatus.APPROVED
          ? `${clinic.name} is verified`
          : `${clinic.name}: ${dto.decision}`,
        dto.decision === ClinicStatus.APPROVED
          ? "Your doctors can now write e-prescriptions."
          : (dto.notes ?? "Contact LIBERIA360 support for details."),
        `/account/clinic-dashboard/${clinicId}`,
      );
    this.logger.log(`Clinic ${clinicId} -> ${dto.decision} by ${adminId}`);
    return this.clinics.findOneOrFail({ where: { id: clinicId } });
  }

  async doctorApplications() {
    const list = await this.doctors.find({
      relations: { user: true },
      order: { createdAt: "DESC" },
    });
    const memberships = await this.staff.find({
      where: { userId: In(list.map((d) => d.userId)), active: true },
      relations: { clinic: true },
    });
    return list
      .sort(
        (a, b) =>
          Number(b.verificationStatus === DoctorVerificationStatus.PENDING) -
          Number(a.verificationStatus === DoctorVerificationStatus.PENDING),
      )
      .map((d) => ({
        ...d,
        user: d.user ? { name: d.user.name, email: d.user.email } : null,
        clinics: memberships
          .filter((m) => m.userId === d.userId)
          .map((m) => ({ name: m.clinic?.name ?? "", role: m.role })),
      }));
  }

  async verifyDoctor(
    adminId: string,
    doctorId: string,
    dto: DoctorVerificationDto,
  ) {
    const doctor = await this.doctors.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException("Doctor not found");
    if (dto.decision === DoctorVerificationStatus.REJECTED && !dto.notes)
      throw new BadRequestException("Say why the licence was rejected");
    const verified = dto.decision === DoctorVerificationStatus.VERIFIED;
    await this.doctors.update(
      { id: doctorId },
      {
        verificationStatus: dto.decision,
        verificationNotes: dto.notes ?? null,
        verifiedAt: verified ? new Date() : null,
        verifiedByUserId: verified ? adminId : null,
      },
    );
    void this.notify(
      doctor.userId,
      "clinic.review_decided",
      verified ? "Your licence is verified" : "Your licence wasn't verified",
      verified
        ? "You can now write e-prescriptions for your patients."
        : (dto.notes ?? "Check your licence details and try again."),
      "/account/clinic-dashboard",
    );
    return this.doctors.findOneOrFail({ where: { id: doctorId } });
  }

  // ── Notifications (never throw) ─────────────────────────────────────

  private async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link: string,
  ) {
    try {
      await this.notifications?.create(userId, { type, title, body, link });
    } catch (error) {
      this.logger.warn(`Notification failed: ${String(error)}`);
    }
  }

  private async notifyAdmins(
    type: NotificationType,
    title: string,
    body: string,
  ) {
    try {
      const ids = await this.users.findAdminIds();
      await Promise.all(
        ids.map((id) => this.notify(id, type, title, body, "/admin/clinics")),
      );
    } catch (error) {
      this.logger.warn(`Admin notification failed: ${String(error)}`);
    }
  }
}
