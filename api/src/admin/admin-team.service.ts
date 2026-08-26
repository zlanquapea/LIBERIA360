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
      if (existing.passwordHash) {
        // A real, activated account already owns this email — nothing to
        // do here but point at the roster's promote flow instead.
        throw new ConflictException(
          `An account already exists for "${dto.email}" — promote it from the team roster instead of creating a new one.`,
        );
      }
      // existing.passwordHash === null means this email belongs to a
      // never-activated invite — possibly one a super admin already
      // "revoked" via setRoles before the person ever set a password.
      // Since that row can never log in and forgotPassword() silently
      // no-ops on a null passwordHash, treating this as a fresh conflict
      // would permanently squat the email with no way back in. Instead,
      // re-invite in place: update the pending row and resend, so
      // re-typing the same email into "New person" is exactly as good as
      // a dedicated "resend invite" button.
      return this.sendInvite(
        actingUserId,
        actingUserName,
        existing,
        "admin_team.created",
        { name: dto.name, isSuperAdmin: dto.isSuperAdmin },
        requestInfo,
      );
    }

    const user = this.userRepo.create({
      name: dto.name,
      email,
      passwordHash: null,
      authProvider: AuthProvider.EMAIL,
      isAdmin: true,
      isSuperAdmin: dto.isSuperAdmin,
    });
    return this.sendInvite(
      actingUserId,
      actingUserName,
      user,
      "admin_team.created",
      null,
      requestInfo,
    );
  }

  /** Re-sends a pending invite with a fresh token — for someone who
   * hasn't set a password yet, whether that's a brand-new invite they
   * haven't acted on, or one a super admin previously revoked. Refuses
   * once the account is activated: at that point setRoles is the right
   * tool, not this. */
  async resendInvite(
    actingUserId: string,
    actingUserName: string,
    targetUserId: string,
    requestInfo?: RequestInfo,
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException(`User "${targetUserId}" not found`);
    }
    if (user.passwordHash) {
      throw new BadRequestException(
        `${user.name} has already set a password — there's no pending invite to resend.`,
      );
    }
    return this.sendInvite(
      actingUserId,
      actingUserName,
      user,
      "admin_team.invite_resent",
      null,
      requestInfo,
    );
  }

  /** Shared by createAdmin (brand-new or re-invite-on-conflict) and
   * resendInvite: stamps a fresh set-password token on `user`, saves it,
   * fires the invite email, and audit-logs the outcome under `action`.
   * `roleUpdate` lets createAdmin apply the name/role the form was just
   * submitted with when re-inviting an existing pending row; resendInvite
   * passes null to leave the existing invite's role untouched. */
  private async sendInvite(
    actingUserId: string,
    actingUserName: string,
    user: User,
    action: "admin_team.created" | "admin_team.invite_resent",
    roleUpdate: { name: string; isSuperAdmin: boolean } | null,
    requestInfo?: RequestInfo,
  ): Promise<User> {
    if (roleUpdate) {
      user.name = roleUpdate.name;
      user.isAdmin = true;
      user.isSuperAdmin = roleUpdate.isSuperAdmin;
    }
    const resetToken = generateToken();
    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetTokenExpiresAt = new Date(
      Date.now() + SET_PASSWORD_TTL_MS,
    );
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
      action,
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
