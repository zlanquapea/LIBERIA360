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

  /** Used to target "events nearby" push notifications (Tech Spec §3.2) at
   * users who've set this as their home county. */
  async findIdsByHomeCounty(countyId: string): Promise<string[]> {
    const users = await this.userRepo.find({
      where: { homeCountyId: countyId },
      select: ["id"],
    });
    return users.map((u) => u.id);
  }
}
