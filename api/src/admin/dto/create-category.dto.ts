import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

// Categories had no admin-writable path at all until now — every category
// in the catalog was seed-data-only (see database/seed-data.ts). Same
// slug convention as CreatePlaceDto so an admin-entered slug always
// matches what the rest of the catalog (and the frontend's category
// pages) already expects.
export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, kebab-case (e.g. "beaches")',
  })
  slug: string;

  // A single emoji/symbol — same pattern as County.icon (see seed-data.ts
  // for the existing set), not a file upload: there's no icon library
  // wired into the catalog, and an emoji renders everywhere without one.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
