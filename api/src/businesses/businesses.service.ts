import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "./entities/business.entity";
import { Place } from "../places/entities/place.entity";
import { BusinessReviewStatus, BusinessType } from "./entities/business.enums";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

export interface PaginatedBusinesses {
  data: Business[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface QueryBusinessesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: BusinessType;
  countyId?: string;
}

/** Slugifies `name`, deduping against any existing row by appending -2,
 * -3, ... — unlike Place.slug (admin-typed), a Business slug is always
 * server-generated since neither the self-claim form nor the admin-seed
 * form ever asks for one. Shared between BusinessesService (self-claim)
 * and AdminContentService (admin-seeded businesses) rather than a method
 * on one service the other would need to reach into. */
export async function buildBusinessSlug(
  businessRepo: Repository<Business>,
  name: string,
): Promise<string> {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business";
  let slug = base;
  let suffix = 2;
  while (await businessRepo.exists({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /** Self-service claim: creates the Business record for a Place, owned by
   * the claiming user, if one doesn't already exist for it. Starts in
   * SUBMITTED_FOR_REVIEW — not live until an admin approves it (see
   * BusinessReviewStatus's doc comment for why this is gated, unlike the
   * old always-live claim behavior). */
  async claimPlace(userId: string, dto: CreateBusinessDto): Promise<Business> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }

    const existing = await this.businessRepo.findOne({
      where: { linkedPlaceId: dto.placeId },
    });
    if (existing) {
      throw new ConflictException(
        existing.ownerUserId
          ? "This listing has already been claimed"
          : "A claim for this listing is pending",
      );
    }

    const business = this.businessRepo.create({
      name: dto.name,
      slug: await buildBusinessSlug(this.businessRepo, dto.name),
      type: dto.type,
      ownerUserId: userId,
      linkedPlaceId: dto.placeId,
      phone: dto.phone ?? null,
      whatsapp: dto.whatsapp ?? null,
      email: dto.email ?? null,
      website: dto.website ?? null,
      socialLinks: dto.socialLinks ?? [],
      description: dto.description ?? null,
      images: dto.images ?? [],
      logoImage: dto.logoImage ?? null,
      videos: dto.videos ?? [],
      openingHours: dto.openingHours ?? null,
      priceRangeMin: dto.priceRangeMin ?? null,
      priceRangeMax: dto.priceRangeMax ?? null,
      servicesOffered: dto.servicesOffered ?? [],
      reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW,
      submittedAt: new Date(),
    });
    const saved = await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** For an already-existing, unclaimed Business record — claims ownership.
   * Deliberately leaves `reviewStatus` untouched: an admin-seeded listing
   * was already vetted when it was created (see BusinessesService's
   * admin-CRUD counterpart, which starts new admin-authored listings at
   * APPROVED) — just attaching the real owner to it shouldn't re-trigger a
   * review, which would be an unnecessary hurdle for a legitimate business
   * an admin already reached out to and seeded. */
  async claimExisting(userId: string, businessId: string): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId) {
      throw new ConflictException("This listing has already been claimed");
    }

    business.ownerUserId = userId;
    await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id: businessId } });
  }

  /** Lets the owner edit their own listing after claiming it — the claim
   * form only ever gets one shot at these fields otherwise. Deliberately
   * excludes `type`/`placeId`/`ownerUserId`: what business this is and
   * what it's linked to aren't things an owner should be able to change
   * themselves (that stays admin-only, via UpdateBusinessAdminDto).
   *
   * A REJECTED listing resubmits itself on the next edit — an owner acting
   * on reviewer feedback shouldn't also have to find a separate "resubmit"
   * button. SUSPENDED deliberately does NOT auto-resubmit: lifting a
   * suspension (a policy-violation call, not a "missing info" call) stays
   * an explicit admin action regardless of what the owner edits. */
  async updateMine(
    userId: string,
    businessId: string,
    dto: UpdateBusinessDto,
  ): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this listing");
    }

    Object.assign(business, dto);
    if (business.reviewStatus === BusinessReviewStatus.REJECTED) {
      business.reviewStatus = BusinessReviewStatus.SUBMITTED_FOR_REVIEW;
      business.submittedAt = new Date();
      business.rejectionReason = null;
    }
    await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id: businessId } });
  }

  /** Public lookup (no auth — GET /businesses?placeId=, used by the
   * destination profile page). Only ever returns an APPROVED listing: a
   * business still SUBMITTED_FOR_REVIEW/REJECTED/etc. isn't public yet.
   * The owner's own pending/rejected listing is still reachable — via
   * `findMine`, not this endpoint — so an owner isn't left unable to see
   * their own claim's status. */
  findByPlace(placeId: string): Promise<Business | null> {
    return this.businessRepo.findOne({
      where: {
        linkedPlaceId: placeId,
        reviewStatus: BusinessReviewStatus.APPROVED,
      },
    });
  }

  /** Public profile lookup (GET /businesses/slug/:slug) — same APPROVED-only
   * gate as findByPlace, for the same reason. */
  findBySlug(slug: string): Promise<Business | null> {
    return this.businessRepo.findOne({
      where: { slug, reviewStatus: BusinessReviewStatus.APPROVED },
    });
  }

  /** Public directory (GET /businesses without a placeId) — approved
   * listings only, same reasoning as findByPlace/findBySlug. Query
   * builder, not find(): `linkedPlace` is `eager: true` but eager relations
   * only auto-join through find()/findAndCount(), not a query builder (see
   * CreatorsService.findAll for the same pattern) — countyId filtering
   * needs linkedPlace joined explicitly either way. */
  async findAllApproved(
    params: QueryBusinessesParams = {},
  ): Promise<PaginatedBusinesses> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.businessRepo
      .createQueryBuilder("business")
      .leftJoinAndSelect("business.owner", "owner")
      .leftJoinAndSelect("business.linkedPlace", "linkedPlace")
      .leftJoinAndSelect("linkedPlace.category", "category")
      .leftJoinAndSelect("linkedPlace.county", "county")
      .where("business.reviewStatus = :reviewStatus", {
        reviewStatus: BusinessReviewStatus.APPROVED,
      })
      .orderBy("business.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        "(business.name ILIKE :search OR business.description ILIKE :search)",
        { search: `%${params.search}%` },
      );
    }
    if (params.type) {
      qb.andWhere("business.type = :type", { type: params.type });
    }
    if (params.countyId) {
      qb.andWhere("linkedPlace.countyId = :countyId", {
        countyId: params.countyId,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  findMine(userId: string): Promise<Business[]> {
    return this.businessRepo.find({
      where: { ownerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }
}
