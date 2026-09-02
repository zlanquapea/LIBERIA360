import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
} from "class-validator";
import { BlogPostStatus } from "../entities/blog-post.entity";

export class CreateBlogPostDto {
  @IsString() @Length(3, 200) title: string;
  @IsString() @Length(10, 50000) content: string;
  @IsOptional() @IsUrl() coverImage?: string;
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
}

export class UpdateBlogPostDto {
  @IsOptional() @IsString() @Length(3, 200) title?: string;
  @IsOptional() @IsString() @Length(10, 50000) content?: string;
  @IsOptional() @IsUrl() coverImage?: string | null;
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
}

export class QueryPublicBlogPostsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}

export class QueryAdminBlogPostsDto {
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 25;
}
