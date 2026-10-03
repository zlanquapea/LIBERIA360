import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { MENU_ITEM_TAGS, MenuItemKind } from "../entities/menu-item.enums";
import { MenuOptionGroupDto } from "./menu-option-group.dto";

export class CreateMenuItemDto {
  @IsUUID()
  businessId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsNumber()
  @Min(0)
  @Max(100000)
  price: number;

  @IsOptional() @IsString() @MaxLength(500) image?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @IsOptional() @IsEnum(MenuItemKind) kind?: MenuItemKind;

  @IsOptional()
  @IsArray()
  @IsIn(MENU_ITEM_TAGS, { each: true })
  @ArrayMaxSize(MENU_ITEM_TAGS.length)
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(40) servingSize?: string;
  @IsOptional() @IsBoolean() containsAlcohol?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MenuOptionGroupDto)
  @ArrayMaxSize(10)
  optionGroups?: MenuOptionGroupDto[];
}
