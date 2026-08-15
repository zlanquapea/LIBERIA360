import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { User } from "../../users/entities/user.entity";

/** Must run after JwtAuthGuard, same as AdminGuard —
 * `@UseGuards(JwtAuthGuard, SuperAdminGuard)`. Gates the one thing a
 * regular admin can't do: change who else is an admin (AdminTeamService),
 * and gets first claim on anything platform-sensitive as that surfaces
 * later (pricing, payouts). Deliberately not layered on top of AdminGuard
 * — checking isSuperAdmin alone keeps a super admin's access working even
 * if their isAdmin flag were ever out of sync. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException("Super admin access required");
    }
    return true;
  }
}
