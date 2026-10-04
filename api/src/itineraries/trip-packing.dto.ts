import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
export class PackingItemDto {
  @IsUUID() id: string;
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsIn(["essentials", "clothing", "toiletries", "gear", "other"])
  category: string;
  @IsInt() @Min(1) @Max(99) quantity: number;
  @IsBoolean() packed: boolean;
}
export class SaveTripPackingDto {
  @IsInt() @Min(0) @Max(2147483646) version: number;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PackingItemDto)
  items: PackingItemDto[];
}
