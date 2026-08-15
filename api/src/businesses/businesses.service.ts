import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "./entities/business.entity";
import { Place } from "../places/entities/place.entity";
import { CreateBusinessDto } from "./dto/create-business.dto";

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /** Self-service claim: creates the Business record for a Place, owned by
   * the claiming user, if one doesn't already exist for it. */
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
    });
    const saved = await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** For an already-existing, unclaimed Business record — claims ownership. */
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

  findByPlace(placeId: string): Promise<Business | null> {
    return this.businessRepo.findOne({ where: { linkedPlaceId: placeId } });
  }

  findMine(userId: string): Promise<Business[]> {
    return this.businessRepo.find({
      where: { ownerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }
}
