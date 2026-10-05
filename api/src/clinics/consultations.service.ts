import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import type { NotificationType } from "../notifications/entities/notification.entity";
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from "../uploads/storage/storage-provider.interface";
import { ClinicsService, publicDoctor } from "./clinics.service";
import {
  CompleteConsultationDto,
  DoctorConsultSettingsDto,
  RequestConsultationDto,
} from "./dto/clinic.dto";
import { Clinic, ClinicStaff, DoctorProfile } from "./entities/clinic.entity";
import {
  ClinicStaffRole,
  ClinicStatus,
  ConsultationPaymentMethod,
  ConsultationPaymentStatus,
  ConsultationStatus,
  DoctorVerificationStatus,
} from "./entities/clinic.enums";
import {
  Consultation,
  ConsultationMessage,
} from "./entities/consultation.entity";
import { EPrescription } from "./entities/e-prescription.entity";
import { EMERGENCY_MESSAGE, RED_FLAGS } from "./red-flags";

export const MAX_VOICE_NOTE_BYTES = 3 * 1024 * 1024;
const VOICE_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
];

export const CONSULT_PAYMENT_LABELS: Record<ConsultationPaymentMethod, string> =
  {
    [ConsultationPaymentMethod.MTN_MOMO]: "MTN MoMo",
    [ConsultationPaymentMethod.ORANGE_MONEY]: "Orange Money",
  };

function accountFor(clinic: Clinic, method: ConsultationPaymentMethod) {
  const n =
    method === ConsultationPaymentMethod.MTN_MOMO
      ? clinic.mtnMomoNumber
      : clinic.orangeMoneyNumber;
  return n?.trim() || null;
}

export function clinicPaymentMethods(
  clinic: Pick<Clinic, "mtnMomoNumber" | "orangeMoneyNumber">,
) {
  const methods: ConsultationPaymentMethod[] = [];
  if (clinic.mtnMomoNumber?.trim())
    methods.push(ConsultationPaymentMethod.MTN_MOMO);
  if (clinic.orangeMoneyNumber?.trim())
    methods.push(ConsultationPaymentMethod.ORANGE_MONEY);
  return methods;
}

type Role = "patient" | "doctor";

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    @InjectRepository(Consultation)
    private readonly consultations: Repository<Consultation>,
    @InjectRepository(ConsultationMessage)
    private readonly messages: Repository<ConsultationMessage>,
    @InjectRepository(DoctorProfile)
    private readonly doctors: Repository<DoctorProfile>,
    @InjectRepository(Clinic) private readonly clinics: Repository<Clinic>,
    @InjectRepository(ClinicStaff)
    private readonly staff: Repository<ClinicStaff>,
    @InjectRepository(EPrescription)
    private readonly prescriptions: Repository<EPrescription>,
    private readonly clinicsService: ClinicsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  // ── Doctors who consult online ──────────────────────────────────────

  /** Verified doctors at verified clinics who take online consultations. */
  async doctorsDirectory() {
    const list = await this.doctors
      .createQueryBuilder("d")
      .innerJoinAndSelect("d.consultClinic", "clinic")
      .innerJoin(
        ClinicStaff,
        "s",
        "s.clinic_id = clinic.id AND s.user_id = d.user_id AND s.active = true AND s.role IN (:...roles)",
        { roles: [ClinicStaffRole.DOCTOR, ClinicStaffRole.ADMIN] },
      )
      .where("d.verificationStatus = :verified", {
        verified: DoctorVerificationStatus.VERIFIED,
      })
      .andWhere("d.consultFee IS NOT NULL")
      .andWhere("clinic.status = :approved", {
        approved: ClinicStatus.APPROVED,
      })
      .orderBy("d.availableNow", "DESC")
      .addOrderBy("d.fullName", "ASC")
      .getMany();
    return list
      .filter((d) => clinicPaymentMethods(d.consultClinic!).length > 0)
      .map((d) => this.listing(d));
  }

  private listing(d: DoctorProfile) {
    const clinic = d.consultClinic!;
    return {
      ...publicDoctor(d),
      fee: Number(d.consultFee),
      availableNow: d.availableNow,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        slug: clinic.slug,
        location: clinic.location,
      },
      paymentMethods: clinicPaymentMethods(clinic).map((method) => ({
        method,
        label: CONSULT_PAYMENT_LABELS[method],
        account: accountFor(clinic, method),
      })),
    };
  }

  async doctorListing(doctorId: string) {
    const found = (await this.doctorsDirectory()).find(
      (d) => d.id === doctorId,
    );
    if (!found)
      throw new NotFoundException(
        "This doctor isn't taking online consultations",
      );
    return found;
  }

  /** A doctor turns consultations on or off, sets the fee and the clinic paid. */
  async saveConsultSettings(userId: string, dto: DoctorConsultSettingsDto) {
    const doctor = await this.doctors.findOne({ where: { userId } });
    if (!doctor) throw new BadRequestException("Add your doctor profile first");
    const offering = dto.consultFee != null;
    let clinicId: string | null = null;
    if (offering) {
      if (!dto.consultClinicId)
        throw new BadRequestException(
          "Choose the clinic patients pay for your consultations",
        );
      await this.clinicsService.assertMember(userId, dto.consultClinicId, [
        ClinicStaffRole.DOCTOR,
        ClinicStaffRole.ADMIN,
      ]);
      const clinic = await this.clinics.findOne({
        where: { id: dto.consultClinicId },
      });
      if (!clinic || clinicPaymentMethods(clinic).length === 0)
        throw new BadRequestException(
          "Ask your clinic admin to add the clinic's MTN MoMo or Orange Money number first",
        );
      clinicId = clinic.id;
    }
    await this.doctors.update(
      { id: doctor.id },
      {
        consultFee: offering ? dto.consultFee! : null,
        consultClinicId: clinicId,
        availableNow: offering ? dto.availableNow : false,
      },
    );
    return this.doctors.findOneOrFail({ where: { id: doctor.id } });
  }

  // ── Booking ─────────────────────────────────────────────────────────

  async request(
    patientId: string,
    patientName: string,
    dto: RequestConsultationDto,
  ) {
    // Safety first: any danger sign means emergency care, not a chat.
    if (dto.redFlags.length > 0)
      throw new BadRequestException(EMERGENCY_MESSAGE);
    if (!dto.noRedFlagsConfirmed)
      throw new BadRequestException(
        "Confirm that none of the emergency signs apply",
      );
    const doctor = await this.doctors.findOne({
      where: { id: dto.doctorId },
      relations: { consultClinic: true },
    });
    const listing = doctor
      ? await this.doctorListing(doctor.id).catch(() => null)
      : null;
    if (!doctor || !listing)
      throw new BadRequestException(
        "This doctor isn't taking online consultations",
      );
    if (doctor.userId === patientId)
      throw new BadRequestException(
        "You can't book a consultation with yourself",
      );
    const clinic = doctor.consultClinic!;
    const account = accountFor(clinic, dto.paymentMethod);
    if (!account)
      throw new BadRequestException(
        `${clinic.name} doesn't take ${CONSULT_PAYMENT_LABELS[dto.paymentMethod]}`,
      );
    const saved = await this.consultations
      .save(
        this.consultations.create({
          clinicId: clinic.id,
          doctorProfileId: doctor.id,
          doctorUserId: doctor.userId,
          patientUserId: patientId,
          patientName: dto.patientName?.trim() || patientName,
          patientAge: dto.patientAge ?? null,
          reason: dto.reason.trim(),
          symptomsSince: dto.symptomsSince?.trim() || null,
          triageConfirmedAt: new Date(),
          status: ConsultationStatus.REQUESTED,
          fee: Number(doctor.consultFee),
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference.trim(),
          paymentAccount: account,
          paymentStatus: ConsultationPaymentStatus.AWAITING_VERIFICATION,
        }),
      )
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === "23505")
          throw new ConflictException(
            "That transaction ID has already been used. Check it and try again.",
          );
        throw error;
      });
    const c = await this.load(saved.id);
    void this.notify(
      c.doctorUserId,
      "consultation.requested",
      `New consultation: ${c.patientName}`,
      `${preview(c.reason)} · Check ${CONSULT_PAYMENT_LABELS[c.paymentMethod]} ${c.paymentReference}`,
      "doctor",
      c.id,
    );
    return this.serialize(c, "patient");
  }

  // ── Reading ─────────────────────────────────────────────────────────

  private load(id: string) {
    return this.consultations.findOneOrFail({ where: { id } });
  }

  /** The consultation and which side the caller is on; 404 for anyone else. */
  private async participant(
    userId: string,
    id: string,
  ): Promise<{ c: Consultation; role: Role }> {
    const c = await this.consultations.findOne({ where: { id } });
    if (c?.patientUserId === userId) return { c, role: "patient" };
    if (c?.doctorUserId === userId) return { c, role: "doctor" };
    throw new NotFoundException("Consultation not found");
  }

  private async asDoctor(userId: string, id: string) {
    const { c, role } = await this.participant(userId, id);
    if (role !== "doctor")
      throw new ForbiddenException("Only the doctor can do this");
    return c;
  }

  private async asPatient(userId: string, id: string) {
    const { c, role } = await this.participant(userId, id);
    if (role !== "patient")
      throw new ForbiddenException("Only the patient can do this");
    return c;
  }

  private async unreadFor(ids: string[], role: Role) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.messages
      .createQueryBuilder("m")
      .select("m.consultationId", "id")
      .addSelect("COUNT(*)", "count")
      .where("m.consultationId IN (:...ids)", { ids })
      .andWhere("m.readAt IS NULL")
      .andWhere("m.fromDoctor = :fromOther", { fromOther: role === "patient" })
      .groupBy("m.consultationId")
      .getRawMany<{ id: string; count: string }>();
    return new Map(rows.map((r) => [r.id, Number(r.count)]));
  }

  private async prescriptionCodes(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.prescriptions.find({
      where: { id: In(ids) },
      select: { id: true, code: true },
    });
    return new Map(
      rows.map((r) => [r.id, `${r.code.slice(0, 4)}-${r.code.slice(4)}`]),
    );
  }

  private serialize(
    c: Consultation,
    role: Role,
    unread = 0,
    rxCode: string | null = null,
  ) {
    return {
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      acceptedAt: c.acceptedAt,
      completedAt: c.completedAt,
      patientName: c.patientName,
      patientAge: c.patientAge,
      reason: c.reason,
      symptomsSince: c.symptomsSince,
      fee: Number(c.fee),
      paymentMethod: c.paymentMethod,
      paymentReference: c.paymentReference,
      paymentAccount: c.paymentAccount,
      paymentStatus: c.paymentStatus,
      outcome: c.outcome,
      summary: c.summary,
      declineReason: c.declineReason,
      ePrescriptionId: c.ePrescriptionId,
      ePrescriptionCode: rxCode,
      doctor: c.doctor ? publicDoctor(c.doctor) : null,
      clinic: c.clinic
        ? {
            id: c.clinic.id,
            name: c.clinic.name,
            slug: c.clinic.slug,
            telephone: c.clinic.telephone,
            address: c.clinic.address,
          }
        : null,
      viewerRole: role,
      unreadMessages: unread,
    };
  }

  private async serializeMany(list: Consultation[], role: Role) {
    const unread = await this.unreadFor(
      list.map((c) => c.id),
      role,
    );
    const codes = await this.prescriptionCodes(
      list.map((c) => c.ePrescriptionId).filter(Boolean) as string[],
    );
    return list.map((c) =>
      this.serialize(
        c,
        role,
        unread.get(c.id) ?? 0,
        c.ePrescriptionId ? (codes.get(c.ePrescriptionId) ?? null) : null,
      ),
    );
  }

  async mine(patientId: string) {
    const list = await this.consultations.find({
      where: { patientUserId: patientId },
      order: { createdAt: "DESC" },
      take: 50,
    });
    return this.serializeMany(list, "patient");
  }

  async inbox(doctorUserId: string) {
    const list = await this.consultations.find({
      where: { doctorUserId },
      order: { createdAt: "DESC" },
      take: 100,
    });
    return this.serializeMany(list, "doctor");
  }

  async get(userId: string, id: string) {
    const { c, role } = await this.participant(userId, id);
    return (await this.serializeMany([c], role))[0];
  }

  // ── Changes ─────────────────────────────────────────────────────────

  /** Conditional update; throws a plain-words conflict if the state moved on. */
  private async move(
    c: Consultation,
    from: {
      status?: ConsultationStatus[];
      payment?: ConsultationPaymentStatus[];
    },
    patch: Partial<Consultation>,
    conflict: string,
  ) {
    const result = await this.consultations.update(
      {
        id: c.id,
        ...(from.status ? { status: In(from.status) } : {}),
        ...(from.payment ? { paymentStatus: In(from.payment) } : {}),
      },
      patch,
    );
    if (!result.affected) throw new ConflictException(conflict);
    return this.load(c.id);
  }

  async cancel(patientId: string, id: string) {
    const c = await this.asPatient(patientId, id);
    const updated = await this.move(
      c,
      { status: [ConsultationStatus.REQUESTED] },
      {
        status: ConsultationStatus.CANCELLED,
        paymentStatus:
          c.paymentStatus === ConsultationPaymentStatus.FAILED
            ? ConsultationPaymentStatus.FAILED
            : ConsultationPaymentStatus.REFUND_DUE,
      },
      "The doctor has already started this consultation. Message them instead.",
    );
    void this.notify(
      c.doctorUserId,
      "consultation.updated",
      `${c.patientName} cancelled`,
      updated.paymentStatus === ConsultationPaymentStatus.REFUND_DUE
        ? `Refund ${lrd(c.fee)} by ${CONSULT_PAYMENT_LABELS[c.paymentMethod]}.`
        : "No payment was received.",
      "doctor",
      c.id,
    );
    return (await this.serializeMany([updated], "patient"))[0];
  }

  /** The patient sends a new transaction ID after "payment not found". */
  async resubmitPayment(patientId: string, id: string, reference: string) {
    const c = await this.asPatient(patientId, id);
    const updated = await this.move(
      c,
      {
        status: [ConsultationStatus.REQUESTED],
        payment: [ConsultationPaymentStatus.FAILED],
      },
      {
        paymentReference: reference.trim(),
        paymentStatus: ConsultationPaymentStatus.AWAITING_VERIFICATION,
      },
      "There's no payment to resend for this consultation",
    ).catch((error: unknown) => {
      if ((error as { code?: string }).code === "23505")
        throw new ConflictException(
          "That transaction ID has already been used",
        );
      throw error;
    });
    void this.notify(
      c.doctorUserId,
      "consultation.updated",
      `${c.patientName} sent a new payment`,
      `Check ${CONSULT_PAYMENT_LABELS[c.paymentMethod]} ${updated.paymentReference}.`,
      "doctor",
      c.id,
    );
    return (await this.serializeMany([updated], "patient"))[0];
  }

  /** The doctor confirms the money arrived (which starts the consult) or not. */
  async verifyPayment(doctorUserId: string, id: string, received: boolean) {
    const c = await this.asDoctor(doctorUserId, id);
    const updated = await this.move(
      c,
      {
        status: [ConsultationStatus.REQUESTED],
        payment: [ConsultationPaymentStatus.AWAITING_VERIFICATION],
      },
      received
        ? {
            paymentStatus: ConsultationPaymentStatus.PAID,
            status: ConsultationStatus.ACTIVE,
            acceptedAt: new Date(),
          }
        : { paymentStatus: ConsultationPaymentStatus.FAILED },
      "This payment has already been checked",
    );
    void this.notify(
      c.patientUserId,
      "consultation.updated",
      received
        ? `${c.doctor?.fullName ? `Dr ${c.doctor.fullName}` : "Your doctor"} has started your consultation`
        : "Your payment wasn't found",
      received
        ? "Open it to chat or send a voice note."
        : `Check your ${CONSULT_PAYMENT_LABELS[c.paymentMethod]} transaction ID and send it again.`,
      "patient",
      c.id,
    );
    return (await this.serializeMany([updated], "doctor"))[0];
  }

  async decline(doctorUserId: string, id: string, reason: string) {
    const c = await this.asDoctor(doctorUserId, id);
    const updated = await this.move(
      c,
      { status: [ConsultationStatus.REQUESTED] },
      {
        status: ConsultationStatus.DECLINED,
        declineReason: reason.trim(),
        paymentStatus:
          c.paymentStatus === ConsultationPaymentStatus.FAILED
            ? ConsultationPaymentStatus.FAILED
            : ConsultationPaymentStatus.REFUND_DUE,
      },
      "Only a waiting consultation can be declined",
    );
    void this.notify(
      c.patientUserId,
      "consultation.updated",
      "Your doctor couldn't take this consultation",
      `${reason.trim()}${updated.paymentStatus === ConsultationPaymentStatus.REFUND_DUE ? " Your payment will be refunded." : ""}`,
      "patient",
      c.id,
    );
    return (await this.serializeMany([updated], "doctor"))[0];
  }

  async complete(
    doctorUserId: string,
    id: string,
    dto: CompleteConsultationDto,
  ) {
    const c = await this.asDoctor(doctorUserId, id);
    const updated = await this.move(
      c,
      { status: [ConsultationStatus.ACTIVE] },
      {
        status: ConsultationStatus.COMPLETED,
        outcome: dto.outcome,
        summary: dto.summary.trim(),
        completedAt: new Date(),
      },
      "Only an open consultation can be completed",
    );
    void this.notify(
      c.patientUserId,
      "consultation.updated",
      "Your consultation is complete",
      "Read your doctor's advice in the app.",
      "patient",
      c.id,
    );
    return (await this.serializeMany([updated], "doctor"))[0];
  }

  async markRefunded(doctorUserId: string, id: string) {
    const c = await this.asDoctor(doctorUserId, id);
    const updated = await this.move(
      c,
      { payment: [ConsultationPaymentStatus.REFUND_DUE] },
      { paymentStatus: ConsultationPaymentStatus.REFUNDED },
      "No refund is due on this consultation",
    );
    void this.notify(
      c.patientUserId,
      "consultation.updated",
      "Your consultation fee was refunded",
      `${lrd(c.fee)} was sent back by ${CONSULT_PAYMENT_LABELS[c.paymentMethod]}.`,
      "patient",
      c.id,
    );
    return (await this.serializeMany([updated], "doctor"))[0];
  }

  /** Called when the doctor writes a prescription from the consultation. */
  async attachPrescription(
    consultationId: string,
    doctorUserId: string,
    rxId: string,
  ) {
    await this.consultations.update(
      { id: consultationId, doctorUserId },
      { ePrescriptionId: rxId },
    );
  }

  /** The patient a prescription written from this consultation is for. */
  async patientForPrescription(doctorUserId: string, consultationId: string) {
    const c = await this.consultations.findOne({
      where: { id: consultationId },
    });
    if (!c || c.doctorUserId !== doctorUserId)
      throw new NotFoundException("Consultation not found");
    if (
      c.status !== ConsultationStatus.ACTIVE &&
      c.status !== ConsultationStatus.COMPLETED
    )
      throw new ConflictException(
        "Start the consultation before writing a prescription",
      );
    return c;
  }

  // ── Messages ────────────────────────────────────────────────────────

  private open(c: Consultation) {
    return (
      c.status === ConsultationStatus.REQUESTED ||
      c.status === ConsultationStatus.ACTIVE
    );
  }

  async listMessages(userId: string, id: string) {
    const { c, role } = await this.participant(userId, id);
    await this.messages.update(
      {
        consultationId: c.id,
        fromDoctor: role === "patient",
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
    const rows = await this.messages.find({
      where: { consultationId: c.id },
      order: { createdAt: "ASC" },
    });
    return rows.map((m) => this.message(m, role));
  }

  private message(m: ConsultationMessage, role: Role) {
    return {
      id: m.id,
      body: m.body,
      fromDoctor: m.fromDoctor,
      mine: role === "doctor" ? m.fromDoctor : !m.fromDoctor,
      voice: m.voiceMime
        ? { seconds: m.voiceSeconds, mimeType: m.voiceMime }
        : null,
      createdAt: m.createdAt,
      readAt: m.readAt,
    };
  }

  async sendMessage(userId: string, id: string, body: string) {
    const { c, role } = await this.participant(userId, id);
    if (!this.open(c))
      throw new ConflictException("This consultation is closed");
    const saved = await this.messages.save(
      this.messages.create({
        consultationId: c.id,
        senderUserId: userId,
        fromDoctor: role === "doctor",
        body: body.trim(),
      }),
    );
    this.notifyMessage(c, role, preview(body));
    return this.message(saved, role);
  }

  async sendVoice(
    userId: string,
    id: string,
    file: { buffer: Buffer; mimeType: string },
    seconds: number,
  ) {
    const { c, role } = await this.participant(userId, id);
    if (!this.open(c))
      throw new ConflictException("This consultation is closed");
    const mime = file.mimeType.split(";")[0].trim().toLowerCase();
    if (!VOICE_MIME_TYPES.includes(mime))
      throw new BadRequestException("That isn't a voice recording we can play");
    if (file.buffer.length > MAX_VOICE_NOTE_BYTES)
      throw new BadRequestException("Voice notes can be up to 3 minutes");
    const { key } = await this.storage.savePrivate({
      buffer: file.buffer,
      filename: `consultations/${c.id}/${randomUUID()}.${mime.split("/")[1].replace("x-", "")}`,
      contentType: mime,
    });
    const saved = await this.messages.save(
      this.messages.create({
        consultationId: c.id,
        senderUserId: userId,
        fromDoctor: role === "doctor",
        body: null,
        voiceKey: key,
        voiceMime: mime,
        voiceSeconds: seconds,
      }),
    );
    this.notifyMessage(c, role, `Voice note (${seconds}s)`);
    return this.message(saved, role);
  }

  async voice(userId: string, messageId: string) {
    const m = await this.messages
      .createQueryBuilder("m")
      .addSelect("m.voiceKey")
      .where("m.id = :id", { id: messageId })
      .getOne();
    if (!m?.voiceKey) throw new NotFoundException("Voice note not found");
    await this.participant(userId, m.consultationId);
    const { buffer } = await this.storage.readPrivate(m.voiceKey);
    return { buffer, mimeType: m.voiceMime ?? "audio/webm" };
  }

  private notifyMessage(c: Consultation, from: Role, text: string) {
    const to = from === "doctor" ? c.patientUserId : c.doctorUserId;
    void this.notify(
      to,
      "consultation_message.received",
      from === "doctor"
        ? `Dr ${c.doctor?.fullName ?? ""}`.trim()
        : c.patientName,
      text,
      from === "doctor" ? "patient" : "doctor",
      c.id,
    );
  }

  // ── Notifications ───────────────────────────────────────────────────

  private async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    audience: Role,
    consultationId?: string,
  ) {
    try {
      await this.notifications?.create(userId, {
        type,
        title,
        body,
        link:
          audience === "patient"
            ? `/account/consultations${consultationId ? `/${consultationId}` : ""}`
            : `/account/clinic-dashboard/consultations${consultationId ? `/${consultationId}` : ""}`,
      });
    } catch (error) {
      this.logger.warn(`Notification failed: ${String(error)}`);
    }
  }
}

function preview(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

function lrd(amount: number | string) {
  return `L$${Number(amount).toFixed(2)}`;
}

export { RED_FLAGS };
