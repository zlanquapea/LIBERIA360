import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ConsultationOutcome,
  ConsultationPaymentMethod,
  ClinicStaffRole,
  ClinicStatus,
  DoctorVerificationStatus,
} from "../entities/clinic.enums";

const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const PHONE_MESSAGE = { message: "Enter a valid phone number" };

export class ClinicProfileDto {
  @IsString() @Length(2, 160) name: string;
  @IsString() @Length(4, 240) address: string;
  @IsString() @Length(2, 80) location: string;
  @IsString() @Matches(PHONE_PATTERN, PHONE_MESSAGE) telephone: string;
  @IsOptional() @IsString() @Length(0, 2000) about?: string | null;
  @IsOptional() @IsString() @Length(0, 500) logoUrl?: string | null;
  @IsOptional() @IsString() @Length(0, 500) coverUrl?: string | null;
  @IsOptional() @IsString() @Length(2, 120) licenceNumber?: string;
  // Attach the pharmacy this clinic sends prescriptions to. The caller must
  // manage that pharmacy. null detaches it.
  @IsOptional() @IsUUID() pharmacyId?: string | null;
  // Where patients pay online-consultation fees. null clears.
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, PHONE_MESSAGE)
  mtnMomoNumber?: string | null;
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, PHONE_MESSAGE)
  orangeMoneyNumber?: string | null;
}

export class AssignClinicStaffDto {
  @IsEmail() email: string;
  @IsEnum(ClinicStaffRole) role: ClinicStaffRole;
}

export class ClinicVerificationDto {
  @IsEnum(ClinicStatus) decision: ClinicStatus;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}

export class DoctorProfileDto {
  @IsString() @Length(3, 150) fullName: string;
  @IsString() @Length(2, 120) specialty: string;
  @IsString() @Length(3, 80) licenceNumber: string;
  @IsOptional() @IsString() @Length(0, 1500) bio?: string | null;
  @IsOptional() @IsString() @Length(0, 500) photoUrl?: string | null;
}

export class DoctorVerificationDto {
  @IsEnum(DoctorVerificationStatus) decision: DoctorVerificationStatus;
  @IsOptional() @IsString() @Length(2, 1000) notes?: string;
}

export class PrescriptionItemDto {
  @IsString() @Length(2, 180) medicine: string;
  @IsOptional() @IsString() @Length(0, 60) strength?: string;
  @IsString() @Length(2, 160) dosage: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
  @IsOptional() @IsString() @Length(0, 300) instructions?: string;
  @IsOptional() @IsUUID() productId?: string;
}

export class IssuePrescriptionDto {
  // The patient's LIBERIA360 account, found with the patient lookup. Leave
  // it out for a patient without an account: they get the printed QR.
  @IsOptional() @IsUUID() patientUserId?: string;
  @IsString() @Length(2, 150) patientName: string;
  @IsOptional()
  @IsString()
  @Matches(PHONE_PATTERN, PHONE_MESSAGE)
  patientPhone?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  patientAge?: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
  @IsOptional() @IsString() @Length(0, 1000) notesForPharmacist?: string;
  // Send straight to the clinic's attached pharmacy so it's packed while the
  // patient walks over.
  @IsOptional() @IsBoolean() sendToPharmacy?: boolean;
  // Written during an online consultation: the patient comes from it.
  @IsOptional() @IsUUID() consultationId?: string;
}

export class CancelPrescriptionDto {
  @IsString() @Length(3, 500) reason: string;
}

export class PatientLookupDto {
  @IsString() @Length(3, 255) contact: string;
}

export class SendPrescriptionDto {
  @IsUUID() pharmacyId: string;
}

export class PrescriptionCodeDto {
  @IsString() @Length(6, 20) code: string;
}

export class CounterStatusDto {
  @IsIn(["preparing", "ready"]) status: "preparing" | "ready";
}

export class DoctorConsultSettingsDto {
  // null (or omitted) means the doctor doesn't take online consultations.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  consultFee?: number | null;
  @IsOptional() @IsUUID() consultClinicId?: string | null;
  @IsBoolean() availableNow: boolean;
}

export class RequestConsultationDto {
  @IsUUID() doctorId: string;
  @IsOptional() @IsString() @Length(2, 150) patientName?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(130)
  patientAge?: number;
  @IsString() @Length(10, 2000) reason: string;
  @IsOptional() @IsString() @Length(1, 60) symptomsSince?: string;
  // The emergency signs the patient ticked. Any one stops the booking.
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) redFlags: string[];
  @IsBoolean() noRedFlagsConfirmed: boolean;
  @IsEnum(ConsultationPaymentMethod) paymentMethod: ConsultationPaymentMethod;
  @IsString() @Length(4, 80) paymentReference: string;
}

export class ConsultationPaymentDto {
  @IsString() @Length(4, 80) paymentReference: string;
}

export class VerifyConsultationPaymentDto {
  @IsBoolean() received: boolean;
}

export class DeclineConsultationDto {
  @IsString() @Length(3, 500) reason: string;
}

export class CompleteConsultationDto {
  @IsEnum(ConsultationOutcome) outcome: ConsultationOutcome;
  @IsString() @Length(5, 3000) summary: string;
}

export class ConsultationMessageDto {
  @IsString() @Length(1, 2000) body: string;
}

export class VoiceNoteDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(180) seconds: number;
}
