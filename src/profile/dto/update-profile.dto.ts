import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Gender, OccupationStatus } from './enums.dto';

export class UpdateProfileDto {
  // --- Temel Bilgiler ---

  @IsOptional()
  @IsString()
  bio?: string;

  // --- Hakkında (About) ---
  @IsOptional()
  @IsDateString()
  birth_date?: string; // ISO String gelir

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  // --- Meslek / Durum (Occupation) ---
  @IsOptional()
  @IsEnum(OccupationStatus)
  occupation_status?: OccupationStatus;

  // Öğrenci ise university ve department gönderilebilir
  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsOptional()
  @IsString()
  university?: string;

  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsOptional()
  @IsString()
  department?: string;

  // Profesyonel ise occupation gönderilebilir
  @ValidateIf((o) => o.occupation_status === OccupationStatus.PROFESSIONAL)
  @IsOptional()
  @IsString()
  occupation?: string;
}
