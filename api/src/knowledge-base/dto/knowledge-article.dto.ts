import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import { ArticleStatus } from "../entities/knowledge-article.entity";

export class CreateKnowledgeArticleDto {
  @IsUUID() categoryId: string;
  @IsString() @Length(3, 200) title: string;
  @IsString() @Length(10, 50000) content: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}

export class UpdateKnowledgeArticleDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @Length(3, 200) title?: string;
  @IsOptional() @IsString() @Length(10, 50000) content?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}

// GET /help-center/articles — public, published-only listing.
export class QueryPublicArticlesDto {
  @IsOptional() @IsString() category?: string; // category slug
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}

// GET /admin/help-center/articles — every status, admin-only.
export class QueryAdminArticlesDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 25;
}

export class SubmitArticleFeedbackDto {
  @IsBoolean() helpful: boolean;
}
