import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CreateFaqDto, ReorderFaqsDto, UpdateFaqDto } from "./dto/faq.dto";
import { Faq } from "./entities/faq.entity";

@Injectable()
export class FaqService {
  constructor(@InjectRepository(Faq) private readonly faqs: Repository<Faq>) {}

  // Public accordion — published only, grouped/ordered by sortOrder so
  // an admin's chosen order is exactly what a customer sees.
  findPublished() {
    return this.faqs.find({
      where: { published: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  findAllForAdmin() {
    return this.faqs.find({ order: { sortOrder: "ASC", createdAt: "ASC" } });
  }

  private async get(id: string): Promise<Faq> {
    const faq = await this.faqs.findOne({ where: { id } });
    if (!faq) throw new NotFoundException(`FAQ "${id}" not found`);
    return faq;
  }

  async create(dto: CreateFaqDto) {
    // New entries default to the end of the list rather than colliding
    // with 0 (every existing default) unless the caller sets one
    // explicitly.
    const sortOrder = dto.sortOrder ?? (await this.faqs.count()) + 1;
    return this.faqs.save(this.faqs.create({ ...dto, sortOrder }));
  }

  async update(id: string, dto: UpdateFaqDto) {
    const faq = await this.get(id);
    Object.assign(faq, dto);
    return this.faqs.save(faq);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.faqs.delete(id);
  }

  // Applies a full new ordering in one go — every id must already exist,
  // and any FAQ not included keeps its current position rather than being
  // silently reset, so a caller can reorder one category's slice of the
  // list without needing to know about every other FAQ.
  async reorder(dto: ReorderFaqsDto): Promise<void> {
    const rows = await this.faqs.find({ where: { id: In(dto.ids) } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const updates = dto.ids
      .map((id, index) => {
        const row = byId.get(id);
        if (!row) return null;
        row.sortOrder = index;
        return row;
      })
      .filter((row): row is Faq => row !== null);
    if (updates.length !== dto.ids.length)
      throw new NotFoundException(
        "One or more FAQs in the reorder list were not found",
      );
    await this.faqs.save(updates);
  }
}
