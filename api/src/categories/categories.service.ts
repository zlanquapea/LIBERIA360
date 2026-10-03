import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PlaceReviewStatus } from "../places/entities/place.enums";
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
      // Public listings only — the same APPROVED filter GET /places
      // applies, so this count matches what a visitor can actually open.
      .loadRelationCountAndMap(
        "category.placeCount",
        "category.places",
        "place",
        (qb) =>
          qb.andWhere("place.reviewStatus = :approved", {
            approved: PlaceReviewStatus.APPROVED,
          }),
      )
      .orderBy("category.name", "ASC")
      .getMany();

    return rows as CategoryWithCount[];
  }
}
