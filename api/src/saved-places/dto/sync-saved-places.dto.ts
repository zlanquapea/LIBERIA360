import { ArrayMaxSize, IsArray, IsString } from "class-validator";

// The device's local (pre-login, or simply pre-merge) saved-slugs list,
// handed up once per login so it can be folded into the account's saved
// places — see SavedPlacesService.syncFromDevice. Capped generously above
// any realistic bucket list rather than left unbounded.
export class SyncSavedPlacesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  slugs: string[];
}
