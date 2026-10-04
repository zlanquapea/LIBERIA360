import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
class CollectionItemDto {
  @IsString() @Length(1, 100) title: string;
  @IsString()
  @Matches(/^\/(places|experiences|creators\/posts)\/[a-zA-Z0-9_-]{1,200}$/)
  path: string;
}
export class SaveCollectionDto {
  @IsString() @Length(1, 80) @Matches(/\S/) name: string;
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CollectionItemDto)
  items: CollectionItemDto[];
  @IsInt() @Min(0) version: number;
  @IsOptional() @IsBoolean() shared?: boolean;
}
