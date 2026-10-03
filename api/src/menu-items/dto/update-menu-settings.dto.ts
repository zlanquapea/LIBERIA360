import { IsIn, IsOptional } from "class-validator";
import { MENU_CURRENCIES, MenuCurrency } from "../entities/menu-item.enums";

export class UpdateMenuSettingsDto {
  @IsOptional() @IsIn(MENU_CURRENCIES) currency?: MenuCurrency;
}
