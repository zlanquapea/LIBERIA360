import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { STORAGE_PROVIDER } from "../uploads/storage/storage-provider.interface";
import type { StorageProvider } from "../uploads/storage/storage-provider.interface";
import { NotificationsService } from "../notifications/notifications.service";
import { County } from "../counties/entities/county.entity";
import { GuideProfile } from "./entities/guide-profile.entity";
import { Experience } from "./entities/experience.entity";
import { GuideBooking } from "./entities/guide-booking.entity";
import { GuideReview } from "./entities/guide-review.entity";
import { GuideMessage } from "./entities/guide-message.entity";
import {
  ExperienceStatus,
  GuideBookingStatus,
  GuidePaymentStatus,
  GuideVerificationStatus,
} from "./entities/guide.enums";
import {
  ApplyGuideDto,
  CreateExperienceDto,
  CreateGuideBookingDto,
  CreateGuideReviewDto,
  CreatePublicGuideReviewDto,
  QueryGuidesDto,
  RespondGuideBookingDto,
  SetGuideVerificationDto,
  UpdateExperienceDto,
  UpdateGuideProfileDto,
  UpdateGuideProfileImageDto,
} from "./guides.dto";
import { SendGuideMessageDto } from "./dto/guide-message.dto";
import { normalizePhoneOrThrow } from "../common/phone";

const BOOKINGS_LINK = "/account/bookings";

@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(GuideProfile)
    private readonly guideRepo: Repository<GuideProfile>,
    @InjectRepository(Experience)
    private readonly experienceRepo: Repository<Experience>,
    @InjectRepository(GuideBooking)
    private readonly bookingRepo: Repository<GuideBooking>,
    @InjectRepository(GuideReview)
    private readonly reviewRepo: Repository<GuideReview>,
    @InjectRepository(GuideMessage)
    private readonly messageRepo: Repository<GuideMessage>,
    @InjectRepository(County)
    private readonly countyRepo: Repository<County>,
    private readonly notificationsService: NotificationsService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async listGuides(query: QueryGuidesDto) {
    const qb = this.guideRepo
      .createQueryBuilder("guide")
      .leftJoinAndSelect("guide.user", "user")
      .leftJoinAndSelect("guide.county", "county")
      .where("guide.verification_status = :status", {
        status: GuideVerificationStatus.VERIFIED,
      })
      .orderBy("guide.created_at", "DESC");
    if (query.search) {
      qb.andWhere(
        "(guide.slug ILIKE :search OR guide.bio ILIKE :search OR guide.city ILIKE :search)",
        {
          search: `%${query.search}%`,
        },
      );
    }
    if (query.county)
      qb.andWhere("guide.county_id = :county", { county: query.county });
    if (query.language)
      qb.andWhere(":language = ANY(guide.languages)", {
        language: query.language,
      });
    const guides = await qb.getMany();
    return Promise.all(guides.map((guide) => this.publicGuide(guide)));
  }

  async findGuide(slug: string) {
    const guide = await this.guideRepo.findOne({
      where: { slug, verificationStatus: GuideVerificationStatus.VERIFIED },
    });
    if (!guide) throw new NotFoundException(`Guide "${slug}" not found`);
    return this.publicGuide(guide);
  }

  async findMyProfile(userId: string) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    return this.publicGuide(guide);
  }

  async updateMine(userId: string, dto: UpdateGuideProfileImageDto) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    guide.profileImageUrl = dto.profileImageUrl ?? null;
    return this.publicGuide(await this.guideRepo.save(guide));
  }

  async updateMyDetails(userId: string, dto: UpdateGuideProfileDto) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    const slugExists = await this.guideRepo.exists({
      where: { slug: dto.slug },
    });
    if (slugExists && guide.slug !== dto.slug) {
      throw new ConflictException("That guide URL is already in use");
    }
    if (
      dto.countyId &&
      !(await this.countyRepo.exists({ where: { id: dto.countyId } }))
    ) {
      throw new BadRequestException("The selected county does not exist");
    }
    Object.assign(guide, {
      ...dto,
      countyId: dto.countyId ?? null,
      ltaLicenseNumber: dto.ltaLicenseNumber ?? null,
      whatsappNumber: normalizePhoneOrThrow(
        dto.whatsappNumber,
        "WhatsApp number",
      ),
    });
    return this.publicGuide(await this.guideRepo.save(guide));
  }

  async listExperiences(query: {
    search?: string;
    category?: string;
    county?: string;
  }) {
    const where: Record<string, unknown> = {
      status: ExperienceStatus.PUBLISHED,
    };
    if (query.category) where.category = query.category;
    if (query.county) where.county = query.county;
    const experiences = await this.experienceRepo.find({
      where,
      order: { isFeatured: "DESC", createdAt: "DESC" },
    });
    const filtered = query.search
      ? experiences.filter((item) =>
          `${item.title} ${item.description} ${item.county}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        )
      : experiences;
    return Promise.all(
      filtered.map((experience) => this.publicExperience(experience)),
    );
  }

  async findExperience(id: string) {
    if (!isUuid(id)) throw new BadRequestException("Invalid experience id");
    const experience = await this.experienceRepo.findOne({
      where: { id, status: ExperienceStatus.PUBLISHED },
    });
    if (!experience)
      throw new NotFoundException(`Experience "${id}" not found`);
    return this.publicExperience(experience);
  }

  async getMyExperiences(userId: string) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    const experiences = await this.experienceRepo.find({
      where: { guideId: guide.id },
      order: { createdAt: "DESC" },
    });
    return Promise.all(
      experiences.map((experience) => this.publicExperience(experience)),
    );
  }

  async updateExperience(userId: string, id: string, dto: UpdateExperienceDto) {
    if (!isUuid(id)) throw new BadRequestException("Invalid experience id");
    const experience = await this.experienceRepo.findOne({ where: { id } });
    if (!experience) throw new NotFoundException("Experience not found");
    if (experience.guide.userId !== userId) {
      throw new ForbiddenException("Only the guide can edit this experience");
    }
    if (dto.isFeatured) {
      await this.experienceRepo.update(
        { guideId: experience.guideId },
        { isFeatured: false },
      );
    }
    Object.assign(experience, dto);
    return this.publicExperience(await this.experienceRepo.save(experience));
  }

  async getGuideReviews(guideId: string) {
    const reviews = await this.reviewRepo.find({
      where: { guideId },
      order: { createdAt: "DESC" },
    });
    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.traveler
        ? { id: review.traveler.id, name: review.traveler.name }
        : null,
    }));
  }

  async createPublicReview(
    userId: string,
    guideId: string,
    dto: CreatePublicGuideReviewDto,
  ) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (
      !guide ||
      guide.verificationStatus !== GuideVerificationStatus.VERIFIED
    ) {
      throw new NotFoundException("Guide profile not found");
    }
    if (guide.userId === userId) {
      throw new ForbiddenException("You cannot review your own guide profile");
    }
    const alreadyReviewed = await this.reviewRepo.exists({
      where: { guideId, travelerId: userId },
    });
    if (alreadyReviewed)
      throw new ConflictException("You already reviewed this guide");
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        bookingId: null,
        travelerId: userId,
        guideId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      }),
    );
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.traveler
        ? { id: review.traveler.id, name: review.traveler.name }
        : null,
    };
  }

  async getGuideMessages(userId: string, guideId: string) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    const visitorId = guide.userId === userId ? undefined : userId;
    const messagesQuery = this.messageRepo
      .createQueryBuilder("message")
      .where("message.guide_id = :guideId", { guideId });
    if (visitorId) {
      messagesQuery.andWhere("message.visitor_id = :visitorId", {
        visitorId,
      });
    }
    const messages = await messagesQuery
      .orderBy("message.created_at", "ASC")
      .getMany();
    if (messages.length) {
      await this.messageRepo
        .createQueryBuilder()
        .update(GuideMessage)
        .set({ readAt: new Date() })
        .where("guide_id = :guideId", { guideId })
        .andWhere("sender_id != :userId", { userId })
        .andWhere("read_at IS NULL")
        .execute();
    }
    return messages.map((message) => this.publicMessage(message));
  }

  async getMyGuideConversations(userId: string) {
    const ownedGuides = await this.guideRepo.find({ where: { userId } });
    const ownedGuideIds = ownedGuides.map((guide) => guide.id);
    const messages = await this.messageRepo
      .createQueryBuilder("message")
      .leftJoinAndSelect("message.guide", "guide")
      .leftJoinAndSelect("message.visitor", "visitor")
      .leftJoinAndSelect("message.sender", "sender")
      .where("message.visitor_id = :userId", { userId })
      .orWhere(
        ownedGuideIds.length
          ? "message.guide_id IN (:...ownedGuideIds)"
          : "1 = 0",
        { ownedGuideIds },
      )
      .orderBy("message.created_at", "DESC")
      .getMany();
    const conversations = new Map<string, GuideMessage>();
    for (const message of messages) {
      const key = `${message.guideId}:${message.visitorId}`;
      if (!conversations.has(key)) conversations.set(key, message);
    }
    return [...conversations.values()].map((message) => ({
      guide: {
        id: message.guide.id,
        slug: message.guide.slug,
        profileImageUrl: message.guide.profileImageUrl,
      },
      visitor: message.visitor
        ? { id: message.visitor.id, name: message.visitor.name }
        : null,
      lastMessage: this.publicMessage(message),
      unread: message.senderId !== userId && !message.readAt,
    }));
  }

  async getMyGuideUnreadCount(userId: string) {
    const ownedGuides = await this.guideRepo.find({ where: { userId } });
    const ownedGuideIds = ownedGuides.map((guide) => guide.id);
    const query = this.messageRepo
      .createQueryBuilder("message")
      .where("message.read_at IS NULL")
      .andWhere("message.sender_id != :userId", { userId })
      .andWhere(
        ownedGuideIds.length
          ? "(message.visitor_id = :userId OR message.guide_id IN (:...ownedGuideIds))"
          : "message.visitor_id = :userId",
        { userId, ownedGuideIds },
      );
    return { count: await query.getCount() };
  }

  async getGuideOwnerId(guideId: string) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    return guide.userId;
  }

  async sendGuideMessage(
    userId: string,
    guideId: string,
    dto: SendGuideMessageDto,
  ) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide profile not found");
    const visitorId = guide.userId === userId ? dto.visitorId : userId;
    if (!visitorId || visitorId === guide.userId) {
      throw new BadRequestException("A visitor conversation is required");
    }
    if (
      guide.userId === userId &&
      !(await this.messageRepo.exists({ where: { guideId, visitorId } }))
    ) {
      throw new ForbiddenException(
        "This traveler has not started a conversation",
      );
    }
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        guideId,
        visitorId,
        senderId: userId,
        body: dto.body.trim(),
        readAt: null,
      }),
    );
    await this.notificationsService.create(
      userId === guide.userId ? visitorId : guide.userId,
      {
        type: "guide.message",
        title: "New guide message",
        body: dto.body.trim().slice(0, 120),
        link: `/messages/${encodeURIComponent(guideId)}?visitorId=${encodeURIComponent(visitorId)}`,
      },
    );
    return this.publicMessage(message);
  }

  async apply(userId: string, dto: ApplyGuideDto) {
    const existing = await this.guideRepo.findOne({ where: { userId } });
    if (
      existing &&
      existing.verificationStatus !== GuideVerificationStatus.REJECTED
    )
      throw new ConflictException("You already have a guide application");
    const slugExists = await this.guideRepo.exists({
      where: { slug: dto.slug },
    });
    if (slugExists && existing?.slug !== dto.slug)
      throw new ConflictException("That guide URL is already in use");
    if (
      dto.countyId &&
      !(await this.countyRepo.exists({ where: { id: dto.countyId } }))
    ) {
      throw new BadRequestException("The selected county does not exist");
    }
    if (existing) {
      Object.assign(existing, {
        ...dto,
        countyId: dto.countyId ?? null,
        verificationStatus: GuideVerificationStatus.PENDING,
        verifiedAt: null,
        verifiedBy: null,
        ltaLicenseNumber: dto.ltaLicenseNumber ?? null,
        whatsappNumber: normalizePhoneOrThrow(
          dto.whatsappNumber,
          "WhatsApp number",
        ),
      });
      return this.guideRepo.save(existing);
    }
    return this.guideRepo.save(
      this.guideRepo.create({
        ...dto,
        userId,
        countyId: dto.countyId ?? null,
        verificationStatus: GuideVerificationStatus.PENDING,
        verifiedAt: null,
        verifiedBy: null,
        ltaLicenseNumber: dto.ltaLicenseNumber ?? null,
        whatsappNumber: normalizePhoneOrThrow(
          dto.whatsappNumber,
          "WhatsApp number",
        ),
        verificationDocumentKey: null,
        profileImageUrl: dto.profileImageUrl ?? null,
      }),
    );
  }

  listPendingApplications() {
    return this.guideRepo.find({
      where: { verificationStatus: GuideVerificationStatus.PENDING },
      order: { createdAt: "ASC" },
    });
  }

  async setVerification(
    adminId: string,
    guideId: string,
    dto: SetGuideVerificationDto,
  ) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide application not found");
    guide.verificationStatus = dto.status;
    guide.verifiedAt =
      dto.status === GuideVerificationStatus.VERIFIED ? new Date() : null;
    guide.verifiedBy =
      dto.status === GuideVerificationStatus.VERIFIED ? adminId : null;
    const saved = await this.guideRepo.save(guide);
    await this.notificationsService.create(guide.userId, {
      type: "guide.verification_decided",
      title:
        dto.status === GuideVerificationStatus.VERIFIED
          ? "Guide application approved"
          : "Guide application update",
      body:
        dto.reason ??
        (dto.status === GuideVerificationStatus.VERIFIED
          ? "Your guide profile is now verified."
          : "Your guide application needs changes."),
      link: "/guides",
    });
    return saved;
  }

  async verificationDocument(guideId: string) {
    const guide = await this.guideRepo.findOne({ where: { id: guideId } });
    if (!guide) throw new NotFoundException("Guide application not found");
    if (!guide.verificationDocumentKey) {
      throw new NotFoundException("No verification document uploaded");
    }
    const { buffer } = await this.storage.readPrivate(
      guide.verificationDocumentKey,
    );
    return { buffer };
  }

  async createExperience(userId: string, dto: CreateExperienceDto) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide)
      throw new ForbiddenException(
        "Apply as a guide before creating experiences",
      );
    if (guide.verificationStatus !== GuideVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        "Your guide profile must be verified before publishing experiences",
      );
    }
    if (dto.isFeatured) {
      await this.experienceRepo.update(
        { guideId: guide.id },
        { isFeatured: false },
      );
    }
    const created = await this.experienceRepo.save(
      this.experienceRepo.create({
        ...dto,
        guideId: guide.id,
        placeId: dto.placeId ?? null,
        priceLrd: dto.priceLrd ?? null,
        meetingLat: dto.meetingLat ?? null,
        meetingLng: dto.meetingLng ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        imageUrls: dto.imageUrls ?? [],
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? ExperienceStatus.DRAFT,
      }),
    );
    return this.publicExperience(created);
  }

  async uploadVerificationDocument(
    userId: string,
    file: { buffer: Buffer; mimetype: string },
  ) {
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype)
    ) {
      throw new BadRequestException(
        "Only PDF, JPG, and PNG verification documents are accepted",
      );
    }
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new NotFoundException("Guide application not found");
    const result = await this.storage.savePrivate({
      buffer: file.buffer,
      filename: `guide-verification/${userId}/${randomUUID()}`,
      contentType: file.mimetype,
    });
    guide.verificationDocumentKey = result.key;
    await this.guideRepo.save(guide);
    return { uploaded: true };
  }

  async createBooking(
    userId: string,
    experienceId: string,
    dto: CreateGuideBookingDto,
  ) {
    if (!isUuid(experienceId))
      throw new BadRequestException("Invalid experience id");
    const experience = await this.experienceRepo.findOne({
      where: { id: experienceId, status: ExperienceStatus.PUBLISHED },
    });
    if (
      !experience ||
      experience.guide.verificationStatus !== GuideVerificationStatus.VERIFIED
    ) {
      throw new NotFoundException("Published experience not found");
    }
    if (new Date(dto.requestedDate) < startOfToday())
      throw new BadRequestException("requestedDate cannot be in the past");
    if (dto.groupSize > experience.maxGroupSize)
      throw new BadRequestException(
        `This experience accepts at most ${experience.maxGroupSize} people`,
      );
    const duplicate = await this.bookingRepo.exists({
      where: {
        experienceId,
        travelerId: userId,
        requestedDate: dto.requestedDate,
        status: GuideBookingStatus.REQUESTED,
      },
    });
    if (duplicate)
      throw new ConflictException(
        "You already have a pending request for this date",
      );
    const booking = await this.bookingRepo.save(
      this.bookingRepo.create({
        experienceId,
        travelerId: userId,
        requestedDate: dto.requestedDate,
        groupSize: dto.groupSize,
        note: dto.note ?? null,
        priceUsdSnapshot: experience.priceUsd,
        priceLrdSnapshot: experience.priceLrd,
        status: GuideBookingStatus.REQUESTED,
        paymentStatus: GuidePaymentStatus.UNPAID,
        guideResponse: null,
        respondedAt: null,
      }),
    );
    await this.notificationsService.create(experience.guide.userId, {
      type: "booking.requested",
      title: "New experience booking request",
      body: `A traveler requested ${experience.title} for ${dto.requestedDate}.`,
      link: BOOKINGS_LINK,
    });
    return this.bookingRepo.findOneOrFail({ where: { id: booking.id } });
  }

  findMine(userId: string) {
    return this.bookingRepo.find({
      where: { travelerId: userId },
      order: { createdAt: "DESC" },
    });
  }

  async findIncoming(userId: string) {
    const guide = await this.guideRepo.findOne({ where: { userId } });
    if (!guide) throw new ForbiddenException("Guide profile not found");
    return this.bookingRepo
      .createQueryBuilder("booking")
      .leftJoinAndSelect("booking.experience", "experience")
      .leftJoinAndSelect("booking.traveler", "traveler")
      .where("experience.guide_id = :guideId", { guideId: guide.id })
      .orderBy("booking.created_at", "DESC")
      .getMany();
  }

  async respond(
    userId: string,
    bookingId: string,
    dto: RespondGuideBookingDto,
  ) {
    if (!isUuid(bookingId)) throw new BadRequestException("Invalid booking id");
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.experience.guide.userId !== userId)
      throw new ForbiddenException("Only the guide can respond");
    if (
      booking.status !== GuideBookingStatus.REQUESTED &&
      dto.status !== GuideBookingStatus.COMPLETED
    )
      throw new ConflictException(
        "This booking is no longer awaiting a response",
      );
    booking.status = dto.status;
    booking.guideResponse = dto.response ?? null;
    booking.respondedAt = new Date();
    await this.bookingRepo.save(booking);
    if (
      dto.status === GuideBookingStatus.CONFIRMED ||
      dto.status === GuideBookingStatus.DECLINED
    ) {
      await this.notificationsService.create(booking.travelerId, {
        type:
          dto.status === GuideBookingStatus.CONFIRMED
            ? "booking.confirmed"
            : "booking.declined",
        title:
          dto.status === GuideBookingStatus.CONFIRMED
            ? "Experience booking confirmed"
            : "Experience booking declined",
        body: `${booking.experience.title} was ${dto.status}.`,
        link: BOOKINGS_LINK,
      });
    }
    return booking;
  }

  async review(userId: string, bookingId: string, dto: CreateGuideReviewDto) {
    if (!isUuid(bookingId)) throw new BadRequestException("Invalid booking id");
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.travelerId !== userId)
      throw new ForbiddenException("Only the traveler can review this booking");
    if (booking.status !== GuideBookingStatus.COMPLETED)
      throw new BadRequestException("Only completed bookings can be reviewed");
    const exists = await this.reviewRepo.exists({ where: { bookingId } });
    if (exists)
      throw new ConflictException("This booking already has a review");
    return this.reviewRepo.save(
      this.reviewRepo.create({
        bookingId,
        travelerId: userId,
        guideId: booking.experience.guideId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      }),
    );
  }

  private async publicGuide(guide: GuideProfile) {
    const stats = await this.reviewRepo
      .createQueryBuilder("review")
      .select("COALESCE(AVG(review.rating), 0)", "rating")
      .addSelect("COUNT(review.id)", "reviewCount")
      .where("review.guide_id = :guideId", { guideId: guide.id })
      .getRawOne<{ rating: string; reviewCount: string }>();
    return {
      id: guide.id,
      slug: guide.slug,
      guideType: guide.guideType,
      bio: guide.bio,
      city: guide.city,
      county: guide.county,
      languages: guide.languages,
      verificationStatus: guide.verificationStatus,
      whatsappNumber: guide.whatsappNumber,
      profileImageUrl: guide.profileImageUrl,
      rating: Number(Number(stats?.rating ?? 0).toFixed(1)),
      reviewCount: Number(stats?.reviewCount ?? 0),
    };
  }

  private publicMessage(message: GuideMessage) {
    return {
      id: message.id,
      guideId: message.guideId,
      visitorId: message.visitorId,
      senderId: message.senderId,
      body: message.body,
      readAt: message.readAt,
      createdAt: message.createdAt,
      sender: message.sender
        ? { id: message.sender.id, name: message.sender.name }
        : null,
    };
  }

  private async publicExperience(experience: Experience) {
    return {
      ...experience,
      imageUrls:
        experience.imageUrls ??
        (experience.coverImageUrl ? [experience.coverImageUrl] : []),
      guide: await this.publicGuide(experience.guide),
    };
  }
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
