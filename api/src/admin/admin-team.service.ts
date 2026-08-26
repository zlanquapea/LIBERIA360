import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { User } from "../users/entities/user.entity";
import { AuthProvider } from "../users/entities/user.enums";
import { SetTeamRolesDto } from "./dto/set-team-roles.dto";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { AdminAuditService } from "./admin-audit.service";
import { MailService } from "../mail/mail.service";
import { generateToken, hashToken } from "../auth/token-hash";
import { RequestInfo } from "../common/request-info";
import { AppConfig } from "../config/configuration";

// Same TTL AuthService.forgotPassword uses for the equivalent link — kept
// as its own constant here rather than imported, since AuthService's is
// private and the two flows are allowed to drift independently even
// though they happen to agree today.
const SET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1h

/** Team & Access management (Tech Spec §7/§8) — before this, the *only*
 * way to grant admin access was a raw SQL UPDATE against the users table
 * (see api/README.md's Phase 3 section), which isn't something a super
 * admin can hand off to anyone else. This is the first self-service path. */
@Injectable()
export class AdminTeamService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly adminAuditService: AdminAuditService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
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

  /** Create a brand-new admin/super-admin account directly, rather than
   * requiring the person to already have registered on their own first.
   * The account starts with no password — same reset-token/URL mechanism
   * AuthService.forgotPassword uses, just fired directly (that method
   * refuses to act on an account with no passwordHash yet) and paired
   * with copy that explains the invite instead of implying a lost
   * password. A broken mail provider must never fail account creation,
   * so the send is fire-and-forget. */
  async createAdmin(
    actingUserId: string,
    actingUserName: string,
    dto: CreateAdminDto,
    requestInfo?: RequestInfo,
  ): Promise<User> {
    const email = dto.email.toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(
        `An account already exists for "${dto.email}" — promote it from the team roster instead of creating a new one.`,
      );
    }

    const resetToken = generateToken();
    const user = this.userRepo.create({
      name: dto.name,
      email,
      passwordHash: null,
      authProvider: AuthProvider.EMAIL,
      isAdmin: true,
      isSuperAdmin: dto.isSuperAdmin,
      passwordResetTokenHash: hashToken(resetToken),
      passwordResetTokenExpiresAt: new Date(Date.now() + SET_PASSWORD_TTL_MS),
    });
    const saved = await this.userRepo.save(user);

    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    const setPasswordUrl = `${webAppUrl}/reset-password?token=${resetToken}`;
    this.mailService
      .sendAdminInvite(
        saved.email,
        saved.name,
        actingUserName,
        saved.isSuperAdmin,
        setPasswordUrl,
      )
      .catch(() => undefined);

    await this.adminAuditService.log(
      actingUserId,
      "admin_team.created",
      "user",
      saved.id,
      {
        name: saved.name,
        email: saved.email,
        isSuperAdmin: saved.isSuperAdmin,
      },
      requestInfo,
    );
    return saved;
  }

  async setRoles(
    actingUserId: string,
    targetUserId: string,
    dto: SetTeamRolesDto,
    requestInfo?: RequestInfo,
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

    const previousRoles = {
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
    };

    // A super admin is conceptually also an admin — every admin.controller.ts
    // endpoint only checks isAdmin, so isSuperAdmin without isAdmin would
    // silently lock a super admin out of ordinary admin actions.
    user.isSuperAdmin = dto.isSuperAdmin;
    user.isAdmin = dto.isAdmin || dto.isSuperAdmin;

    const saved = await this.userRepo.save(user);
    await this.adminAuditService.log(
      actingUserId,
      "admin_team.roles_changed",
      "user",
      targetUserId,
      {
        from: previousRoles,
        to: { isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin },
      },
      requestInfo,
    );
    return saved;
  }
}
