import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { User } from "../../users/entities/user.entity";

/** Must run after JwtAuthGuard (needs `request.user` already populated) —
 * use as `@UseGuards(JwtAuthGuard, AdminGuard)`. Backs every Phase 3
 * admin-only endpoint (Tech Spec §8): sponsored placements, featured
 * creators, verification workflow, content management, B2B analytics. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    if (!user?.isAdmin) {
      throw new ForbiddenException("Admin access required");
    }
    return true;
  }
}
