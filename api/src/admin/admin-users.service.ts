import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { TravelerType } from "../users/entities/user.enums";

export interface PaginatedUsers {
  data: User[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface QueryUsersParams {
  page: number;
  limit: number;
  search?: string;
  travelerType?: TravelerType;
  isAdmin?: "true" | "false";
}

/** Users & Roles > Users — the full account list, distinct from Team &
 * Access's `findTeam()` (which only ever shows admins). Same PII exposure
 * concern as the team roster (email, phone, traveler type across every
 * account), so this is super-admin-only, same tier as Team/Audit/Security
 * — see AdminTeamController's doc comment for the same reasoning. */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(params: QueryUsersParams): Promise<PaginatedUsers> {
    const qb = this.userRepo
      .createQueryBuilder("user")
      .orderBy("user.createdAt", "DESC")
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    if (params.search) {
      qb.andWhere("(user.name ILIKE :search OR user.email ILIKE :search)", {
        search: `%${params.search}%`,
      });
    }
    if (params.travelerType) {
      qb.andWhere("user.travelerType = :travelerType", {
        travelerType: params.travelerType,
      });
    }
    if (params.isAdmin === "true") {
      qb.andWhere("(user.isAdmin = true OR user.isSuperAdmin = true)");
    } else if (params.isAdmin === "false") {
      qb.andWhere("user.isAdmin = false AND user.isSuperAdmin = false");
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    };
  }
}
