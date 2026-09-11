import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, IsNull, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { extname } from "path";
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from "../uploads/storage/storage-provider.interface";
import { slugify } from "../common/slugify";
import { Place } from "../places/entities/place.entity";
import { CreatePlaceSubmissionDto } from "../places/dto/create-place-submission.dto";
import {
  AssignStaffDto,
  CreateOrderDto,
  PharmacyProfileDto,
  PharmacyQueryDto,
  PrescriptionReviewDto,
  ProductDto,
  ProductQueryDto,
  SaveOpeningHoursDto,
  VerificationDto,
} from "./dto/pharmacy.dto";
import {
  Pharmacy,
  PharmacyOpeningHours,
  PharmacyStaff,
  PharmacyVerification,
} from "./entities/pharmacy.entity";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
  PharmacyStaffRole,
  PharmacyStatus,
  PrescriptionDecision,
} from "./entities/pharmacy.enums";
import {
  PharmacyInventory,
  PharmacyProduct,
  PharmacyProductCategory,
} from "./entities/product.entity";
import {
  PharmacyAuditLog,
  PharmacyOrder,
  PharmacyOrderItem,
  Prescription,
  PrescriptionReview,
} from "./entities/order.entity";
import { UsersService } from "../users/users.service";

// Prescription photos/scans, not just product photos — a phone camera shot
// of a paper script is the common case, but a PDF scan is common enough
// (many Liberian pharmacies' partner clinics issue printed/PDF scripts) to
// allow too. Re-encoding through processUploadedImage (like /uploads/image
// does) isn't appropriate here: a PDF isn't an image at all, and a
// prescription photo shouldn't be silently recompressed/stripped the same
// way a profile photo is.
const ALLOWED_PRESCRIPTION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_PRESCRIPTION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const NEXT: Record<PharmacyOrderStatus, PharmacyOrderStatus[]> = {
  // Deliberately does NOT list UNDER_REVIEW: createOrder() is the only
  // place an order is ever created there (because it has a prescription
  // attached), never moved into it later. A pending order has no
  // prescription to review, so accepting this jump here would let staff
  // PATCH any ordinary order into under_review and strand it — it can
  // only leave under_review via CANCELLED (below), with no prescription
  // for review() to ever act on.
  [PharmacyOrderStatus.PENDING]: [
    PharmacyOrderStatus.ACCEPTED,
    PharmacyOrderStatus.CANCELLED,
  ],
  // Deliberately does NOT list ACCEPTED/REJECTED: an order only reaches
  // under_review because it has a prescription attached (see createOrder),
  // and that decision belongs to review() alone — the only place that
  // checks the pharmacist role and records a PrescriptionReview. Letting
  // the generic status PATCH (transition(), below) also accept this jump
  // would let any staff member approve a prescription order without ever
  // going through review, silently bypassing that whole check.
  [PharmacyOrderStatus.UNDER_REVIEW]: [PharmacyOrderStatus.CANCELLED],
  [PharmacyOrderStatus.ACCEPTED]: [
    PharmacyOrderStatus.PREPARING,
    PharmacyOrderStatus.CANCELLED,
  ],
  [PharmacyOrderStatus.PREPARING]: [
    PharmacyOrderStatus.READY_FOR_PICKUP,
    PharmacyOrderStatus.OUT_FOR_DELIVERY,
  ],
  [PharmacyOrderStatus.READY_FOR_PICKUP]: [PharmacyOrderStatus.COMPLETED],
  [PharmacyOrderStatus.OUT_FOR_DELIVERY]: [PharmacyOrderStatus.COMPLETED],
  [PharmacyOrderStatus.COMPLETED]: [],
  [PharmacyOrderStatus.REJECTED]: [],
  [PharmacyOrderStatus.CANCELLED]: [],
};

@Injectable()
export class PharmaciesService {
  constructor(
    @InjectRepository(Pharmacy) private pharmacies: Repository<Pharmacy>,
    @InjectRepository(PharmacyStaff) private staff: Repository<PharmacyStaff>,
    @InjectRepository(PharmacyOpeningHours)
    private hours: Repository<PharmacyOpeningHours>,
    @InjectRepository(PharmacyProduct)
    private products: Repository<PharmacyProduct>,
    @InjectRepository(PharmacyInventory)
    private inventory: Repository<PharmacyInventory>,
    @InjectRepository(PharmacyProductCategory)
    private categories: Repository<PharmacyProductCategory>,
    @InjectRepository(PharmacyOrder) private orders: Repository<PharmacyOrder>,
    @InjectRepository(PharmacyOrderItem)
    private orderItems: Repository<PharmacyOrderItem>,
    @InjectRepository(Prescription)
    private prescriptions: Repository<Prescription>,
    @InjectRepository(PrescriptionReview)
    private reviews: Repository<PrescriptionReview>,
    @InjectRepository(PharmacyVerification)
    private verifications: Repository<PharmacyVerification>,
    @InjectRepository(PharmacyAuditLog)
    private audits: Repository<PharmacyAuditLog>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly users: UsersService,
  ) {}

  async directory(q: PharmacyQueryDto) {
    const qb = this.pharmacies
      .createQueryBuilder("p")
      .where("p.status = :approved", { approved: PharmacyStatus.APPROVED });
    if (q.search)
      qb.andWhere(
        new Brackets((x) =>
          x
            .where("p.name ILIKE :s", { s: `%${q.search}%` })
            .orWhere("p.address ILIKE :s", { s: `%${q.search}%` }),
        ),
      );
    if (q.location)
      qb.andWhere("p.location ILIKE :l", { l: `%${q.location}%` });
    if (q.delivery) qb.andWhere("p.delivery_enabled = true");
    if (q.pickup) qb.andWhere("p.pickup_enabled = true");
    if (q.openNow) {
      const day = new Date().getUTCDay(),
        prevDay = (day + 6) % 7,
        time = new Date().toISOString().slice(11, 19);
      // A row is "overnight" when closes_at <= opens_at (e.g. 20:00-08:00)
      // — plain `opens_at <= time AND closes_at > time` is false on both
      // sides of midnight for such a row, and even where it happened to
      // match, this only ever checked *today's* row, never the previous
      // day's overnight interval that's still open after midnight. Match
      // either: today's row, open normally or (if overnight) already past
      // its opening; or yesterday's row, overnight and not yet past its
      // closing.
      qb.innerJoin(
        PharmacyOpeningHours,
        "h",
        `h.pharmacy_id=p.id AND h.is_closed=false AND (
          (h.day_of_week=:day AND (
            (h.closes_at>h.opens_at AND h.opens_at<=:time AND h.closes_at>:time)
            OR (h.closes_at<=h.opens_at AND h.opens_at<=:time)
          ))
          OR (h.day_of_week=:prevDay AND h.closes_at<=h.opens_at AND h.closes_at>:time)
        )`,
        { day, prevDay, time },
      );
    }
    return qb
      .orderBy("p.sponsored", "DESC")
      .addOrderBy("p.name", "ASC")
      .getMany();
  }
  /** Public destination-page lookup (GET /pharmacies?placeId=), same
   * pattern and approved-only gate as BusinessesService.findByPlace — a
   * pharmacy still PENDING/REJECTED/SUSPENDED isn't public yet, even
   * though it's linked to an already-approved place. The owner's own
   * pending pharmacy is still reachable via mine(), not this endpoint. */
  findByPlace(placeId: string) {
    return this.pharmacies.findOne({
      where: { placeId, status: PharmacyStatus.APPROVED },
    });
  }
  async one(slug: string) {
    const pharmacy = await this.pharmacies.findOne({
      where: { slug, status: PharmacyStatus.APPROVED },
    });
    if (!pharmacy) throw new NotFoundException("Pharmacy not found");
    return {
      ...pharmacy,
      openingHours: await this.hours.find({
        where: { pharmacyId: pharmacy.id },
        order: { dayOfWeek: "ASC" },
      }),
    };
  }
  categoriesList() {
    return this.categories.find({ order: { name: "ASC" } });
  }
  async catalog(pharmacyId: string, q: ProductQueryDto) {
    // Public route (no auth) — directory() and one() already gate on
    // approved-only, but this one only checked isVisible on the product
    // itself. Without this, a pharmacy's product list and stock levels
    // stayed fetchable by anyone who already had its UUID even after it
    // was suspended, rejected, or was never approved in the first place.
    const pharmacy = await this.pharmacies.findOneBy({ id: pharmacyId });
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new NotFoundException("Pharmacy not found");
    const where: any = { pharmacyId, isVisible: true };
    if (q.categoryId) where.categoryId = q.categoryId;
    const items = await this.products.find({
      where,
      relations: { category: true },
      order: { name: "ASC" },
    });
    return q.search
      ? items.filter((x) =>
          x.name.toLowerCase().includes(q.search!.toLowerCase()),
        )
      : items;
  }
  // Staff-facing counterpart to catalog() — that one only ever returns
  // isVisible products (it's the public storefront read), which left staff
  // with no way to see, edit, or delete a product they'd hidden. No
  // approved-only gate either: staff still needs to manage their own
  // catalog while the pharmacy itself is pending/suspended.
  async myProducts(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    return this.products.find({
      where: { pharmacyId },
      relations: { category: true },
      order: { name: "ASC" },
    });
  }
  async assertStaff(userId: string, pharmacyId: string) {
    const member = await this.staff.findOne({
      where: { userId, pharmacyId, active: true },
    });
    if (!member)
      throw new ForbiddenException("You are not authorized for this pharmacy");
    return member;
  }
  async mine(userId: string) {
    const memberships = await this.staff.find({
      where: { userId, active: true },
    });
    if (!memberships.length) return [];
    // Opt back into the `select: false` licenceNumber column (same
    // pattern as saveProfile()/verification()) — staff managing their own
    // pharmacy need to see whether one is already on file, since
    // ProfileForm is the only place they can add or correct it after an
    // application was submitted without one.
    return this.pharmacies
      .createQueryBuilder("p")
      .addSelect("p.licenceNumber")
      .where("p.id IN (:...ids)", {
        ids: memberships.map((x) => x.pharmacyId),
      })
      .getMany();
  }
  async saveProfile(
    userId: string,
    id: string | undefined,
    dto: PharmacyProfileDto,
    // Internal-only, never set from the controller/DTO — used solely by
    // autoClaimSubmittedPlace to link a new application back to the Place
    // it originated from. Ignored entirely on the `id` (edit) branch: what
    // a pharmacy is linked to isn't something a later profile edit should
    // ever be able to change.
    opts?: { placeId?: string },
  ) {
    if (id) await this.assertStaff(userId, id);
    // An admin verified this exact licenceNumber (see verification()) — if
    // staff change it afterward, the pharmacy keeps showing the "approved"
    // badge for evidence nobody has actually reviewed. Any licence change
    // on an already-approved pharmacy must go back through admin review.
    // licenceNumber is optional on the DTO, and mine()/the dashboard list
    // never return it (select: false) for a caller to round-trip — a
    // normal PATCH built from that response omits the field entirely, and
    // must be read as "unchanged", not as clearing it to null.
    const licenceProvided = dto.licenceNumber !== undefined;

    // The pharmacy row, its initial manager membership (new applications
    // only), and the audit entry are one unit — without a transaction, a
    // failure partway through (e.g. the membership insert) leaves an
    // orphan pharmacy the applicant can't reach through mine() and can't
    // retry without creating a duplicate application.
    const run = async (
      pharmacyRepo: Repository<Pharmacy>,
      staffRepo: Repository<PharmacyStaff>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      let saved: Pharmacy;
      if (!id) {
        const created = Object.assign(
          pharmacyRepo.create({ status: PharmacyStatus.PENDING }),
          dto,
          {
            slug: `${slugify(dto.name)}-${Date.now().toString(36)}`,
            placeId: opts?.placeId ?? null,
          },
        );
        saved = await pharmacyRepo.save(created);
        await staffRepo.save(
          staffRepo.create({
            pharmacyId: saved.id,
            userId,
            role: "manager" as any,
            active: true,
          }),
        );
      } else {
        // Locked and read *inside* the transaction, not before it — an
        // earlier fix (see saveProfile()'s history) computed licenceChanged
        // from a read taken before the transaction started, which left a
        // window where an admin's concurrent approval between that read and
        // this write wouldn't be reflected, letting a licence change on a
        // since-approved pharmacy skip the pending reset entirely. Locking
        // here also serializes against verification()'s own UPDATE of this
        // same row — a concurrent admin decision blocks until this
        // transaction commits, then this read (or that write) sees it.
        // licenceNumber is `select: false` (see verification()'s comment on
        // the same column) — opt back in via the query builder, same as
        // verification()/applications() do, or a plain read would come back
        // with it `undefined` and make every update look like a change.
        const current = await pharmacyRepo
          .createQueryBuilder("p")
          .setLock("pessimistic_write")
          .addSelect("p.licenceNumber")
          .where("p.id = :id", { id })
          .getOneOrFail();
        const licenceChanged =
          current.status === PharmacyStatus.APPROVED &&
          licenceProvided &&
          dto.licenceNumber !== (current.licenceNumber ?? null);
        // Only the DTO-controlled columns are written here — never a full
        // entity save(), which would silently overwrite a status an admin
        // changed concurrently back to whatever this request last observed.
        const patch: Partial<Pharmacy> = {
          name: dto.name,
          address: dto.address,
          location: dto.location,
          telephone: dto.telephone,
          pickupEnabled: dto.pickupEnabled,
          deliveryEnabled: dto.deliveryEnabled,
          deliveryFee: dto.deliveryFee,
          // logoUrl/coverUrl and licenceNumber are all optional on the DTO
          // for the same reason: a caller updating unrelated fields sends a
          // PATCH built from what mine()/the dashboard list returned, which
          // omits any field it didn't touch. Treating that omission as
          // "clear it" would erase the existing images (or licence) on
          // every unrelated edit, so only write these when explicitly sent
          // — but an explicit `null` for logoUrl/coverUrl/latitude/longitude
          // *does* pass through here (the check is `!== undefined`, not
          // truthiness), so the profile form can still remove one of these
          // once it's been set, rather than being stuck replace-only.
          ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
          ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(licenceProvided ? { licenceNumber: dto.licenceNumber } : {}),
        };
        await pharmacyRepo.update({ id }, patch);
        // Reset to pending only if the pharmacy is *still* approved — the
        // row lock above already guarantees `current.status` reflects the
        // latest committed state, so this condition (unlike a bare update)
        // exists only to skip a needless write, not to resolve a race.
        let resultStatus = current.status;
        if (licenceChanged) {
          const result = await pharmacyRepo.update(
            { id, status: PharmacyStatus.APPROVED },
            { status: PharmacyStatus.PENDING },
          );
          if (result.affected) resultStatus = PharmacyStatus.PENDING;
        }
        saved = { ...current, ...patch, id, status: resultStatus } as Pharmacy;
      }
      await this.audit(
        userId,
        saved.id,
        id ? "pharmacy.updated" : "pharmacy.applied",
        "pharmacy",
        saved.id,
        {},
        auditRepo,
      );
      return saved;
    };
    const manager = this.pharmacies.manager;
    return manager?.transaction
      ? manager.transaction((tx) =>
          run(
            tx.getRepository(Pharmacy),
            tx.getRepository(PharmacyStaff),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : run(this.pharmacies, this.staff, this.audits);
  }
  /** Auto-claims a self-submitted Place as a Pharmacy on the submitter's
   * behalf, mirroring BusinessesService.autoClaimSubmittedPlace exactly —
   * a submitter picking the dedicated "Pharmacy" category on the ordinary
   * place-submission form shouldn't also have to separately find and fill
   * out this module's own application form for the same listing. Called
   * from PlacesService.submitPlace (gated on the place's category — see
   * that method's own doc comment) and, like the Business auto-claim,
   * never lets a hiccup here fail the primary place-creation response.
   * Reuses saveProfile's own "new application" path (transaction, initial
   * manager membership, audit entry) rather than duplicating it.
   *
   * Place has no separate street-address field (just city/county), so
   * `address` seeds from the city as a starting point — ProfileForm's own
   * required address input is where the owner narrows this to something
   * customers can actually find. `submission.contactPhone` is required
   * here (not optional, unlike the Business mapping's `phone`): a
   * pharmacy's telephone column is NOT NULL, and submitPlace() itself
   * rejects a pharmacy-category submission with no contact phone before
   * this ever runs. */
  autoClaimSubmittedPlace(
    userId: string,
    place: Place,
    submission: CreatePlaceSubmissionDto,
  ) {
    return this.saveProfile(
      userId,
      undefined,
      {
        name: submission.name,
        address: submission.city,
        location: submission.city,
        telephone: submission.contactPhone!,
        pickupEnabled: true,
        deliveryEnabled: false,
        deliveryFee: 0,
        latitude: submission.latitude,
        longitude: submission.longitude,
      },
      { placeId: place.id },
    );
  }
  // Staff-facing read — one() (the public storefront lookup) only works
  // for an already-approved pharmacy, so a pending application has no
  // other way to load its own hours for editing.
  async getOpeningHours(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    return this.hours.find({
      where: { pharmacyId },
      order: { dayOfWeek: "ASC" },
    });
  }
  // The only path that can ever populate pharmacy_opening_hours —
  // directory()'s openNow filter inner-joins that table, so without this
  // no pharmacy created through the application flow (or seeded) could
  // ever match it, and the filter always returned an empty directory.
  async saveOpeningHours(
    userId: string,
    pharmacyId: string,
    dto: SaveOpeningHoursDto,
  ) {
    await this.assertStaff(userId, pharmacyId);
    if (dto.hours.length === 0)
      return this.hours.find({
        where: { pharmacyId },
        order: { dayOfWeek: "ASC" },
      });
    // Two entries for the same dayOfWeek both pass DTO validation (nothing
    // there checks across array entries) but target the same (pharmacyId,
    // dayOfWeek) conflict key — Postgres's ON CONFLICT DO UPDATE refuses to
    // touch the same row twice in one statement, so this would otherwise
    // surface as a raw 500 instead of a 400 for what's simply bad input.
    const seenDays = new Set<number>();
    for (const h of dto.hours) {
      if (seenDays.has(h.dayOfWeek))
        throw new BadRequestException(
          `Duplicate entry for day ${h.dayOfWeek} — submit at most one entry per day`,
        );
      seenDays.add(h.dayOfWeek);
    }
    await this.hours.upsert(
      dto.hours.map((h) => ({
        pharmacyId,
        dayOfWeek: h.dayOfWeek,
        // A closed day's times are meaningless — store null rather than
        // whatever stale opensAt/closesAt the form still had, so a later
        // read can't show a closed day with leftover hours.
        opensAt: h.isClosed ? null : (h.opensAt ?? null),
        closesAt: h.isClosed ? null : (h.closesAt ?? null),
        isClosed: h.isClosed,
      })),
      ["pharmacyId", "dayOfWeek"],
    );
    return this.hours.find({
      where: { pharmacyId },
      order: { dayOfWeek: "ASC" },
    });
  }
  // The only way a pharmacy gets any staff beyond the manager saveProfile()
  // creates automatically for a new application — without this, a freshly
  // onboarded pharmacy has no pharmacist, and review() (correctly) refuses
  // every non-pharmacist decision, so it could never approve a prescription
  // order except through direct DB access.
  async assignStaff(
    managerId: string,
    pharmacyId: string,
    dto: AssignStaffDto,
  ) {
    const manager = await this.assertStaff(managerId, pharmacyId);
    if (manager.role !== PharmacyStaffRole.MANAGER)
      throw new ForbiddenException(
        "Only a manager on staff can assign staff roles",
      );
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new NotFoundException("No account found for that email");

    const run = async (
      staffRepo: Repository<PharmacyStaff>,
      auditRepo: Repository<PharmacyAuditLog>,
      countActiveManagers: () => Promise<number>,
    ) => {
      let member = await staffRepo.findOne({
        where: { pharmacyId, userId: user.id },
      });
      // If this call would demote the pharmacy's only active manager (most
      // often a manager doing it to themselves), refuse it: this same
      // endpoint requires the caller already be a manager, so once the last
      // one is gone nobody can assign a replacement without direct DB
      // access. countActiveManagers() locks the pharmacy's active-manager
      // rows when running inside a real transaction (see below), so two
      // concurrent demotions can't both observe a count above 1 before
      // either commits — the second blocks until the first commits, then
      // re-reads the now-updated membership.
      if (
        member?.role === PharmacyStaffRole.MANAGER &&
        member.active &&
        dto.role !== PharmacyStaffRole.MANAGER
      ) {
        if ((await countActiveManagers()) <= 1)
          throw new ConflictException(
            "Cannot demote the pharmacy's only manager — assign another manager first",
          );
      }
      member = Object.assign(
        member ?? staffRepo.create({ pharmacyId, userId: user.id }),
        { role: dto.role, active: true },
      );
      const saved = await staffRepo.save(member);
      await this.audit(
        managerId,
        pharmacyId,
        "staff.assigned",
        "staff",
        saved.id,
        { userId: user.id, role: dto.role },
        auditRepo,
      );
      return saved;
    };

    const txManager = this.staff.manager;
    if (txManager?.transaction) {
      return txManager.transaction((tx) => {
        const staffRepo = tx.getRepository(PharmacyStaff);
        return run(staffRepo, tx.getRepository(PharmacyAuditLog), async () => {
          // Postgres rejects `SELECT count(*) ... FOR UPDATE` outright
          // ("FOR UPDATE is not allowed with aggregate functions") — fetch
          // and lock the matching rows instead, and count them in JS.
          const locked = await staffRepo
            .createQueryBuilder("s")
            .setLock("pessimistic_write")
            .where("s.pharmacyId = :pharmacyId", { pharmacyId })
            .andWhere("s.role = :role", { role: PharmacyStaffRole.MANAGER })
            .andWhere("s.active = :active", { active: true })
            .getMany();
          return locked.length;
        });
      });
    }
    return run(this.staff, this.audits, () =>
      this.staff.count({
        where: { pharmacyId, role: PharmacyStaffRole.MANAGER, active: true },
      }),
    );
  }
  // The only way a departed staff member's access is ever actually
  // revoked — assignStaff() can only create or reassign a membership
  // (always forcing active back to true), so without this a pharmacist or
  // employee who leaves keeps read access to every private prescription
  // and write access to products/orders indefinitely. Deactivating (not
  // deleting) keeps the row's audit history — see assertStaff() and
  // mine(), which both already filter on active: true, so this takes
  // effect immediately for every pharmacy-scoped route.
  async deactivateStaff(
    managerId: string,
    pharmacyId: string,
    staffUserId: string,
  ) {
    const manager = await this.assertStaff(managerId, pharmacyId);
    if (manager.role !== PharmacyStaffRole.MANAGER)
      throw new ForbiddenException(
        "Only a manager on staff can deactivate staff",
      );

    const run = async (
      staffRepo: Repository<PharmacyStaff>,
      auditRepo: Repository<PharmacyAuditLog>,
      countActiveManagers: () => Promise<number>,
    ) => {
      const member = await staffRepo.findOne({
        where: { pharmacyId, userId: staffUserId, active: true },
      });
      if (!member) throw new NotFoundException("No active staff member found");
      // Same last-manager invariant as the demotion path in assignStaff()
      // above — a pharmacy can never be left with zero active managers,
      // since nobody could then assign a replacement without direct DB
      // access. countActiveManagers() locks the active-manager rows when
      // running inside a real transaction, serializing this against a
      // concurrent deactivation or demotion the same way assignStaff() does.
      if (member.role === PharmacyStaffRole.MANAGER) {
        if ((await countActiveManagers()) <= 1)
          throw new ConflictException(
            "Cannot deactivate the pharmacy's only manager — assign another manager first",
          );
      }
      member.active = false;
      const saved = await staffRepo.save(member);
      await this.audit(
        managerId,
        pharmacyId,
        "staff.deactivated",
        "staff",
        saved.id,
        { userId: staffUserId },
        auditRepo,
      );
      return saved;
    };

    const txManager = this.staff.manager;
    if (txManager?.transaction) {
      return txManager.transaction((tx) => {
        const staffRepo = tx.getRepository(PharmacyStaff);
        return run(staffRepo, tx.getRepository(PharmacyAuditLog), async () => {
          const locked = await staffRepo
            .createQueryBuilder("s")
            .setLock("pessimistic_write")
            .where("s.pharmacyId = :pharmacyId", { pharmacyId })
            .andWhere("s.role = :role", { role: PharmacyStaffRole.MANAGER })
            .andWhere("s.active = :active", { active: true })
            .getMany();
          return locked.length;
        });
      });
    }
    return run(this.staff, this.audits, () =>
      this.staff.count({
        where: { pharmacyId, role: PharmacyStaffRole.MANAGER, active: true },
      }),
    );
  }
  async saveProduct(
    userId: string,
    pharmacyId: string,
    id: string | undefined,
    dto: ProductDto,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const category = await this.categories.findOneBy({ id: dto.categoryId });
    if (!category) throw new BadRequestException("Unknown category");
    let product = id ? await this.products.findOneBy({ id, pharmacyId }) : null;
    if (id && !product)
      throw new NotFoundException("Product not found in this pharmacy");
    product = Object.assign(
      product ?? this.products.create({ pharmacyId }),
      dto,
    );

    // The product row, its inventory upsert, and the audit entry are one
    // unit — without a transaction, a failure partway through (e.g. the
    // inventory upsert) leaves a product with no inventory row while the
    // endpoint reports failure, and a retry can create a duplicate since
    // product names aren't unique per pharmacy.
    const run = async (
      productRepo: Repository<PharmacyProduct>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const saved = await productRepo.save(product);
      if (!id) {
        // A new product has no prior stock to race against.
        await inventoryRepo.upsert(
          { productId: saved.id, quantity: dto.stockQuantity },
          ["productId"],
        );
      } else if (dto.previousStockQuantity !== undefined) {
        // Applied as a delta off whatever is *actually* stored right now,
        // not an absolute overwrite of the count this edit form loaded —
        // see ProductDto.previousStockQuantity's own doc comment for the
        // lost-update this closes (a concurrent checkout decrement landing
        // while the form sat open). Locked first so that decrement can't
        // land between this read and the update below.
        const current = await inventoryRepo
          .createQueryBuilder("inv")
          .setLock("pessimistic_write")
          .where("inv.productId = :productId", { productId: saved.id })
          .getOne();
        // Idempotency guard: a lost response (network drop, double click)
        // retries this exact request, and without this check the delta
        // below gets applied a second time on top of the count the first
        // attempt already committed — e.g. 10→15 commits, the retry still
        // carries previousStockQuantity: 10, and re-adding +5 writes 20.
        // Once the stored quantity already matches this edit's own target,
        // treat it as already applied and skip — same outcome, no double
        // credit. This only short-circuits an exact match with what this
        // save already asked for; a genuine concurrent change (the
        // decrement race this delta exists to handle) leaves the stored
        // quantity different from the target, so the delta still applies
        // normally below.
        if (current?.quantity !== dto.stockQuantity) {
          const delta = dto.stockQuantity - dto.previousStockQuantity;
          const nextQuantity = Math.max(0, (current?.quantity ?? 0) + delta);
          await inventoryRepo.upsert(
            { productId: saved.id, quantity: nextQuantity },
            ["productId"],
          );
        }
      }
      // else: an edit that didn't say what it originally saw leaves stock
      // untouched entirely — same "omitted means unchanged" convention as
      // logoUrl/coverUrl/licenceNumber elsewhere in this file.
      await this.audit(
        userId,
        pharmacyId,
        id ? "product.updated" : "product.created",
        "product",
        saved.id,
        {},
        auditRepo,
      );
      return saved;
    };
    const manager = this.products.manager;
    const saved = manager?.transaction
      ? await manager.transaction((tx) =>
          run(
            tx.getRepository(PharmacyProduct),
            tx.getRepository(PharmacyInventory),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : await run(this.products, this.inventory, this.audits);
    return this.products.findOneOrFail({ where: { id: saved.id } });
  }
  async removeProduct(userId: string, pharmacyId: string, id: string) {
    await this.assertStaff(userId, pharmacyId);

    // The delete and its audit entry are one unit — otherwise a failure in
    // the audit write after the delete has already committed reports an
    // error for a deletion that, in fact, already took effect, and a retry
    // only ever sees a 404 with the required deletion audit still missing.
    const run = async (
      productRepo: Repository<PharmacyProduct>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const result = await productRepo.delete({ id, pharmacyId });
      if (!result.affected)
        throw new NotFoundException("Product not found in this pharmacy");
      await this.audit(
        userId,
        pharmacyId,
        "product.deleted",
        "product",
        id,
        {},
        auditRepo,
      );
    };
    const manager = this.products.manager;
    return manager?.transaction
      ? manager.transaction((tx) =>
          run(
            tx.getRepository(PharmacyProduct),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : run(this.products, this.audits);
  }
  async createOrder(userId: string, dto: CreateOrderDto) {
    if (!dto.items.length) throw new BadRequestException("Your cart is empty");
    // Checked against the trimmed value — the DTO's length validation and
    // this check both pass for a whitespace-only address ("     "), which
    // then trims to nothing when it's actually saved a few lines down,
    // leaving an order with no usable delivery destination.
    const trimmedDeliveryAddress = dto.deliveryAddress?.trim();

    // Aggregate quantities per product first — the cart can list the same
    // productId on more than one line (e.g. added in two separate clicks).
    // Checking/reserving stock per *line* instead of per product lets two
    // lines each pass a "quantity <= stock" check against the same
    // pre-decrement stock figure, then have the second decrement violate
    // the DB's CHECK(quantity>=0) after the first has already landed.
    const quantityByProduct = new Map<string, number>();
    for (const item of dto.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    // CartItemDto's @Max(100) validates each line independently, so
    // splitting one product across several lines (e.g. 100 + 100) passes
    // DTO validation and only gets caught here, after aggregation — without
    // this, checkout would silently accept a per-product quantity the UI
    // and DTO both intend to cap at 100 whenever stock allows it.
    for (const quantity of quantityByProduct.values()) {
      if (quantity > 100)
        throw new BadRequestException(
          "Cart contains more than 100 units of the same product",
        );
    }
    const ids = [...quantityByProduct.keys()];

    const persist = async (
      pharmacyRepo: Repository<Pharmacy>,
      productRepo: Repository<PharmacyProduct>,
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      prescriptionRepo: Repository<Prescription>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      // Locked and read inside the transaction, not before it — a
      // pre-transaction read left a window where an admin could suspend or
      // reject the pharmacy after this request passed its approval check
      // but before the order was actually created, letting checkout
      // reserve inventory for a pharmacy already declared unsafe.
      const pharmacy = await pharmacyRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: dto.pharmacyId })
        .getOne();
      if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
        throw new BadRequestException(
          "This pharmacy is not approved to receive orders",
        );
      if (
        dto.fulfillmentMethod === FulfillmentMethod.DELIVERY &&
        (!pharmacy.deliveryEnabled || !trimmedDeliveryAddress)
      )
        throw new BadRequestException("A delivery address is required");
      if (
        dto.fulfillmentMethod === FulfillmentMethod.PICKUP &&
        !pharmacy.pickupEnabled
      )
        throw new BadRequestException("Pickup is unavailable");

      // Locked the same way — staff could otherwise change a product's
      // price, prescriptionRequired flag, or visibility between the cart
      // being built and checkout running here, letting a since-restricted
      // product go through as an ordinary order, or a stale price be
      // charged.
      const products = await productRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id IN (:...ids)", { ids })
        .andWhere("p.pharmacyId = :pharmacyId", { pharmacyId: dto.pharmacyId })
        .andWhere("p.isVisible = true")
        .getMany();
      if (products.length !== ids.length)
        throw new BadRequestException("Cart contains an unavailable product");
      const inventories = await inventoryRepo.find({
        where: { productId: In(ids) },
      });
      const inventoryByProductId = new Map(
        inventories.map((x) => [x.productId, x]),
      );
      const map = new Map(products.map((x) => [x.id, x]));
      let requires = false;
      const lines = ids.map((id) => {
        const p = map.get(id)!;
        const quantity = quantityByProduct.get(id)!;
        const inventory = inventoryByProductId.get(id);
        if (!inventory || inventory.quantity < quantity)
          throw new ConflictException(`${p.name} does not have enough stock`);
        requires ||= p.prescriptionRequired;
        return itemRepo.create({
          productId: p.id,
          name: p.name,
          unitPrice: p.price,
          quantity,
          prescriptionRequired: p.prescriptionRequired,
        });
      });
      if (
        requires &&
        (!dto.prescriptionId || !dto.consentToPrescriptionProcessing)
      )
        throw new BadRequestException(
          "Prescription upload and consent are required; upload does not guarantee approval",
        );

      // Validate the prescription *before* writing anything — findOne
      // here, not after the order/items are already saved, so a bad
      // prescriptionId (nonexistent, someone else's, a different
      // pharmacy's, or already attached to another order) fails with
      // nothing persisted rather than leaving a phantom under_review order
      // behind.
      let prescription: Prescription | null = null;
      if (requires) {
        prescription = await prescriptionRepo.findOne({
          where: {
            id: dto.prescriptionId,
            customerUserId: userId,
            pharmacyId: dto.pharmacyId,
            orderId: IsNull(),
          },
        });
        if (!prescription)
          throw new BadRequestException(
            "Prescription is not available for this pharmacy",
          );
      }

      const { subtotal, delivery, total } = calculatePharmacyTotals(
        lines,
        dto.fulfillmentMethod,
        Number(pharmacy.deliveryFee),
      );

      const order = await orderRepo.save(
        orderRepo.create({
          pharmacyId: pharmacy.id,
          customerUserId: userId,
          fulfillmentMethod: dto.fulfillmentMethod,
          deliveryAddress: trimmedDeliveryAddress || null,
          productSubtotal: subtotal,
          deliveryFee: delivery,
          platformFee: 0,
          finalTotal: total,
          status: requires
            ? PharmacyOrderStatus.UNDER_REVIEW
            : PharmacyOrderStatus.PENDING,
        }),
      );
      await itemRepo.save(
        lines.map((x) => Object.assign(x, { orderId: order.id })),
      );
      if (prescription) {
        // Conditioned on orderId still being null, and checked for exactly
        // one affected row — without this, two concurrent checkouts that
        // both read the same unattached prescription in the findOne above
        // would both pass this update, the second one silently
        // reassigning the prescription away from whichever order it had
        // just been attached to. This UPDATE's row lock is what actually
        // serializes that race: a concurrent transaction attempting the
        // same conditional update blocks until this one commits, then
        // re-evaluates orderId IS NULL against the now-committed row and
        // finds it no longer matches.
        const result = await prescriptionRepo.update(
          { id: prescription.id, orderId: IsNull() },
          { orderId: order.id },
        );
        if (!result.affected)
          throw new ConflictException(
            "This prescription was just used for another order",
          );
      }
      for (const [productId, quantity] of quantityByProduct) {
        try {
          await inventoryRepo.decrement({ productId }, "quantity", quantity);
        } catch {
          // Someone else's order landed between our availability check
          // above and this write and took the remaining stock — the DB's
          // CHECK(quantity>=0) is the real backstop against overselling;
          // surface it the same way the pre-check above does.
          throw new ConflictException(
            `${map.get(productId)!.name} does not have enough stock`,
          );
        }
      }
      // Logged inside the same transaction as the order/items/inventory
      // writes — a standalone post-commit audit call would let a failure
      // here (a DB blip, a constraint the audit table alone enforces)
      // return an error to the customer for an order that had already
      // fully succeeded, inviting a retry that pays and reserves stock
      // twice for what looks to them like one checkout.
      await this.audit(
        userId,
        pharmacy.id,
        "order.created",
        "order",
        order.id,
        {},
        auditRepo,
      );
      return order;
    };

    // Wrapped in a transaction so a mid-flight failure (the stock-check
    // race above, or anything else) can't leave an order with some but
    // not all of its items/inventory/prescription-link/audit-log written.
    const manager = this.orders.manager;
    const order = manager?.transaction
      ? await manager.transaction((tx) =>
          persist(
            tx.getRepository(Pharmacy),
            tx.getRepository(PharmacyProduct),
            tx.getRepository(PharmacyOrder),
            tx.getRepository(PharmacyOrderItem),
            tx.getRepository(PharmacyInventory),
            tx.getRepository(Prescription),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : await persist(
          this.pharmacies,
          this.products,
          this.orders,
          this.orderItems,
          this.inventory,
          this.prescriptions,
          this.audits,
        );

    return this.orderDetail(order.id);
  }
  async customerOrders(userId: string) {
    const orders = await this.orders.find({
      where: { customerUserId: userId },
      order: { createdAt: "DESC" },
    });
    // Same reasoning as pharmacyOrders() below: without line items, a
    // customer with several orders of the same total can't tell them apart
    // on an order-history page. One extra query, not N+1.
    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length
      ? await this.orderItems.find({ where: { orderId: In(orderIds) } })
      : [];
    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId);
      if (bucket) bucket.push(item);
      else itemsByOrderId.set(item.orderId, [item]);
    }
    // A prescription-required order's only customer-visible signal was
    // ever "under review" — when a pharmacist requests clarification (see
    // review()), the customer had no way to see the request at all, let
    // alone respond to it (that's what resubmitPrescription() is for).
    // Surface the prescription id and its latest review decision/notes.
    const prescriptions = orderIds.length
      ? await this.prescriptions.find({ where: { orderId: In(orderIds) } })
      : [];
    const prescriptionIdByOrderId = new Map(
      prescriptions.map((p) => [p.orderId as string, p.id]),
    );
    const prescriptionIds = prescriptions.map((p) => p.id);
    const reviews = prescriptionIds.length
      ? await this.reviews.find({
          where: { prescriptionId: In(prescriptionIds) },
          order: { createdAt: "DESC" },
        })
      : [];
    // find() above is ordered newest-first, so the first review seen per
    // prescriptionId is its latest.
    const latestReviewByPrescriptionId = new Map<string, PrescriptionReview>();
    for (const review of reviews) {
      if (!latestReviewByPrescriptionId.has(review.prescriptionId))
        latestReviewByPrescriptionId.set(review.prescriptionId, review);
    }
    return orders.map((o) => {
      const prescriptionId = prescriptionIdByOrderId.get(o.id) ?? null;
      const latestReview = prescriptionId
        ? latestReviewByPrescriptionId.get(prescriptionId)
        : undefined;
      return {
        ...o,
        items: itemsByOrderId.get(o.id) ?? [],
        prescriptionId,
        latestReviewDecision: latestReview?.decision ?? null,
        // Notes are only ever customer-facing for a clarification request —
        // that's the one case a pharmacist is told (on the dashboard) their
        // notes will be shown to the customer. An accept/reject's notes may
        // carry internal clinical/operational rationale never meant for the
        // customer, so withhold them on a terminal decision.
        latestReviewNotes:
          latestReview?.decision ===
          PrescriptionDecision.CLARIFICATION_REQUESTED
            ? (latestReview?.notes ?? null)
            : null,
      };
    });
  }
  // Lets a customer reply to a pharmacist's clarification_requested
  // decision by uploading a replacement prescription file for the same
  // order — without this there was no customer-facing way to act on a
  // clarification request; the order would sit under_review until a
  // pharmacist eventually decided without ever receiving one.
  async resubmitPrescription(
    userId: string,
    orderId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ) {
    if (!ALLOWED_PRESCRIPTION_MIME_TYPES.includes(file.mimeType))
      throw new BadRequestException(
        "Only JPEG, PNG, WebP images or a PDF are allowed",
      );
    if (file.buffer.length > MAX_PRESCRIPTION_FILE_SIZE_BYTES)
      throw new BadRequestException("Prescription file is larger than 10MB");
    const order = await this.orders.findOneBy({
      id: orderId,
      customerUserId: userId,
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== PharmacyOrderStatus.UNDER_REVIEW)
      throw new ConflictException("This order is no longer awaiting review");
    // privateStorageKey is `select: false` on the entity (see its own doc
    // comment) — a plain find() leaves it `undefined`, which would make
    // the "delete the superseded file" step below silently do nothing.
    // Opt back in explicitly, the same way saveProfile()/verification()
    // do for Pharmacy.licenceNumber.
    const prescription = await this.prescriptions.findOne({
      where: { orderId, customerUserId: userId },
      select: {
        id: true,
        orderId: true,
        customerUserId: true,
        pharmacyId: true,
        privateStorageKey: true,
        originalFilename: true,
        mimeType: true,
        createdAt: true,
      },
    });
    if (!prescription)
      throw new NotFoundException("Prescription not found for this order");
    // Only accept a resubmission when the pharmacist actually asked for
    // one — otherwise a customer could overwrite the very file a
    // pharmacist is mid-review on, or one already accepted/rejected. Once
    // consumed (fulfilledAt set, below), the same clarification request
    // can't be used for a second replacement — otherwise the customer
    // could keep resubmitting indefinitely against a single request, each
    // time invalidating whatever version the pharmacist has open.
    const latestReview = await this.reviews.findOne({
      where: { prescriptionId: prescription.id },
      order: { createdAt: "DESC" },
    });
    if (
      latestReview?.decision !== PrescriptionDecision.CLARIFICATION_REQUESTED ||
      latestReview.fulfilledAt
    )
      throw new ConflictException(
        "A new prescription can only be submitted after a pharmacist requests clarification",
      );
    const filename = `prescriptions/${randomUUID()}${extname(file.originalName).slice(0, 10)}`;
    const { key } = await this.storage.savePrivate({
      buffer: file.buffer,
      filename,
      contentType: file.mimeType,
    });

    // The checks above are only the sequential case — a pharmacist can
    // still accept or reject this prescription between them and the write
    // below, which would otherwise let this resubmission silently replace
    // the very file that decision was made on. Lock the order row the same
    // way review()'s own clarification-request branch does, and recheck
    // both it and the latest review after acquiring the lock: a concurrent
    // decision either already committed (and this now correctly refuses)
    // or is blocked behind this lock until its own transaction commits.
    // This same order lock also serializes two concurrent resubmissions
    // against each other — both requests target the same row, so the
    // second one blocks here until the first's transaction commits.
    const run = async (
      orderRepo: Repository<PharmacyOrder>,
      reviewRepo: Repository<PrescriptionReview>,
      prescriptionRepo: Repository<Prescription>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const lockedOrder = await orderRepo
        .createQueryBuilder("o")
        .setLock("pessimistic_write")
        .where("o.id = :orderId", { orderId })
        .andWhere("o.customerUserId = :userId", { userId })
        .getOne();
      if (
        !lockedOrder ||
        lockedOrder.status !== PharmacyOrderStatus.UNDER_REVIEW
      )
        throw new ConflictException("This order is no longer awaiting review");
      const stillNeedsClarification = await reviewRepo
        .createQueryBuilder("r")
        .setLock("pessimistic_write")
        .where("r.prescriptionId = :prescriptionId", {
          prescriptionId: prescription.id,
        })
        .orderBy("r.createdAt", "DESC")
        .getOne();
      if (
        stillNeedsClarification?.decision !==
          PrescriptionDecision.CLARIFICATION_REQUESTED ||
        stillNeedsClarification.fulfilledAt
      )
        throw new ConflictException(
          "A new prescription can only be submitted after a pharmacist requests clarification",
        );
      // Read (and lock) the key that's *actually* stored right now, not
      // the one captured before this transaction started — two
      // resubmissions racing each other both serialize on the order lock
      // above, but the second one's pre-transaction read of the old key
      // is stale by the time it gets here: the first resubmission has
      // already overwritten it with its own new key. Deleting that stale
      // key on success would silently leave the first resubmission's file
      // (the one this second request is actually superseding) orphaned in
      // storage forever, with no database row left pointing to it.
      const current = await prescriptionRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .addSelect("p.privateStorageKey")
        .where("p.id = :id", { id: prescription.id })
        .getOneOrFail();
      const previousKey = current.privateStorageKey;
      // Bumped under the same lock the key itself is read under, so a
      // pharmacist's review() (which checks this against the version it
      // was handed) can never be satisfied by a version that predates
      // bytes actually written to storage.
      // Consumed under the same lock this row was just read+locked under —
      // this specific clarification request can now never satisfy another
      // resubmission attempt, sequential or concurrent.
      await reviewRepo.update(
        { id: stillNeedsClarification.id },
        { fulfilledAt: new Date() },
      );
      await prescriptionRepo.update(
        { id: prescription.id },
        {
          privateStorageKey: key,
          originalFilename: file.originalName,
          mimeType: file.mimeType,
          version: current.version + 1,
        },
      );
      await this.audit(
        userId,
        order.pharmacyId,
        "prescription.resubmitted",
        "prescription",
        prescription.id,
        {},
        auditRepo,
      );
      return previousKey;
    };
    const manager = this.orders.manager;
    let previousKey: string;
    try {
      previousKey = manager?.transaction
        ? await manager.transaction((tx) =>
            run(
              tx.getRepository(PharmacyOrder),
              tx.getRepository(PrescriptionReview),
              tx.getRepository(Prescription),
              tx.getRepository(PharmacyAuditLog),
            ),
          )
        : await run(this.orders, this.reviews, this.prescriptions, this.audits);
    } catch (err) {
      // The new object was already written above — a refused replacement
      // (the recheck lost the race) leaves it orphaned exactly like a
      // successful one leaves the old one orphaned below. Same best-effort
      // cleanup, same reasoning: never let a storage failure fail the
      // response the caller is waiting on for an error that already has
      // its own outcome.
      await this.storage.deletePrivate(key).catch(() => {});
      throw err;
    }

    // The file the pharmacist reviewed (or was about to) is now replaced —
    // no database row references it anymore, and nothing else will ever
    // clean it up (the storage interface has no listing/GC job), so delete
    // it once the replacement is safely committed. Best-effort: a delete
    // failure here must not fail the resubmission the customer is waiting
    // on.
    if (previousKey) {
      await this.storage.deletePrivate(previousKey).catch(() => {});
    }

    return { id: prescription.id };
  }
  async pharmacyOrders(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    const orders = await this.orders.find({
      where: { pharmacyId },
      order: { createdAt: "DESC" },
    });
    const orderIds = orders.map((o) => o.id);
    // PharmacyOrder itself has no prescription reference (the FK points
    // the other way — Prescription.orderId), so without this a staff
    // member has no way to discover the id review()/prescriptionFile()
    // need for an under_review order: neither route is reachable from the
    // order queue alone. One extra query rather than N+1 per order.
    const prescriptions = orderIds.length
      ? await this.prescriptions.find({ where: { orderId: In(orderIds) } })
      : [];
    const prescriptionIdByOrderId = new Map(
      prescriptions.map((p) => [p.orderId as string, p.id]),
    );
    // The version this listing reflects — ReviewForm resubmits it with the
    // decision, and review() rejects a stale one, so staff who let the
    // dashboard sit open through a resubmission are forced to reload
    // before their Accept/Reject can apply to bytes they never saw.
    const prescriptionVersionByOrderId = new Map(
      prescriptions.map((p) => [p.orderId as string, p.version]),
    );
    // Same story for line items: staff preparing an order need to know
    // what's actually in it (product names, quantities), and there was no
    // other route exposing that — just totals and a status.
    const items = orderIds.length
      ? await this.orderItems.find({ where: { orderId: In(orderIds) } })
      : [];
    const itemsByOrderId = new Map<string, typeof items>();
    for (const item of items) {
      const bucket = itemsByOrderId.get(item.orderId);
      if (bucket) bucket.push(item);
      else itemsByOrderId.set(item.orderId, [item]);
    }
    return orders.map((o) => ({
      ...o,
      prescriptionId: prescriptionIdByOrderId.get(o.id) ?? null,
      prescriptionVersion: prescriptionVersionByOrderId.get(o.id) ?? null,
      items: itemsByOrderId.get(o.id) ?? [],
    }));
  }
  async transition(
    userId: string,
    pharmacyId: string,
    orderId: string,
    status: PharmacyOrderStatus,
  ) {
    await this.assertStaff(userId, pharmacyId);
    const order = await this.orders.findOneBy({ id: orderId, pharmacyId });
    if (!order) throw new NotFoundException("Order not found in this pharmacy");
    const fromStatus = order.status;
    if (!NEXT[fromStatus].includes(status))
      throw new ConflictException(
        `Cannot move an order from ${fromStatus} to ${status}`,
      );
    // NEXT[PREPARING] offers both dispatch states so one table can serve
    // every order regardless of how it's fulfilled — but only one of them
    // actually matches this particular order; picking the other would show
    // the customer a tracking status ("out for delivery") that contradicts
    // what they actually chose ("pickup") at checkout.
    if (
      status === PharmacyOrderStatus.READY_FOR_PICKUP &&
      order.fulfillmentMethod !== FulfillmentMethod.PICKUP
    )
      throw new ConflictException(
        "This order is for delivery, not pickup — mark it out for delivery instead",
      );
    if (
      status === PharmacyOrderStatus.OUT_FOR_DELIVERY &&
      order.fulfillmentMethod !== FulfillmentMethod.DELIVERY
    )
      throw new ConflictException(
        "This order is for pickup, not delivery — mark it ready for pickup instead",
      );

    const run = async (
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      // Conditioned on the order still being in fromStatus — two concurrent
      // requests both racing this transition (e.g. two staff both hit
      // "cancel" on the same order) would otherwise both pass the
      // in-memory NEXT[] check above, both save CANCELLED, and both run
      // restoreInventory, inflating stock by an entire order. This UPDATE's
      // row lock serializes that: whichever commits first wins, the other
      // affects zero rows and throws instead of restoring inventory twice.
      const result = await orderRepo.update(
        { id: orderId, pharmacyId, status: fromStatus },
        { status },
      );
      if (!result.affected)
        throw new ConflictException(
          `Cannot move an order from ${fromStatus} to ${status}`,
        );
      // A cancelled order was already decremented against inventory at
      // creation time — every path into CANCELLED is a one-way transition
      // (NEXT[CANCELLED] is empty), and the conditional update above
      // ensures only one concurrent request's restore actually runs.
      if (status === PharmacyOrderStatus.CANCELLED) {
        await this.restoreInventory(order.id, itemRepo, inventoryRepo);
      }
      // Committed with the status change and any restock above — otherwise
      // a failure here would leave the transition (and a cancellation's
      // restock) applied with no status-change audit entry, and a retry
      // can't repair it once the order has moved out of fromStatus.
      await this.audit(
        userId,
        pharmacyId,
        "order.status_changed",
        "order",
        order.id,
        { status },
        auditRepo,
      );
    };
    const manager = this.orders.manager;
    if (manager?.transaction) {
      await manager.transaction((tx) =>
        run(
          tx.getRepository(PharmacyOrder),
          tx.getRepository(PharmacyOrderItem),
          tx.getRepository(PharmacyInventory),
          tx.getRepository(PharmacyAuditLog),
        ),
      );
    } else {
      await run(this.orders, this.orderItems, this.inventory, this.audits);
    }

    order.status = status;
    return order;
  }
  async review(
    userId: string,
    pharmacyId: string,
    prescriptionId: string,
    dto: PrescriptionReviewDto,
  ) {
    const member = await this.assertStaff(userId, pharmacyId);
    // A manager or ordinary employee passes assertStaff the same as a
    // pharmacist — but deciding whether a prescription is genuine and
    // matches the order is a clinical judgment call the storefront
    // advertises as "pharmacist review only"; only that role may record one.
    if (member.role !== PharmacyStaffRole.PHARMACIST)
      throw new ForbiddenException(
        "Only a pharmacist on staff can decide on a prescription",
      );
    const rx = await this.prescriptions.findOne({
      where: { id: prescriptionId, pharmacyId },
    });
    if (!rx)
      throw new NotFoundException("Prescription not found in this pharmacy");
    // Fast-fail on the version the pharmacist actually saw — the
    // authoritative recheck is the locked read inside the transaction
    // below (this call may have changed by the time it starts), but there
    // is no reason to open a transaction for a request that's already
    // stale by this cheap, unlocked read.
    if (rx.version !== dto.prescriptionVersion)
      throw new ConflictException(
        "This prescription has changed since you loaded it — reload and review the latest submission",
      );
    // Refuse to record a decision once this prescription's order has
    // already left under_review — otherwise a duplicate submission, or a
    // second pharmacist deciding after the first, could record e.g.
    // "rejected" here for audit purposes while the order itself keeps
    // progressing under an earlier "accepted" decision, with nothing
    // downstream ever reflecting the contradiction. The conditional
    // UPDATE below is still what actually serializes a genuinely
    // concurrent double-decision; this is the sequential case (order
    // already decided, or cancelled, before this call even started).
    if (rx.orderId) {
      const order = await this.orders.findOneBy({
        id: rx.orderId,
        pharmacyId,
      });
      if (!order || order.status !== PharmacyOrderStatus.UNDER_REVIEW)
        throw new ConflictException(
          "This order has already left review — a new decision can't be recorded",
        );
    }
    const isTerminalDecision =
      dto.decision !== PrescriptionDecision.CLARIFICATION_REQUESTED;
    const newStatus =
      rx.orderId && isTerminalDecision
        ? dto.decision === PrescriptionDecision.ACCEPTED
          ? PharmacyOrderStatus.ACCEPTED
          : PharmacyOrderStatus.REJECTED
        : null;
    const orderId = rx.orderId;

    // The review row and (when applicable) the order's status transition
    // are one decision — committed together, in this order, inside one
    // transaction. Without that, two pharmacists deciding concurrently
    // could both pass the preliminary under_review check above, both save
    // a review row here, and only then race on the conditional UPDATE
    // below — silently leaving a contradictory review (e.g. "rejected")
    // recorded and audited beside whichever decision actually won.
    const run = async (
      reviewRepo: Repository<PrescriptionReview>,
      orderRepo: Repository<PharmacyOrder>,
      itemRepo: Repository<PharmacyOrderItem>,
      inventoryRepo: Repository<PharmacyInventory>,
      auditRepo: Repository<PharmacyAuditLog>,
      prescriptionRepo: Repository<Prescription>,
    ) => {
      // Locked *before* the review row is saved, not after — every branch
      // used to lock only once it got around to touching the order (the
      // terminal branch's conditional UPDATE, or the clarification
      // branch's own explicit lock), both *after* the review insert above.
      // resubmitPrescription() takes this same order lock before its own
      // write, so a resubmission could win this lock first, see the review
      // this transaction just inserted as still uncommitted (so the
      // prescription still reads as clarification_requested), swap the
      // file, and commit — all before this transaction's own order UPDATE
      // ever runs and finalizes a decision made on a file that no longer
      // exists. Locking unconditionally up front, ahead of either branch,
      // closes that inverse lock ordering: whichever of the two
      // transactions gets here first now blocks the other until it commits.
      if (orderId) {
        const locked = await orderRepo
          .createQueryBuilder("o")
          .setLock("pessimistic_write")
          .where("o.id = :orderId", { orderId })
          .andWhere("o.pharmacyId = :pharmacyId", { pharmacyId })
          .getOne();
        if (!locked || locked.status !== PharmacyOrderStatus.UNDER_REVIEW)
          throw new ConflictException(
            "This order was just decided by another request",
          );
      }
      // Authoritative version recheck, under lock — the outer check above
      // is only a fast-fail against a pre-transaction read. A resubmission
      // landing between that read and here (e.g. the pharmacist had this
      // file open, the customer resubmitted, and only then did the
      // pharmacist click Accept/Reject) must still be caught. Locked
      // *after* the order above, matching resubmitPrescription()'s own
      // order→prescription lock order — locking the other way around
      // would deadlock the two against each other under real concurrency.
      // Whichever of the two transactions gets to the order lock first now
      // fully serializes the other, so the version read here is always
      // either the one this decision actually inspected, or already
      // reflects a resubmission this call correctly refuses to act on.
      const lockedRx = await prescriptionRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: prescriptionId })
        .getOneOrFail();
      if (lockedRx.version !== dto.prescriptionVersion)
        throw new ConflictException(
          "This prescription has changed since you loaded it — reload and review the latest submission",
        );
      const review = await reviewRepo.save(
        reviewRepo.create({
          prescriptionId,
          reviewerUserId: userId,
          decision: dto.decision,
          notes: dto.notes?.trim() || null,
        }),
      );
      if (orderId && newStatus) {
        // The order row is already locked above — this UPDATE's own WHERE
        // condition can't actually lose the race anymore (nothing else
        // could get in between the lock and here), but it stays as
        // defense in depth against this method's own logic drifting out
        // of sync with the lock someday.
        const result = await orderRepo.update(
          {
            id: orderId,
            pharmacyId,
            status: PharmacyOrderStatus.UNDER_REVIEW,
          },
          { status: newStatus },
        );
        if (!result.affected)
          throw new ConflictException(
            "This order was just decided by another request",
          );
        // A rejected prescription means this order will never be
        // fulfilled — release the stock it reserved at checkout, same as
        // an explicit cancellation. REJECTED is terminal (NEXT[REJECTED]
        // is empty) so this can only happen once per order.
        if (newStatus === PharmacyOrderStatus.REJECTED) {
          await this.restoreInventory(orderId, itemRepo, inventoryRepo);
        }
      }
      // else: a clarification request doesn't move the order, so there's
      // no status transition to make here — the lock above already
      // confirmed the order is still under_review before the review row
      // was even saved.
      // Committed in the same transaction as the review row and order
      // transition above — otherwise a failure here would leave the
      // clinical decision (and any inventory restoration) applied with no
      // corresponding audit entry, and a retry can't repair it once the
      // order has left under_review (the preliminary check above now
      // correctly refuses a second decision).
      await this.audit(
        userId,
        pharmacyId,
        `prescription.${dto.decision}`,
        "prescription",
        prescriptionId,
        {},
        auditRepo,
      );
      return review;
    };
    const manager = this.orders.manager;
    const review = manager?.transaction
      ? await manager.transaction((tx) =>
          run(
            tx.getRepository(PrescriptionReview),
            tx.getRepository(PharmacyOrder),
            tx.getRepository(PharmacyOrderItem),
            tx.getRepository(PharmacyInventory),
            tx.getRepository(PharmacyAuditLog),
            tx.getRepository(Prescription),
          ),
        )
      : await run(
          this.reviews,
          this.orders,
          this.orderItems,
          this.inventory,
          this.audits,
          this.prescriptions,
        );

    return review;
  }
  // Customer-facing upload — happens *before* checkout, so the cart can
  // submit the returned id as CreateOrderDto.prescriptionId. Saved through
  // StorageProvider.savePrivate() — not the save() every other upload in
  // this app uses — because that one always returns a publicly-fetchable
  // URL (local disk under the statically-served /uploads, or an S3 object
  // meant to sit behind a public bucket/CDN); a prescription photo is
  // sensitive enough that it must stay unreachable without going through
  // prescriptionFile() below, which checks the caller is the order owner,
  // assigned pharmacy staff, or an admin before reading it back. Never
  // returned as part of any pharmacy/order listing either
  // (Prescription.privateStorageKey is `select: false`).
  async uploadPrescription(
    userId: string,
    pharmacyId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string },
  ) {
    if (!ALLOWED_PRESCRIPTION_MIME_TYPES.includes(file.mimeType))
      throw new BadRequestException(
        "Only JPEG, PNG, WebP images or a PDF are allowed",
      );
    if (file.buffer.length > MAX_PRESCRIPTION_FILE_SIZE_BYTES)
      throw new BadRequestException("Prescription file is larger than 10MB");
    const pharmacy = await this.pharmacies.findOneBy({ id: pharmacyId });
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new BadRequestException(
        "This pharmacy is not approved to receive orders",
      );
    const filename = `prescriptions/${randomUUID()}${extname(file.originalName).slice(0, 10)}`;
    const { key } = await this.storage.savePrivate({
      buffer: file.buffer,
      filename,
      contentType: file.mimeType,
    });
    // The row and its audit entry commit together — otherwise a failure
    // between them (or in the row insert itself) leaves the object this
    // savePrivate() call just wrote with no database row through which it
    // can ever be authorized, retained, or deleted, and a retry from the
    // client (having seen only a 500) writes yet another orphaned copy.
    const run = async (
      prescriptionRepo: Repository<Prescription>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      const rx = await prescriptionRepo.save(
        prescriptionRepo.create({
          customerUserId: userId,
          pharmacyId,
          orderId: null,
          privateStorageKey: key,
          originalFilename: file.originalName,
          mimeType: file.mimeType,
        }),
      );
      await this.audit(
        userId,
        pharmacyId,
        "prescription.uploaded",
        "prescription",
        rx.id,
        {},
        auditRepo,
      );
      return rx;
    };
    const manager = this.prescriptions.manager;
    let rx: Prescription;
    try {
      rx = manager?.transaction
        ? await manager.transaction((tx) =>
            run(
              tx.getRepository(Prescription),
              tx.getRepository(PharmacyAuditLog),
            ),
          )
        : await run(this.prescriptions, this.audits);
    } catch (err) {
      await this.storage.deletePrivate(key).catch(() => {});
      throw err;
    }
    return { id: rx.id };
  }
  // Deletes an uploaded-but-never-attached prescription — the customer's
  // only way to clean up a copy uploadPrescription() left behind after
  // picking a different file (see PharmacyShop's uploadedPrescriptionRef
  // comment: each upload is a private object plus a database row that
  // nothing else ever attaches or cleans up on its own). Scoped to the
  // uploader's own prescription, and conditioned on orderId still being
  // null the same way createOrder()'s own attach step is — a concurrent
  // checkout that's already claimed this prescription wins the race, and
  // this call becomes a no-op rather than deleting evidence for a real
  // order.
  async deleteUnattachedPrescription(userId: string, prescriptionId: string) {
    const rx = await this.prescriptions
      .createQueryBuilder("p")
      .addSelect("p.privateStorageKey")
      .where("p.id = :id", { id: prescriptionId })
      .andWhere("p.customerUserId = :userId", { userId })
      .getOne();
    if (!rx) throw new NotFoundException("Prescription not found");
    if (rx.orderId !== null)
      throw new ConflictException(
        "This prescription is already attached to an order",
      );
    const result = await this.prescriptions.delete({
      id: prescriptionId,
      customerUserId: userId,
      orderId: IsNull(),
    });
    // Lost the race to a concurrent checkout attaching this prescription
    // between the read above and this delete — nothing left to clean up.
    if (!result.affected) return;
    await this.storage.deletePrivate(rx.privateStorageKey).catch(() => {});
  }
  // Auditable, access-controlled reveal of an uploaded prescription's file
  // — the only place privateStorageKey ever leaves the service, and only
  // to the customer who uploaded it, staff of the pharmacy it was uploaded
  // for, or an admin. Reads the actual bytes back through
  // StorageProvider.readPrivate() and returns them directly (the
  // controller streams them to the caller) rather than a URL — there is no
  // "private URL" a client could be handed and still have the
  // authorization check above actually apply to it.
  async prescriptionFile(userId: string, isAdmin: boolean, id: string) {
    const rx = await this.prescriptions
      .createQueryBuilder("rx")
      .addSelect("rx.privateStorageKey")
      .where("rx.id = :id", { id })
      .getOne();
    if (!rx) throw new NotFoundException("Prescription not found");
    const isOwner = rx.customerUserId === userId;
    const isStaff =
      !isOwner &&
      !isAdmin &&
      (await this.staff.findOne({
        where: { userId, pharmacyId: rx.pharmacyId, active: true },
      }));
    if (!isOwner && !isAdmin && !isStaff)
      throw new ForbiddenException(
        "You are not authorized to view this prescription",
      );
    await this.audit(
      userId,
      rx.pharmacyId,
      "prescription.viewed",
      "prescription",
      rx.id,
    );
    const { buffer } = await this.storage.readPrivate(rx.privateStorageKey);
    return {
      buffer,
      mimeType: rx.mimeType,
      originalFilename: rx.originalFilename,
    };
  }
  async verification(
    adminId: string,
    pharmacyId: string,
    dto: VerificationDto,
  ) {
    if (
      ![
        PharmacyStatus.APPROVED,
        PharmacyStatus.REJECTED,
        PharmacyStatus.SUSPENDED,
      ].includes(dto.decision)
    )
      throw new BadRequestException("Invalid verification decision");

    // The status change, the PharmacyVerification evidence record, and the
    // audit entry all describe one decision — committed together so a
    // failure partway through can't leave the pharmacy "approved" (and
    // therefore publicly listed) with no verification record explaining
    // why, or reporting failure to the caller for a decision that had, in
    // fact, already taken effect.
    const run = async (
      pharmacyRepo: Repository<Pharmacy>,
      verificationRepo: Repository<PharmacyVerification>,
      auditRepo: Repository<PharmacyAuditLog>,
    ) => {
      // Locked and read *inside* the transaction, not before it — staff
      // could update the pharmacy's profile (saveProfile()) between an
      // earlier read and this write; a full save() of that stale
      // pre-transaction entity would silently revert the staff request
      // even though it had already returned success to its caller.
      // licenceNumber is `select: false` — opt back in via the query
      // builder, same as applications() does, since it's what the licence
      // check below is actually for.
      const p = await pharmacyRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .addSelect("p.licenceNumber")
        .where("p.id = :id", { id: pharmacyId })
        .getOne();
      if (!p) throw new NotFoundException("Pharmacy not found");
      // The admin oversight page is the only place a licence number can be
      // inspected before verifying — enforced here too, not just by
      // disabling the button there, since this is the endpoint that
      // actually grants a storefront "approved" status.
      if (dto.decision === PharmacyStatus.APPROVED && !p.licenceNumber?.trim())
        throw new BadRequestException(
          "Cannot approve a pharmacy with no licence number on file",
        );
      // Only the verification-controlled status column is written — never
      // a full save() of this entity, which would clobber any profile
      // field staff changed concurrently back to whatever this read
      // happened to observe.
      await pharmacyRepo.update({ id: pharmacyId }, { status: dto.decision });
      await verificationRepo.save(
        verificationRepo.create({
          pharmacyId,
          reviewerUserId: adminId,
          decision: dto.decision,
          notes: dto.notes?.trim() || null,
        }),
      );
      await this.audit(
        adminId,
        pharmacyId,
        "verification.decided",
        "pharmacy",
        pharmacyId,
        { decision: dto.decision },
        auditRepo,
      );
      return { ...p, status: dto.decision } as Pharmacy;
    };
    const manager = this.pharmacies.manager;
    return manager?.transaction
      ? manager.transaction((tx) =>
          run(
            tx.getRepository(Pharmacy),
            tx.getRepository(PharmacyVerification),
            tx.getRepository(PharmacyAuditLog),
          ),
        )
      : run(this.pharmacies, this.verifications, this.audits);
  }
  applications() {
    return this.pharmacies
      .createQueryBuilder("p")
      .addSelect(["p.licenceNumber", "p.licenceDocumentKey"])
      .orderBy("p.createdAt", "DESC")
      .getMany();
  }
  allOrders() {
    return this.orders.find({ order: { createdAt: "DESC" } });
  }
  stats(userId: string, pharmacyId: string) {
    return this.assertStaff(userId, pharmacyId).then(async (member) => {
      const all = await this.orders.findBy({ pharmacyId });
      return {
        totalOrders: all.length,
        completedOrders: all.filter(
          (x) => x.status === PharmacyOrderStatus.COMPLETED,
        ).length,
        pendingOrders: all.filter((x) =>
          [
            PharmacyOrderStatus.PENDING,
            PharmacyOrderStatus.UNDER_REVIEW,
          ].includes(x.status),
        ).length,
        revenue: all
          .filter((x) => x.status === PharmacyOrderStatus.COMPLETED)
          .reduce((s, x) => s + Number(x.finalTotal), 0),
        // The management page's only other staff-scoped, per-pharmacy call
        // it always makes on load — piggybacking the caller's own role
        // here (rather than adding a new endpoint) lets it gate the
        // clinical Accept/Reject/clarification controls, which review()
        // has always rejected for anyone but a pharmacist.
        role: member.role,
      };
    });
  }
  // There was no way to see who's actually on staff before this — the
  // management page could only add someone via assignStaff(), never list
  // who has access, which also made deactivateStaff() impossible to
  // reach from the UI. Any staff role can view the roster (same reasoning
  // as getOpeningHours()); only a manager can act on it.
  async listStaff(userId: string, pharmacyId: string) {
    await this.assertStaff(userId, pharmacyId);
    const members = await this.staff.find({
      where: { pharmacyId, active: true },
      relations: ["user"],
      order: { role: "ASC" },
    });
    return members.map((m) => ({
      userId: m.userId,
      email: m.user?.email ?? null,
      role: m.role,
    }));
  }
  auditLogs() {
    return this.audits.find({ order: { createdAt: "DESC" }, take: 250 });
  }
  private orderDetail(id: string) {
    return this.orders.findOneOrFail({ where: { id } });
  }
  // Undoes the per-line decrements createOrder() made at checkout, for an
  // order that turns out never to be fulfilled (cancelled, or a rejected
  // prescription). A line whose product was since deleted (ON DELETE SET
  // NULL leaves productId null) has nothing left to credit back. Callers
  // that need this atomic with the order's own status update (transition(),
  // review()) pass in transaction-scoped repos; the defaults keep this
  // usable standalone.
  private async restoreInventory(
    orderId: string,
    itemRepo: Repository<PharmacyOrderItem> = this.orderItems,
    inventoryRepo: Repository<PharmacyInventory> = this.inventory,
  ) {
    const items = await itemRepo.find({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue;
      await inventoryRepo.increment(
        { productId: item.productId },
        "quantity",
        item.quantity,
      );
    }
  }
  private audit(
    actorUserId: string | null,
    pharmacyId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {},
    // Callers that need this audit row committed atomically with other
    // writes (createOrder(), below) pass a transaction-scoped repo; every
    // other call site logs standalone against this.audits.
    auditRepo: Repository<PharmacyAuditLog> = this.audits,
  ) {
    return auditRepo.save(
      auditRepo.create({
        actorUserId,
        pharmacyId,
        action,
        targetType,
        targetId,
        metadata,
      }),
    );
  }
}

export { NEXT as PHARMACY_ORDER_TRANSITIONS };

export function calculatePharmacyTotals(
  items: Array<{ unitPrice: number | string; quantity: number }>,
  method: FulfillmentMethod,
  deliveryFee: number,
  platformFee = 0,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0,
  );
  const delivery = method === FulfillmentMethod.DELIVERY ? deliveryFee : 0;
  return {
    subtotal,
    delivery,
    platformFee,
    total: subtotal + delivery + platformFee,
  };
}
