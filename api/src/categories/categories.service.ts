import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "./entities/category.entity";

export interface CategoryWithCount extends Category {
  placeCount: number;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  /** GET /categories — list of categories/tags with how many places use each (Tech Spec §10). */
  async findAll(): Promise<CategoryWithCount[]> {
    const rows = await this.categoryRepo
      .createQueryBuilder("category")
      .loadRelationCountAndMap("category.placeCount", "category.places")
      .orderBy("category.name", "ASC")
      .getMany();

    return rows as CategoryWithCount[];
  }
}
