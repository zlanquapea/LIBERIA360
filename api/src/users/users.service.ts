import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  /** Looks up a user by an exact-match hashed token — see
   * auth/token-hash.ts and AuthService.findByValidToken for why this is a
   * plain equality lookup rather than a bcrypt comparison loop. */
  findByTokenHash(
    column: "emailVerificationTokenHash" | "passwordResetTokenHash",
    hash: string,
  ): Promise<User | null> {
    return this.userRepo.findOne({ where: { [column]: hash } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create({
      ...data,
      email: data.email?.toLowerCase(),
    });
    const saved = await this.userRepo.save(user);
    // save() returns the entity as constructed, not re-fetched — eager
    // relations (homeCounty) aren't populated on it the way they would be
    // on a fresh find (they come back `undefined`, not `null`, for a
    // registration with no home county set). Re-fetch so callers — e.g.
    // AuthService.register — get the same shape whether the user just
    // registered or was looked up afterward.
    return (await this.findById(saved.id))!;
  }

  /** PATCH /auth/me — see UpdateProfileDto for why this exists. */
  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update({ id }, data);
    return (await this.findById(id))!;
  }

  /** "People on the platform" search for the trip-invitation picker
   * (never for anything admin — see AdminUsersService for the
   * super-admin-only equivalent). Excludes the searching user and
   * deleted/anonymized accounts, and is capped — this is a "find your
   * friend by name or email" lookup, not a directory browse. */
  async searchByNameOrEmail(
    query: string,
    excludeUserId: string,
    limit = 8,
  ): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.id != :excludeUserId", { excludeUserId })
      .andWhere("user.deletedAt IS NULL")
      .andWhere("(user.name ILIKE :q OR user.email ILIKE :q)", {
        q: `%${query.trim()}%`,
      })
      .orderBy("user.name", "ASC")
      .take(limit)
      .getMany();
  }

  /** Used to target "events nearby" push notifications (Tech Spec §3.2) at
   * users who've set this as their home county. */
  async findIdsByHomeCounty(countyId: string): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { homeCountyId: countyId },
      select: ["id"],
    });
    return users.map((u) => u.id);
  }

  /** Every admin, including super admins — `isSuperAdmin` always implies
   * `isAdmin: true` (see User.isSuperAdmin's doc comment), so this one
   * query covers both tiers. Used to broadcast an in-app notification to
   * "whoever moderates" (a new place/business pending review) rather than
   * targeting a single admin who happens to be looking. */
  async findAdminIds(): Promise<string[]> {
    const admins = await this.userRepo.find({
      where: { isAdmin: true },
      select: ["id"],
    });
    return admins.map((u) => u.id);
  }
}
