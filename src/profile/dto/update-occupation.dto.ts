import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { OccupationStatus } from './create-profile.dto';

export class UpdateOccupationDto {
  @IsEnum(OccupationStatus)
  @IsOptional()
  occupation_status?: OccupationStatus;

  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsString()
  @IsOptional()
  university?: string;

  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsString()
  @IsOptional()
  department?: string;

  @ValidateIf((o) => o.occupation_status === OccupationStatus.PROFESSIONAL)
  @IsString()
  @IsOptional()
  occupation?: string;
}
