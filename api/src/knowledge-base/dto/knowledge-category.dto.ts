import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Min } from "class-validator";

export class CreateKnowledgeCategoryDto {
  @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateKnowledgeCategoryDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}
