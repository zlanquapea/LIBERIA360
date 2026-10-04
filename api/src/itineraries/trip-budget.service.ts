import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { SaveTripBudgetDto } from "./trip-budget.dto";

export function budgetSummary(budget: SaveTripBudgetDto) {
  const balances = budget.travelers.map((person) => ({
    ...person,
    paidMinor: 0,
    shareMinor: 0,
    netMinor: 0,
  }));
  const byId = new Map(balances.map((person) => [person.id, person]));
  const categories: Record<string, number> = {};
  let spentMinor = 0;
  for (const expense of budget.expenses) {
    spentMinor += expense.amountMinor;
    categories[expense.category] =
      (categories[expense.category] ?? 0) + expense.amountMinor;
    byId.get(expense.paidBy)!.paidMinor += expense.amountMinor;
    // Stable ordering allocates any remaining cents exactly once.
    const ids = [...expense.splitBetween].sort();
    const each = Math.floor(expense.amountMinor / ids.length);
    const remainder = expense.amountMinor % ids.length;
    ids.forEach((id, index) => {
      byId.get(id)!.shareMinor += each + (index < remainder ? 1 : 0);
    });
  }
  balances.forEach((person) => {
    person.netMinor = person.paidMinor - person.shareMinor;
  });
  return {
    spentMinor,
    remainingMinor: budget.budgetMinor - spentMinor,
    categories,
    balances,
  };
}

@Injectable()
export class TripBudgetService {
  constructor(private readonly db: DataSource) {}

  private async access(
    manager: EntityManager,
    userId: string,
    tripId: string,
    write: boolean,
  ) {
    const rows = await manager.query(
      `SELECT user_id FROM itineraries WHERE id = $1${write ? " FOR UPDATE" : ""}`,
      [tripId],
    );
    if (!rows.length) throw new NotFoundException("Trip not found");
    if (rows[0].user_id === userId) return true;
    const members = await manager.query(
      "SELECT role FROM itinerary_collaborators WHERE itinerary_id = $1 AND user_id = $2",
      [tripId, userId],
    );
    if (!members.length) throw new NotFoundException("Trip not found");
    if (write && members[0].role !== "editor")
      throw new ForbiddenException(
        "Only trip owners and editors can change expenses.",
      );
    return members[0].role === "editor";
  }

  async get(userId: string, tripId: string) {
    const canEdit = await this.access(this.db.manager, userId, tripId, false);
    const rows = await this.db.query(
      "SELECT data, version FROM trip_budgets WHERE trip_id = $1",
      [tripId],
    );
    const budget: SaveTripBudgetDto = rows.length
      ? { ...rows[0].data, version: rows[0].version }
      : {
          version: 0,
          currency: "USD",
          budgetMinor: 0,
          travelers: [],
          expenses: [],
        };
    return { ...budget, canEdit, summary: budgetSummary(budget) };
  }

  async save(userId: string, tripId: string, dto: SaveTripBudgetDto) {
    const travelers = dto.travelers.map((person) => ({
      id: person.id,
      name: person.name.trim(),
    }));
    const ids = new Set(travelers.map((person) => person.id));
    if (
      ids.size !== travelers.length ||
      travelers.some((person) => !person.name)
    )
      throw new BadRequestException(
        "Each traveler needs a unique ID and a name.",
      );
    if (
      new Set(dto.expenses.map((expense) => expense.id)).size !==
      dto.expenses.length
    )
      throw new BadRequestException("Duplicate expense ID.");
    for (const expense of dto.expenses) {
      if (
        !expense.description.trim() ||
        !ids.has(expense.paidBy) ||
        expense.splitBetween.some((id) => !ids.has(id))
      )
        throw new BadRequestException(
          "Each expense needs a description, payer, and valid travelers.",
        );
    }
    return this.db.transaction(async (manager) => {
      await this.access(manager, userId, tripId, true);
      const rows = await manager.query(
        "SELECT data, version FROM trip_budgets WHERE trip_id = $1",
        [tripId],
      );
      const current = rows[0];
      if ((current?.version ?? 0) !== dto.version)
        throw new ConflictException(
          "Someone updated this budget. Reload the latest version before saving again.",
        );
      if (
        current?.data.expenses.length &&
        current.data.currency !== dto.currency
      )
        throw new BadRequestException(
          "Remove existing expenses before changing currency. Amounts are not automatically converted.",
        );
      const budget = {
        ...dto,
        travelers,
        expenses: dto.expenses.map((expense) => ({
          ...expense,
          description: expense.description.trim(),
        })),
        version: dto.version + 1,
      };
      await manager.query(
        `INSERT INTO trip_budgets (trip_id, data, version, updated_by) VALUES ($1, $2::jsonb, $3, $4) ON CONFLICT (trip_id) DO UPDATE SET data = EXCLUDED.data, version = EXCLUDED.version, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [tripId, JSON.stringify(budget), budget.version, userId],
      );
      return { ...budget, canEdit: true, summary: budgetSummary(budget) };
    });
  }
}
