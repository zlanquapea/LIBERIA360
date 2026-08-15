import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { SetTeamRolesDto } from "./dto/set-team-roles.dto";

/** Team & Access management (Tech Spec §7/§8) — before this, the *only*
 * way to grant admin access was a raw SQL UPDATE against the users table
 * (see api/README.md's Phase 3 section), which isn't something a super
 * admin can hand off to anyone else. This is the first self-service path. */
@Injectable()
export class AdminTeamService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Everyone with any admin access today — the roster a super admin
   * reviews before making a change. */
  findTeam(): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.isAdmin = true OR user.isSuperAdmin = true")
      .orderBy("user.isSuperAdmin", "DESC")
      .addOrderBy("user.name", "ASC")
      .getMany();
  }

  /** Look up a user by email to promote — the natural key an admin would
   * actually know for someone who isn't on the team yet. */
  async search(email: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(`No account found for "${email}"`);
    }
    return user;
  }

  async setRoles(
    actingUserId: string,
    targetUserId: string,
    dto: SetTeamRolesDto,
  ): Promise<User> {
    if (actingUserId === targetUserId && !dto.isSuperAdmin) {
      // A super admin can still demote themselves to a plain admin or
      // revoke their own admin access entirely elsewhere (direct SQL,
      // same as granting the very first admin) — this just stops the one
      // click that would strand a solo super admin with no way back in
      // through the UI they're using to do it.
      throw new BadRequestException(
        "You can't remove your own super admin access here — have another super admin do it, or use direct database access.",
      );
    }

    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException(`User "${targetUserId}" not found`);
    }

    // A super admin is conceptually also an admin — every admin.controller.ts
    // endpoint only checks isAdmin, so isSuperAdmin without isAdmin would
    // silently lock a super admin out of ordinary admin actions.
    user.isSuperAdmin = dto.isSuperAdmin;
    user.isAdmin = dto.isAdmin || dto.isSuperAdmin;

    return this.userRepo.save(user);
  }
}
