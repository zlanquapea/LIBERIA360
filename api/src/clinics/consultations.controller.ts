import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  ConsultationsService,
  MAX_VOICE_NOTE_BYTES,
} from "./consultations.service";
import {
  CompleteConsultationDto,
  ConsultationMessageDto,
  ConsultationPaymentDto,
  DeclineConsultationDto,
  RequestConsultationDto,
  VerifyConsultationPaymentDto,
  VoiceNoteDto,
} from "./dto/clinic.dto";

const uuid = new ParseUUIDPipe();

@ApiTags("Consultations")
@Controller("consultations")
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  // Public: who can I consult online right now?
  @Get("doctors") doctors() {
    return this.consultations.doctorsDirectory();
  }
  @Get("doctors/:doctorId") doctor(@Param("doctorId", uuid) doctorId: string) {
    return this.consultations.doctorListing(doctorId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  request(@CurrentUser() u: User, @Body() dto: RequestConsultationDto) {
    return this.consultations.request(u.id, u.name, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("mine")
  mine(@CurrentUser() u: User) {
    return this.consultations.mine(u.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("inbox")
  inbox(@CurrentUser() u: User) {
    return this.consultations.inbox(u.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("messages/:messageId/voice")
  async voice(
    @CurrentUser() u: User,
    @Param("messageId", uuid) messageId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, mimeType } = await this.consultations.voice(
      u.id,
      messageId,
    );
    res.set({ "Content-Type": mimeType, "Cache-Control": "private, no-store" });
    return new StreamableFile(buffer);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(":id")
  one(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.consultations.get(u.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/cancel")
  cancel(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.consultations.cancel(u.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/payment")
  resubmit(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ConsultationPaymentDto,
  ) {
    return this.consultations.resubmitPayment(u.id, id, dto.paymentReference);
  }

  // ── The doctor ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(":id/payment")
  verify(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: VerifyConsultationPaymentDto,
  ) {
    return this.consultations.verifyPayment(u.id, id, dto.received);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/decline")
  decline(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: DeclineConsultationDto,
  ) {
    return this.consultations.decline(u.id, id, dto.reason);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/complete")
  complete(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: CompleteConsultationDto,
  ) {
    return this.consultations.complete(u.id, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(":id/refunded")
  refunded(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.consultations.markRefunded(u.id, id);
  }

  // ── Messages ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(":id/messages")
  messages(@CurrentUser() u: User, @Param("id", uuid) id: string) {
    return this.consultations.listMessages(u.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/messages")
  send(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: ConsultationMessageDto,
  ) {
    return this.consultations.sendMessage(u.id, id, dto.body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(":id/voice")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_VOICE_NOTE_BYTES },
    }),
  )
  sendVoice(
    @CurrentUser() u: User,
    @Param("id", uuid) id: string,
    @Body() dto: VoiceNoteDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Attach the recording as "file"');
    return this.consultations.sendVoice(
      u.id,
      id,
      { buffer: file.buffer, mimeType: file.mimetype },
      dto.seconds,
    );
  }
}
