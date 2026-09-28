import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { County } from "../counties/entities/county.entity";
import { User } from "../users/entities/user.entity";
import { VisitedPlace } from "./entities/visited-place.entity";

export interface ExplorerBadge {
  id: string;
  label: string;
  achieved: boolean;
}

export interface ExplorerProgress {
  visitedPlacesCount: number;
  countiesVisited: County[];
  totalCounties: number;
  badges: ExplorerBadge[];
}

export interface PublicExplorerProfile {
  name: string;
  profileImage: string | null;
  progress: ExplorerProgress;
}

// Fixed, small badge list computed purely from the counts below — no
// stored badge rows, same "derived, never stored, so it can never drift"
// philosophy as ItinerariesService.computeTripStatus. Thresholds are
// deliberately modest: Liberia's catalog isn't huge, and the point is to
// reward getting started and exploring broadly, not grinding.
const PLACE_COUNT_BADGES: { id: string; label: string; threshold: number }[] = [
  { id: "first_steps", label: "First Steps", threshold: 1 },
  { id: "explorer", label: "Explorer", threshold: 5 },
  { id: "adventurer", label: "Adventurer", threshold: 15 },
];

@Injectable()
export class VisitedPlacesService {
  constructor(
    @InjectRepository(VisitedPlace)
    private readonly visitedPlaceRepo: Repository<VisitedPlace>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(County)
    private readonly countyRepo: Repository<County>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** POST /visited-places/:placeId — idempotent via `.upsert()`, same
   * double-click/retry safety as SavedPlacesService.savePlace. */
  async markVisited(userId: string, placeId: string): Promise<void> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) throw new NotFoundException("Place not found");
    await this.visitedPlaceRepo.upsert({ userId, placeId }, [
      "userId",
      "placeId",
    ]);
  }

  /** DELETE /visited-places/:placeId — unmarking something never marked
   * is a no-op, not an error, same as SavedPlacesService.unsavePlace. */
  async unmarkVisited(userId: string, placeId: string): Promise<void> {
    await this.visitedPlaceRepo.delete({ userId, placeId });
  }

  async listMyVisitedPlaceIds(userId: string): Promise<string[]> {
    const rows = await this.visitedPlaceRepo.find({
      where: { userId },
      select: ["placeId"],
    });
    return rows.map((r) => r.placeId);
  }

  /** GET /visited-places/me — computed at read time, never stored (see
   * this file's own badge-list comment). Counties are derived by joining
   * through each visited place's own county, not stored redundantly on
   * VisitedPlace itself. */
  async getExplorerProgress(userId: string): Promise<ExplorerProgress> {
    const [visited, totalCounties] = await Promise.all([
      this.visitedPlaceRepo.find({
        where: { userId },
        relations: { place: { county: true } },
      }),
      this.countyRepo.count(),
    ]);
    const visitedPlaces = visited.filter((v) => v.place);
    const countyById = new Map<string, County>();
    for (const v of visitedPlaces) {
      const county = v.place.county;
      if (county) countyById.set(county.id, county);
    }
    const countiesVisited = Array.from(countyById.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const visitedPlacesCount = visitedPlaces.length;

    const badges: ExplorerBadge[] = [
      ...PLACE_COUNT_BADGES.map((b) => ({
        id: b.id,
        label: b.label,
        achieved: visitedPlacesCount >= b.threshold,
      })),
      {
        id: "liberia_completionist",
        label: "Liberia Completionist",
        achieved: totalCounties > 0 && countiesVisited.length >= totalCounties,
      },
    ];

    return { visitedPlacesCount, countiesVisited, totalCounties, badges };
  }

  /** GET /explorers/:userId — public, but only for an account that opted
   * in (User.explorerProfilePublic). A stranger with no access at all
   * gets the same 404 as an unknown id, rather than a distinct "private"
   * response that would confirm the id belongs to a real account. */
  async getPublicProfile(userId: string): Promise<PublicExplorerProfile> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.explorerProfilePublic) {
      throw new NotFoundException("Explorer profile not found");
    }
    const progress = await this.getExplorerProgress(userId);
    return { name: user.name, profileImage: user.profileImage, progress };
  }
}
