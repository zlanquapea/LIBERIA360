import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessContent } from "./entities/business-content.entity";
import { BusinessContentStatus } from "./entities/business-content.enums";
import { Business } from "../businesses/entities/business.entity";
import { CreateBusinessContentDto } from "./dto/create-business-content.dto";
import { UpdateBusinessContentDto } from "./dto/update-business-content.dto";

export interface PaginatedBusinessContent {
  data: BusinessContent[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class BusinessContentService {
  constructor(
    @InjectRepository(BusinessContent)
    private readonly contentRepo: Repository<BusinessContent>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  private async assertOwnsBusiness(
    userId: string,
    businessId: string,
  ): Promise<void> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this business");
    }
  }

  private async findOwnedOrFail(
    userId: string,
    contentId: string,
  ): Promise<BusinessContent> {
    const content = await this.contentRepo.findOne({
      where: { id: contentId },
      relations: ["business"],
    });
    if (!content) {
      throw new NotFoundException(`Content "${contentId}" not found`);
    }
    if (content.business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this business");
    }
    return content;
  }

  async create(
    userId: string,
    dto: CreateBusinessContentDto,
  ): Promise<BusinessContent> {
    await this.assertOwnsBusiness(userId, dto.businessId);
    const content = this.contentRepo.create({
      businessId: dto.businessId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      images: dto.images ?? [],
      externalLink: dto.externalLink ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      status: BusinessContentStatus.DRAFT,
    });
    const saved = await this.contentRepo.save(content);
    return this.contentRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Editing a REJECTED item resubmits it — same "an owner acting on
   * reviewer feedback shouldn't also have to find a separate 'resubmit'
   * button" reasoning as BusinessesService.updateMine. A DRAFT or
   * SUBMITTED_FOR_REVIEW item just gets edited in place (no status
   * change); an APPROVED item can still be edited, and stays APPROVED —
   * mirrors Business Profile's stance that light edits to an already-live
   * listing don't need re-review. */
  async update(
    userId: string,
    contentId: string,
    dto: UpdateBusinessContentDto,
  ): Promise<BusinessContent> {
    const content = await this.findOwnedOrFail(userId, contentId);
    Object.assign(content, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : content.validFrom,
      validUntil: dto.validUntil
        ? new Date(dto.validUntil)
        : content.validUntil,
    });
    if (content.status === BusinessContentStatus.REJECTED) {
      content.status = BusinessContentStatus.SUBMITTED_FOR_REVIEW;
      content.submittedAt = new Date();
      content.rejectionReason = null;
    }
    await this.contentRepo.save(content);
    return this.contentRepo.findOneOrFail({ where: { id: contentId } });
  }

  /** DRAFT or REJECTED → SUBMITTED_FOR_REVIEW. A no-op (still succeeds)
   * if it's already submitted/approved — resubmitting something already
   * in the queue or already live isn't an error, just nothing to do. */
  async submit(userId: string, contentId: string): Promise<BusinessContent> {
    const content = await this.findOwnedOrFail(userId, contentId);
    if (
      content.status === BusinessContentStatus.DRAFT ||
      content.status === BusinessContentStatus.REJECTED
    ) {
      content.status = BusinessContentStatus.SUBMITTED_FOR_REVIEW;
      content.submittedAt = new Date();
      content.rejectionReason = null;
      await this.contentRepo.save(content);
    }
    return this.contentRepo.findOneOrFail({ where: { id: contentId } });
  }

  async remove(userId: string, contentId: string): Promise<void> {
    await this.findOwnedOrFail(userId, contentId);
    await this.contentRepo.delete({ id: contentId });
  }

  /** Every content item for one of the caller's own businesses,
   * regardless of status — the owner's own authoring dashboard. */
  findMine(userId: string, businessId: string): Promise<BusinessContent[]> {
    return this.assertOwnsBusiness(userId, businessId).then(() =>
      this.contentRepo.find({
        where: { businessId },
        order: { createdAt: "DESC" },
      }),
    );
  }

  /** Public feed for one business — approved only, same gate as
   * BusinessesService's public lookups. */
  async findPublicForBusiness(
    businessId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedBusinessContent> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.contentRepo.findAndCount({
      where: { businessId, status: BusinessContentStatus.APPROVED },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
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
}
