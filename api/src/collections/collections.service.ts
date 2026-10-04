import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { SavedCollection } from "./collection.entity";
import { SaveCollectionDto } from "./collection.dto";
@Injectable()
export class CollectionsService {
  constructor(private readonly db: DataSource) {}
  list(userId: string) {
    return this.db
      .getRepository(SavedCollection)
      .find({ where: { userId }, order: { name: "ASC" } });
  }
  async shared(token: string) {
    const row = await this.db
      .getRepository(SavedCollection)
      .findOneBy({ shareToken: token });
    if (!row)
      throw new NotFoundException("This collection is no longer shared.");
    return { name: row.name, items: row.items }; // No owner, version or private identifiers.
  }
  save(userId: string, id: string, dto: SaveCollectionDto) {
    return this.db.transaction(async (manager) => {
      // Serialize this owner's mutations, including concurrent creates and the account limit.
      await manager.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
        userId,
      ]);
      const repo = manager.getRepository(SavedCollection);
      let row = await repo.findOneBy({ id });
      if (row && row.userId !== userId) throw new NotFoundException();
      if (row ? dto.version !== row.version : dto.version !== 0)
        throw new ConflictException(
          "This collection changed on another device. Reload before editing.",
        );
      if (!row) {
        if ((await repo.countBy({ userId })) >= 30)
          throw new ConflictException("You can save up to 30 collections.");
        row = repo.create({ id, userId, version: 0, shareToken: null });
      }
      row.name = dto.name.trim();
      row.items = dto.items;
      row.version += 1;
      if (dto.shared === true && !row.shareToken) row.shareToken = randomUUID();
      if (dto.shared === false) row.shareToken = null;
      return repo.save(row);
    });
  }
  async remove(userId: string, id: string) {
    const result = await this.db
      .getRepository(SavedCollection)
      .delete({ id, userId });
    if (!result.affected) throw new NotFoundException();
  }
}
