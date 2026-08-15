import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Creator } from "./entities/creator.entity";
import { CreateCreatorDto } from "./dto/create-creator.dto";
import { UpdateCreatorDto } from "./dto/update-creator.dto";

export interface PaginatedCreators {
  data: Creator[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
  ) {}

  async create(userId: string, dto: CreateCreatorDto): Promise<Creator> {
    const existingForUser = await this.creatorRepo.findOne({
      where: { userId },
    });
    if (existingForUser) {
      throw new ConflictException("You already have a creator profile");
    }

    const existingUsername = await this.creatorRepo.findOne({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException(
        `Username "${dto.username}" is already taken`,
      );
    }

    const creator = await this.creatorRepo.save(
      this.creatorRepo.create({ ...dto, userId }),
    );
    return this.creatorRepo.findOneOrFail({ where: { id: creator.id } });
  }

  async update(userId: string, dto: UpdateCreatorDto): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    if (!creator) {
      throw new NotFoundException("You do not have a creator profile yet");
    }

    if (dto.username && dto.username !== creator.username) {
      const existingUsername = await this.creatorRepo.findOne({
        where: { username: dto.username },
      });
      if (existingUsername) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    this.creatorRepo.merge(creator, dto);
    await this.creatorRepo.save(creator);
    return this.creatorRepo.findOneOrFail({ where: { userId } });
  }

  findMine(userId: string): Promise<Creator | null> {
    return this.creatorRepo.findOne({ where: { userId } });
  }

  async findByUsername(username: string): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { username } });
    if (!creator) {
      throw new NotFoundException(`Creator "${username}" not found`);
    }
    return creator;
  }

  async findAll(page = 1, limit = 20): Promise<PaginatedCreators> {
    const [data, total] = await this.creatorRepo.findAndCount({
      order: { followerCount: "DESC" },
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
