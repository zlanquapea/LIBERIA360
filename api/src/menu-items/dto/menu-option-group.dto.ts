import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class MenuOptionChoiceDto {
  // Omitted on a brand-new choice; MenuItemsService assigns one.
  @IsOptional() @IsString() @MaxLength(64) id?: string;

  @IsString() @MinLength(1) @MaxLength(80) name: string;

  // Never negative — a "no rice, -$1" discount could push a line's total
  // below zero once combined with other choices.
  @IsNumber() @Min(0) @Max(100000) priceDelta: number;
}

export class MenuOptionGroupDto {
  @IsOptional() @IsString() @MaxLength(64) id?: string;

  @IsString() @MinLength(1) @MaxLength(80) name: string;

  @IsBoolean() required: boolean;

  @IsInt() @Min(1) @Max(20) maxSelections: number;

  @ValidateNested({ each: true })
  @Type(() => MenuOptionChoiceDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  choices: MenuOptionChoiceDto[];
}
