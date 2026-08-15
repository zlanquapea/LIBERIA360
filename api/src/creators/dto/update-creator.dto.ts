import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateCreatorDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_.]+$/, {
    message:
      "username may only contain lowercase letters, numbers, dots, and underscores",
  })
  username?: string;

  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(500) profileImage?: string;
  @IsOptional() @IsString() @MaxLength(100) instagram?: string;
  @IsOptional() @IsString() @MaxLength(100) tiktok?: string;
  @IsOptional() @IsString() @MaxLength(100) youtube?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000) followerCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  specialties?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locationsCovered?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  contentLinks?: string[];
}
