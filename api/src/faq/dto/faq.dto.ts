import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class CreateFaqDto {
  @IsString() @Length(3, 300) question: string;
  @IsString() @Length(3, 5000) answer: string;
  @IsOptional() @IsString() @Length(0, 120) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class UpdateFaqDto {
  @IsOptional() @IsString() @Length(3, 300) question?: string;
  @IsOptional() @IsString() @Length(3, 5000) answer?: string;
  @IsOptional() @IsString() @Length(0, 120) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() published?: boolean;
}

// Drag-and-drop reorder from the admin list: the new top-to-bottom order
// of every FAQ's id — the service maps position -> sortOrder.
export class ReorderFaqsDto {
  @IsArray() @ArrayMinSize(1) @IsUUID(undefined, { each: true }) ids: string[];
}
