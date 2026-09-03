import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from "class-validator";

// PATCH-style partial update, same convention as
// UpdateApplicationSettingsDto. The recipient list is capped generously —
// a real team is never going to approach this, and it's cheap insurance
// against a malformed request silently ballooning the column.
export class UpdateAdminNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  flaggedContentEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  flaggedContentPushEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  flaggedContentRecipientUserIds?: string[];
}
