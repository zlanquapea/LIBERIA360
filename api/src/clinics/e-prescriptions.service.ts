import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes, randomInt, timingSafeEqual } from "crypto";
import * as QRCode from "qrcode";
import { In, IsNull, Repository } from "typeorm";
import type { AppConfig } from "../config/configuration";
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
import {
  PharmacyInventory,
  PharmacyProduct,
} from "../pharmacies/entities/product.entity";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import {
  ClinicsService,
  publicDoctor,
  publicPharmacy,
} from "./clinics.service";
import { controlledMedicine } from "./controlled-medicines";
import { IssuePrescriptionDto } from "./dto/clinic.dto";
import { Clinic, DoctorProfile } from "./entities/clinic.entity";
import {
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
  EPrescriptionStatus,
  OPEN_PRESCRIPTION_STATUSES,
  PRESCRIPTION_VALID_DAYS,
} from "./entities/clinic.enums";
import {
  EPrescription,
  EPrescriptionItem,
} from "./entities/e-prescription.entity";

// No 0/O or 1/I: the code is read aloud and typed at the counter.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
export function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
function newCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
}
export function isExpired(
  rx: Pick<EPrescription, "status" | "expiresAt">,
  now = new Date(),
) {
  return (
    OPEN_PRESCRIPTION_STATUSES.includes(rx.status) &&
    new Date(rx.expiresAt).getTime() <= now.getTime()
  );
}

/** Why a prescription can't be dispensed or ordered, in plain words. */
export function unavailableReason(
  rx: Pick<
    EPrescription,
    "status" | "expiresAt" | "dispensedAt" | "pharmacyId"
  > & {
    pharmacy?: Pick<Pharmacy, "name"> | null;
  },
  pharmacyId?: string,
): string | null {
  const where = rx.pharmacy?.name ? ` at ${rx.pharmacy.name}` : "";
  if (rx.status === EPrescriptionStatus.DISPENSED)
    return `Already dispensed${where}${rx.dispensedAt ? ` on ${new Date(rx.dispensedAt).toDateString()}` : ""}`;
  if (rx.status === EPrescriptionStatus.CANCELLED)
    return "The doctor cancelled this prescription";
  if (rx.status === EPrescriptionStatus.ORDERED)
    return `Already ordered in the app${where}`;
  if (isExpired(rx))
    return `This prescription expired on ${new Date(rx.expiresAt).toDateString()}`;
  if (
    pharmacyId &&
    (rx.status === EPrescriptionStatus.PREPARING ||
      rx.status === EPrescriptionStatus.READY) &&
    rx.pharmacyId !== pharmacyId
  )
    return `Being prepared${where}`;
  return null;
}

type Viewer = { id: string } | undefined;

@Injectable()
export class EPrescriptionsService {
  private readonly logger = new Logger(EPrescriptionsService.name);

  constructor(
    @InjectRepository(EPrescription)
    private readonly rxRepo: Repository<EPrescription>,
    @InjectRepository(EPrescriptionItem)
    private readonly itemRepo: Repository<EPrescriptionItem>,
    @InjectRepository(Clinic) private readonly clinics: Repository<Clinic>,
    @InjectRepository(DoctorProfile)
    private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Pharmacy)
    private readonly pharmacies: Repository<Pharmacy>,
    @InjectRepository(PharmacyStaff)
    private readonly pharmacyStaff: Repository<PharmacyStaff>,
    @InjectRepository(PharmacyProduct)
    private readonly products: Repository<PharmacyProduct>,
    @InjectRepository(PharmacyInventory)
    private readonly inventory: Repository<PharmacyInventory>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly clinicsService: ClinicsService,
    private readonly users: UsersService,
    private readonly config: ConfigService<AppConfig, true>,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Serialization ───────────────────────────────────────────────────

  private verifyUrl(rx: EPrescription) {
    const base = this.config.get("webAppUrl", { infer: true });
    return `${base}/rx/${rx.code}?t=${rx.verifyToken}`;
  }

  private async qr(rx: EPrescription) {
    if (!rx.verifyToken) return null;
    try {
      return await QRCode.toDataURL(this.verifyUrl(rx), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 480,
        color: { dark: "#0f3d2e", light: "#ffffff" },
      });
    } catch (error) {
      this.logger.warn(`QR generation failed: ${String(error)}`);
      return null;
    }
  }

  private serialize(rx: EPrescription, full: boolean) {
    const items = [...(rx.items ?? [])].sort((a, b) => a.position - b.position);
    return {
      id: rx.id,
      code: formatCode(rx.code),
      status: rx.status,
      expired: isExpired(rx),
      issuedAt: rx.createdAt,
      expiresAt: rx.expiresAt,
      dispensedAt: rx.dispensedAt,
      clinic: rx.clinic
        ? {
            id: rx.clinic.id,
            name: rx.clinic.name,
            slug: rx.clinic.slug,
            address: rx.clinic.address,
            telephone: rx.clinic.telephone,
          }
        : null,
      doctor: rx.doctor ? publicDoctor(rx.doctor) : null,
      pharmacy: publicPharmacy(rx.pharmacy),
      pharmacyOrderId: full ? rx.pharmacyOrderId : null,
      patientName: full ? rx.patientName : initials(rx.patientName),
      patientAge: full ? rx.patientAge : null,
      patientPhone: full ? rx.patientPhone : null,
      hasPatientAccount: Boolean(rx.patientUserId),
      notesForPharmacist: full ? rx.notesForPharmacist : null,
      cancelledReason: rx.cancelledReason,
      itemCount: items.length,
      items: full
        ? items.map((i) => ({
            id: i.id,
            medicine: i.medicine,
            strength: i.strength,
            dosage: i.dosage,
            durationDays: i.durationDays,
            quantity: i.quantity,
            instructions: i.instructions,
            productId: i.productId,
          }))
        : [],
      full,
    };
  }

  private async withQr(rx: EPrescription) {
    return { ...this.serialize(rx, true), qrDataUrl: await this.qr(rx) };
  }

  private load(where: { id?: string; code?: string }, withToken = false) {
    const qb = this.rxRepo
      .createQueryBuilder("rx")
      .leftJoinAndSelect("rx.items", "items")
      .leftJoinAndSelect("rx.clinic", "clinic")
      .leftJoinAndSelect("rx.doctor", "doctor")
      .leftJoinAndSelect("rx.pharmacy", "pharmacy");
    if (withToken) qb.addSelect("rx.verifyToken");
    if (where.id) qb.where("rx.id = :id", { id: where.id });
    else qb.where("rx.code = :code", { code: where.code });
    return qb.getOne();
  }

  // ── Doctor ──────────────────────────────────────────────────────────

  async issue(userId: string, clinicId: string, dto: IssuePrescriptionDto) {
    await this.clinicsService.assertMember(userId, clinicId, [
      ClinicStaffRole.DOCTOR,
      ClinicStaffRole.ADMIN,
    ]);
    const clinic = await this.clinics.findOne({
      where: { id: clinicId },
      relations: { pharmacy: true },
    });
    if (!clinic || clinic.status !== ClinicStatus.APPROVED)
      throw new ForbiddenException(
        "This clinic must be verified before it can issue prescriptions",
      );
    const doctor = await this.doctors.findOne({ where: { userId } });
    if (doctor?.verificationStatus !== DoctorVerificationStatus.VERIFIED)
      throw new ForbiddenException(
        "Your Medical Council licence must be verified before you can prescribe",
      );
    for (const item of dto.items) {
      const drug = controlledMedicine(item.medicine);
      if (drug)
        throw new BadRequestException(
          `${item.medicine} is a controlled medicine. Write a paper prescription for it.`,
        );
    }
    if (dto.patientUserId && !(await this.users.findById(dto.patientUserId)))
      throw new BadRequestException("That patient account no longer exists");

    // Catalog picks must come from this clinic's attached pharmacy.
    const pickedIds = dto.items
      .map((i) => i.productId)
      .filter(Boolean) as string[];
    const validIds = new Set(
      pickedIds.length && clinic.pharmacyId
        ? (
            await this.products.find({
              where: { id: In(pickedIds), pharmacyId: clinic.pharmacyId },
              select: { id: true },
            })
          ).map((p) => p.id)
        : [],
    );

    const sendTo = dto.sendToPharmacy ? clinic.pharmacy : null;
    if (dto.sendToPharmacy && sendTo?.status !== PharmacyStatus.APPROVED)
      throw new BadRequestException(
        "This clinic has no verified pharmacy attached to send to",
      );

    let code = newCode();
    for (
      let i = 0;
      i < 5 && (await this.rxRepo.exists({ where: { code } }));
      i++
    )
      code = newCode();
    const expiresAt = new Date(
      Date.now() + PRESCRIPTION_VALID_DAYS * 86_400_000,
    );
    const saved = await this.rxRepo.save(
      this.rxRepo.create({
        code,
        verifyToken: randomBytes(16).toString("hex"),
        clinicId,
        doctorProfileId: doctor.id,
        doctorUserId: userId,
        patientUserId: dto.patientUserId ?? null,
        patientName: dto.patientName.trim(),
        patientPhone: dto.patientPhone?.trim() || null,
        patientAge: dto.patientAge ?? null,
        notesForPharmacist: dto.notesForPharmacist?.trim() || null,
        status: sendTo ? EPrescriptionStatus.SENT : EPrescriptionStatus.ISSUED,
        pharmacyId: sendTo?.id ?? null,
        expiresAt,
        items: dto.items.map((i, position) =>
          this.itemRepo.create({
            position,
            medicine: i.medicine.trim(),
            strength: i.strength?.trim() || null,
            dosage: i.dosage.trim(),
            durationDays: i.durationDays ?? null,
            quantity: i.quantity,
            instructions: i.instructions?.trim() || null,
            productId:
              i.productId && validIds.has(i.productId) ? i.productId : null,
          }),
        ),
      }),
    );
    const rx = (await this.load({ id: saved.id }, true))!;
    if (rx.patientUserId)
      void this.notify(
        rx.patientUserId,
        "prescription.issued",
        `Dr ${doctor.fullName} sent you a prescription`,
        sendTo
          ? `${sendTo.name} is getting it ready. Show code ${formatCode(rx.code)} at the counter.`
          : "Choose a pharmacy to fill it, or show the QR code at any pharmacy.",
        "/account/prescriptions",
      );
    if (sendTo) void this.notifyPharmacy(sendTo.id, rx);
    return this.withQr(rx);
  }

  async clinicPrescriptions(userId: string, clinicId: string) {
    const member = await this.clinicsService.assertMember(userId, clinicId);
    const qb = this.rxRepo
      .createQueryBuilder("rx")
      .leftJoinAndSelect("rx.items", "items")
      .leftJoinAndSelect("rx.clinic", "clinic")
      .leftJoinAndSelect("rx.doctor", "doctor")
      .leftJoinAndSelect("rx.pharmacy", "pharmacy")
      .where("rx.clinicId = :clinicId", { clinicId })
      .orderBy("rx.createdAt", "DESC")
      .take(100);
    // Doctors see their own patients; admins and the front desk see all.
    if (member.role === ClinicStaffRole.DOCTOR)
      qb.andWhere("rx.doctorUserId = :userId", { userId });
    return (await qb.getMany()).map((rx) => this.serialize(rx, true));
  }

  async clinicPrescription(userId: string, clinicId: string, rxId: string) {
    const member = await this.clinicsService.assertMember(userId, clinicId);
    const rx = await this.load({ id: rxId }, true);
    if (
      !rx ||
      rx.clinicId !== clinicId ||
      (member.role === ClinicStaffRole.DOCTOR && rx.doctorUserId !== userId)
    )
      throw new NotFoundException("Prescription not found");
    return this.withQr(rx);
  }

  async cancel(userId: string, clinicId: string, rxId: string, reason: string) {
    const member = await this.clinicsService.assertMember(userId, clinicId, [
      ClinicStaffRole.DOCTOR,
      ClinicStaffRole.ADMIN,
    ]);
    const rx = await this.load({ id: rxId });
    if (!rx || rx.clinicId !== clinicId)
      throw new NotFoundException("Prescription not found");
    if (member.role === ClinicStaffRole.DOCTOR && rx.doctorUserId !== userId)
      throw new ForbiddenException(
        "Only the prescribing doctor can cancel this",
      );
    const result = await this.rxRepo.update(
      { id: rxId, status: In(OPEN_PRESCRIPTION_STATUSES) },
      { status: EPrescriptionStatus.CANCELLED, cancelledReason: reason.trim() },
    );
    if (!result.affected)
      throw new ConflictException(
        unavailableReason(rx) ?? "This prescription can no longer be cancelled",
      );
    if (rx.patientUserId)
      void this.notify(
        rx.patientUserId,
        "prescription.updated",
        "A prescription was cancelled",
        `${rx.clinic?.name ?? "Your clinic"}: ${reason.trim()}`,
        "/account/prescriptions",
      );
    if (rx.pharmacyId)
      void this.notifyPharmacyText(
        rx.pharmacyId,
        `Prescription ${formatCode(rx.code)} cancelled`,
        `The doctor withdrew it. Don't dispense it.`,
      );
    return this.serialize((await this.load({ id: rxId }))!, true);
  }

  /** Find a patient's account by email or phone, showing as little as possible. */
  async lookupPatient(userId: string, clinicId: string, contact: string) {
    await this.clinicsService.assertMember(userId, clinicId);
    const value = contact.trim();
    let user = value.includes("@") ? await this.users.findByEmail(value) : null;
    if (!user) {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 7) {
        const tail = digits.slice(-9);
        user = await this.userRepo
          .createQueryBuilder("u")
          .where("u.phone IS NOT NULL")
          .andWhere("regexp_replace(u.phone, '[^0-9]', '', 'g') LIKE :tail", {
            tail: `%${tail}`,
          })
          .andWhere("u.deletedAt IS NULL")
          .getOne();
      }
    }
    if (!user) return null;
    return { id: user.id, name: user.name };
  }

  /** Search the attached pharmacy's shelf while prescribing. */
  async searchCatalog(userId: string, clinicId: string, q: string) {
    await this.clinicsService.assertMember(userId, clinicId);
    const clinic = await this.clinics.findOne({ where: { id: clinicId } });
    if (!clinic?.pharmacyId || q.trim().length < 2) return [];
    const products = await this.products
      .createQueryBuilder("p")
      .where("p.pharmacyId = :pid", { pid: clinic.pharmacyId })
      .andWhere("p.isVisible = true")
      .andWhere("p.name ILIKE :q", { q: `%${q.trim()}%` })
      .orderBy("p.name", "ASC")
      .take(8)
      .getMany();
    const stock = await this.stockOf(products.map((p) => p.id));
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      prescriptionRequired: p.prescriptionRequired,
      stock: stock.get(p.id) ?? 0,
    }));
  }

  private async stockOf(productIds: string[]) {
    if (!productIds.length) return new Map<string, number>();
    const rows = await this.inventory.find({
      where: { productId: In(productIds) },
    });
    return new Map(rows.map((r) => [r.productId, r.quantity]));
  }

  // ── Patient ─────────────────────────────────────────────────────────

  async patientPrescriptions(userId: string) {
    const list = await this.rxRepo
      .createQueryBuilder("rx")
      .addSelect("rx.verifyToken")
      .leftJoinAndSelect("rx.items", "items")
      .leftJoinAndSelect("rx.clinic", "clinic")
      .leftJoinAndSelect("rx.doctor", "doctor")
      .leftJoinAndSelect("rx.pharmacy", "pharmacy")
      .where("rx.patientUserId = :userId", { userId })
      .orderBy("rx.createdAt", "DESC")
      .take(50)
      .getMany();
    return Promise.all(
      list.map(async (rx) =>
        OPEN_PRESCRIPTION_STATUSES.includes(rx.status) && !isExpired(rx)
          ? this.withQr(rx)
          : { ...this.serialize(rx, true), qrDataUrl: null },
      ),
    );
  }

  private async ownedOpen(userId: string, rxId: string) {
    const rx = await this.load({ id: rxId });
    if (!rx || rx.patientUserId !== userId)
      throw new NotFoundException("Prescription not found");
    return rx;
  }

  /** The patient sends it to a pharmacy's counter queue. */
  async sendToPharmacy(userId: string, rxId: string, pharmacyId: string) {
    const rx = await this.ownedOpen(userId, rxId);
    const pharmacy = await this.pharmacies.findOne({
      where: { id: pharmacyId },
    });
    if (pharmacy?.status !== PharmacyStatus.APPROVED)
      throw new BadRequestException("That pharmacy isn't taking prescriptions");
    const result = await this.rxRepo
      .createQueryBuilder()
      .update(EPrescription)
      .set({ status: EPrescriptionStatus.SENT, pharmacyId })
      .where("id = :id", { id: rxId })
      .andWhere("status IN (:...open)", {
        open: [EPrescriptionStatus.ISSUED, EPrescriptionStatus.SENT],
      })
      .andWhere("expires_at > now()")
      .execute();
    if (!result.affected)
      throw new ConflictException(
        unavailableReason(rx, pharmacyId) ??
          "This prescription is already being prepared",
      );
    const updated = (await this.load({ id: rxId }, true))!;
    void this.notifyPharmacy(pharmacyId, updated);
    return this.withQr(updated);
  }

  /** Lines for the pharmacy's cart: the doctor's pick, else a name match. */
  async orderDraft(userId: string, rxId: string, pharmacyId: string) {
    const rx = await this.ownedOpen(userId, rxId);
    const reason = unavailableReason(rx);
    if (reason) throw new ConflictException(reason);
    if (
      rx.status !== EPrescriptionStatus.ISSUED &&
      rx.status !== EPrescriptionStatus.SENT
    )
      throw new ConflictException(
        unavailableReason(rx, pharmacyId) ?? "Already being prepared",
      );
    const pharmacy = await this.pharmacies.findOne({
      where: { id: pharmacyId },
    });
    if (pharmacy?.status !== PharmacyStatus.APPROVED)
      throw new NotFoundException("Pharmacy not found");
    const items = [...(rx.items ?? [])].sort((a, b) => a.position - b.position);
    const lines = [];
    for (const item of items) {
      let product: PharmacyProduct | null = null;
      if (item.productId)
        product = await this.products.findOne({
          where: { id: item.productId, pharmacyId, isVisible: true },
        });
      if (!product) product = await this.matchByName(pharmacyId, item.medicine);
      lines.push({ item, product });
    }
    const stock = await this.stockOf(
      lines.map((l) => l.product?.id).filter(Boolean) as string[],
    );
    return {
      prescriptionId: rx.id,
      code: formatCode(rx.code),
      doctorName: rx.doctor?.fullName ?? null,
      clinicName: rx.clinic?.name ?? null,
      pharmacyId,
      pharmacySlug: pharmacy.slug,
      lines: lines.map(({ item, product }) => ({
        medicine: [item.medicine, item.strength].filter(Boolean).join(" "),
        dosage: item.dosage,
        quantity: item.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              price: Number(product.price),
              stock: stock.get(product.id) ?? 0,
              prescriptionRequired: product.prescriptionRequired,
            }
          : null,
      })),
    };
  }

  private async matchByName(pharmacyId: string, medicine: string) {
    const words = medicine.trim().split(/\s+/);
    const tries = [medicine.trim(), words[0]].filter((t) => t.length >= 4);
    for (const term of [...new Set(tries)]) {
      const found = await this.products
        .createQueryBuilder("p")
        .where("p.pharmacyId = :pharmacyId", { pharmacyId })
        .andWhere("p.isVisible = true")
        .andWhere("p.name ILIKE :q", { q: `%${term}%` })
        .orderBy("p.name", "ASC")
        .take(5)
        .getMany();
      if (!found.length) continue;
      // Prefer one that's in stock.
      const stock = await this.stockOf(found.map((p) => p.id));
      return found.find((p) => (stock.get(p.id) ?? 0) > 0) ?? found[0];
    }
    return null;
  }

  // ── Anyone with the QR ─────────────────────────────────────────────

  /**
   * The page behind the QR code. Anyone holding the QR sees that it's
   * genuine (doctor, clinic, dates, status) but not the medicines; the
   * patient, the clinic, and pharmacy staff see everything.
   */
  async verify(codeInput: string, token: string | undefined, viewer: Viewer) {
    const rx = await this.load({ code: normalizeCode(codeInput) }, true);
    if (!rx) throw new NotFoundException("Prescription not found");
    const tokenOk = Boolean(token) && safeEqual(token!, rx.verifyToken);
    const myPharmacies = viewer ? await this.staffPharmacies(viewer.id) : [];
    const involved =
      viewer &&
      (viewer.id === rx.patientUserId ||
        viewer.id === rx.doctorUserId ||
        (await this.clinicsService
          .assertMember(viewer.id, rx.clinicId)
          .then(() => true)
          .catch(() => false)));
    const full = Boolean(involved) || (tokenOk && myPharmacies.length > 0);
    if (!full && !tokenOk)
      throw new NotFoundException("Prescription not found");
    return {
      ...this.serialize(rx, full),
      myPharmacies: myPharmacies.map((p) => ({ id: p.id, name: p.name })),
    };
  }

  private async staffPharmacies(userId: string) {
    const memberships = await this.pharmacyStaff.find({
      where: { userId, active: true },
    });
    if (!memberships.length) return [];
    return this.pharmacies.find({
      where: {
        id: In(memberships.map((m) => m.pharmacyId)),
        status: PharmacyStatus.APPROVED,
      },
    });
  }

  // ── Pharmacy counter ────────────────────────────────────────────────

  private async assertPharmacyStaff(userId: string, pharmacyId: string) {
    const member = await this.pharmacyStaff.findOne({
      where: { userId, pharmacyId, active: true },
    });
    if (!member)
      throw new ForbiddenException("You are not authorized for this pharmacy");
    const pharmacy = await this.pharmacies.findOne({
      where: { id: pharmacyId },
    });
    if (pharmacy?.status !== PharmacyStatus.APPROVED)
      throw new ForbiddenException("This pharmacy isn't verified yet");
    return { member, pharmacy };
  }

  /** A code typed (or scanned) at the counter. */
  async pharmacyLookup(userId: string, pharmacyId: string, codeInput: string) {
    await this.assertPharmacyStaff(userId, pharmacyId);
    const rx = await this.load({ code: normalizeCode(codeInput) });
    if (!rx) throw new NotFoundException("No prescription with that code");
    return {
      ...this.serialize(rx, true),
      problem: unavailableReason(rx, pharmacyId),
    };
  }

  async pharmacyQueue(userId: string, pharmacyId: string) {
    await this.assertPharmacyStaff(userId, pharmacyId);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const list = await this.rxRepo
      .createQueryBuilder("rx")
      .leftJoinAndSelect("rx.items", "items")
      .leftJoinAndSelect("rx.clinic", "clinic")
      .leftJoinAndSelect("rx.doctor", "doctor")
      .leftJoinAndSelect("rx.pharmacy", "pharmacy")
      .where("rx.pharmacyId = :pharmacyId", { pharmacyId })
      .andWhere(
        "(rx.status IN (:...open) OR (rx.status = :dispensed AND rx.dispensedAt >= :since))",
        {
          open: [
            EPrescriptionStatus.SENT,
            EPrescriptionStatus.PREPARING,
            EPrescriptionStatus.READY,
          ],
          dispensed: EPrescriptionStatus.DISPENSED,
          since,
        },
      )
      .orderBy("rx.updatedAt", "DESC")
      .take(60)
      .getMany();
    return list.map((rx) => ({
      ...this.serialize(rx, true),
      problem: unavailableReason(rx, pharmacyId),
    }));
  }

  async setCounterStatus(
    userId: string,
    pharmacyId: string,
    rxId: string,
    status: "preparing" | "ready",
  ) {
    const { pharmacy } = await this.assertPharmacyStaff(userId, pharmacyId);
    const next =
      status === "ready"
        ? EPrescriptionStatus.READY
        : EPrescriptionStatus.PREPARING;
    const from =
      next === EPrescriptionStatus.READY
        ? [EPrescriptionStatus.SENT, EPrescriptionStatus.PREPARING]
        : [EPrescriptionStatus.SENT];
    const result = await this.rxRepo
      .createQueryBuilder()
      .update(EPrescription)
      .set({ status: next })
      .where("id = :id", { id: rxId })
      .andWhere("pharmacy_id = :pharmacyId", { pharmacyId })
      .andWhere("status IN (:...from)", { from })
      .andWhere("expires_at > now()")
      .execute();
    const rx = await this.load({ id: rxId });
    if (!rx || rx.pharmacyId !== pharmacyId)
      throw new NotFoundException("Prescription not found");
    if (!result.affected)
      throw new ConflictException(
        unavailableReason(rx, pharmacyId) ?? "That step doesn't apply any more",
      );
    if (rx.patientUserId)
      void this.notify(
        rx.patientUserId,
        "prescription.updated",
        next === EPrescriptionStatus.READY
          ? `Your medicine is ready at ${pharmacy.name}`
          : `${pharmacy.name} is preparing your prescription`,
        next === EPrescriptionStatus.READY
          ? `Show code ${formatCode(rx.code)} at the counter.`
          : "We'll tell you when it's ready to collect.",
        "/account/prescriptions",
      );
    return { ...this.serialize(rx, true), problem: null };
  }

  /** The pharmacy can't fill it: give it back so the patient can go elsewhere. */
  async returnToPatient(
    userId: string,
    pharmacyId: string,
    rxId: string,
    reason?: string,
  ) {
    const { pharmacy } = await this.assertPharmacyStaff(userId, pharmacyId);
    const result = await this.rxRepo.update(
      {
        id: rxId,
        pharmacyId,
        status: In([
          EPrescriptionStatus.SENT,
          EPrescriptionStatus.PREPARING,
          EPrescriptionStatus.READY,
        ]),
      },
      { status: EPrescriptionStatus.ISSUED, pharmacyId: null },
    );
    const rx = await this.load({ id: rxId });
    if (!result.affected || !rx)
      throw new ConflictException("This prescription isn't in your queue");
    if (rx.patientUserId)
      void this.notify(
        rx.patientUserId,
        "prescription.updated",
        `${pharmacy.name} can't fill your prescription`,
        `${reason?.trim() || "They don't have everything in stock."} Choose another pharmacy.`,
        "/account/prescriptions",
      );
    return this.serialize(rx, true);
  }

  /**
   * Hand the medicine over. A prescription is dispensed once, ever: the
   * conditional update is what stops the same QR being filled twice.
   */
  async dispense(userId: string, pharmacyId: string, rxId: string) {
    const { member, pharmacy } = await this.assertPharmacyStaff(
      userId,
      pharmacyId,
    );
    if (member.role !== PharmacyStaffRole.PHARMACIST)
      throw new ForbiddenException(
        "Only a pharmacist can dispense a prescription",
      );
    const result = await this.rxRepo
      .createQueryBuilder()
      .update(EPrescription)
      .set({
        status: EPrescriptionStatus.DISPENSED,
        pharmacyId,
        dispensedAt: () => "now()",
        dispensedByUserId: userId,
      })
      .where("id = :id", { id: rxId })
      .andWhere("expires_at > now()")
      .andWhere(
        "(status IN (:...free) OR (status IN (:...held) AND pharmacy_id = :pharmacyId))",
        {
          free: [EPrescriptionStatus.ISSUED, EPrescriptionStatus.SENT],
          held: [EPrescriptionStatus.PREPARING, EPrescriptionStatus.READY],
          pharmacyId,
        },
      )
      .execute();
    const rx = await this.load({ id: rxId });
    if (!rx) throw new NotFoundException("Prescription not found");
    if (!result.affected)
      throw new ConflictException(
        unavailableReason(rx, pharmacyId) ??
          "This prescription can't be dispensed",
      );
    if (rx.patientUserId)
      void this.notify(
        rx.patientUserId,
        "prescription.updated",
        `Dispensed at ${pharmacy.name}`,
        "Take your medicine as your doctor told you. Ask the pharmacist if you're unsure.",
        "/account/prescriptions",
      );
    return {
      ...this.serialize(rx, true),
      problem: unavailableReason(rx, pharmacyId),
    };
  }

  // ── In-app pharmacy orders ──────────────────────────────────────────

  /** Checks a prescription can pay for an app order. Throws if not. */
  async usableForOrder(
    userId: string,
    rxId: string,
    repo: Repository<EPrescription> = this.rxRepo,
  ) {
    const rx = await repo.findOne({
      where: { id: rxId, patientUserId: userId },
    });
    if (!rx) throw new BadRequestException("That prescription isn't yours");
    const reason = unavailableReason(rx);
    if (reason) throw new BadRequestException(reason);
    if (
      rx.status !== EPrescriptionStatus.ISSUED &&
      rx.status !== EPrescriptionStatus.SENT
    )
      throw new BadRequestException(
        "That prescription is already being prepared",
      );
    return rx;
  }

  async attachToOrder(
    rxId: string,
    orderId: string,
    pharmacyId: string,
    repo: Repository<EPrescription> = this.rxRepo,
  ) {
    const result = await repo.update(
      {
        id: rxId,
        status: In([EPrescriptionStatus.ISSUED, EPrescriptionStatus.SENT]),
        pharmacyOrderId: IsNull(),
      },
      {
        status: EPrescriptionStatus.ORDERED,
        pharmacyOrderId: orderId,
        pharmacyId,
      },
    );
    if (!result.affected)
      throw new ConflictException(
        "This prescription was just used for another order",
      );
  }

  /** Called when an app order finishes: completed dispenses, otherwise releases. */
  async orderSettled(
    orderId: string,
    completed: boolean,
    actorUserId?: string,
  ) {
    try {
      if (completed)
        await this.rxRepo
          .createQueryBuilder()
          .update(EPrescription)
          .set({
            status: EPrescriptionStatus.DISPENSED,
            dispensedAt: () => "now()",
            dispensedByUserId: actorUserId ?? null,
          })
          .where("pharmacy_order_id = :orderId", { orderId })
          .andWhere("status = :ordered", {
            ordered: EPrescriptionStatus.ORDERED,
          })
          .execute();
      else
        await this.rxRepo.update(
          { pharmacyOrderId: orderId, status: EPrescriptionStatus.ORDERED },
          {
            status: EPrescriptionStatus.ISSUED,
            pharmacyOrderId: null,
            pharmacyId: null,
          },
        );
    } catch (error) {
      this.logger.warn(
        `Couldn't settle prescription for order ${orderId}: ${String(error)}`,
      );
    }
  }

  /** A cancelled order was restored: take the prescription back if it's still free. */
  async orderRestored(rxId: string, orderId: string, pharmacyId: string) {
    try {
      await this.rxRepo
        .createQueryBuilder()
        .update(EPrescription)
        .set({
          status: EPrescriptionStatus.ORDERED,
          pharmacyOrderId: orderId,
          pharmacyId,
        })
        .where("id = :rxId", { rxId })
        .andWhere("status IN (:...free)", {
          free: [EPrescriptionStatus.ISSUED, EPrescriptionStatus.SENT],
        })
        .andWhere("expires_at > now()")
        .execute();
    } catch (error) {
      this.logger.warn(
        `Couldn't re-attach prescription ${rxId}: ${String(error)}`,
      );
    }
  }

  /** Short labels for the orders list. */
  async summaries(ids: string[]) {
    const list = await this.rxRepo.find({ where: { id: In(ids) } });
    return new Map(
      list.map((rx) => [
        rx.id,
        {
          id: rx.id,
          code: formatCode(rx.code),
          doctorName: rx.doctor?.fullName ?? null,
          clinicName: rx.clinic?.name ?? null,
        },
      ]),
    );
  }

  // ── Notifications ───────────────────────────────────────────────────

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

  private notifyPharmacy(pharmacyId: string, rx: EPrescription) {
    const count = rx.items?.length ?? 0;
    return this.notifyPharmacyText(
      pharmacyId,
      `New prescription from ${rx.clinic?.name ?? "a clinic"}`,
      `${rx.patientName} · ${count} item${count === 1 ? "" : "s"} · code ${formatCode(rx.code)}`,
    );
  }

  private async notifyPharmacyText(
    pharmacyId: string,
    title: string,
    body: string,
  ) {
    try {
      const members = await this.pharmacyStaff.find({
        where: { pharmacyId, active: true },
      });
      await Promise.all(
        members.map((m) =>
          this.notify(
            m.userId,
            "prescription.received",
            title,
            body,
            `/account/pharmacy-dashboard/${pharmacyId}/prescriptions`,
          ),
        ),
      );
    } catch (error) {
      this.logger.warn(`Pharmacy notification failed: ${String(error)}`);
    }
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
