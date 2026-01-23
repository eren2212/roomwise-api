import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  ValidateIf,
} from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non_binary',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum OccupationStatus {
  STUDENT = 'student',
  PROFESSIONAL = 'professional',
}

export class CreateProfileDto {
  // Step 1: Temel Bilgiler
  @IsString()
  @IsNotEmpty({ message: 'İsim zorunludur' })
  full_name: string;

  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  // Step 2: Hakkında Bilgileri
  @IsDateString()
  @IsNotEmpty({ message: 'Doğum tarihi zorunludur' })
  birth_date: string;

  @IsEnum(Gender, { message: 'Geçersiz cinsiyet değeri' })
  @IsNotEmpty({ message: 'Cinsiyet zorunludur' })
  gender: Gender;

  // Step 3: Meslek Bilgileri
  @IsEnum(OccupationStatus, { message: 'Geçersiz meslek durumu' })
  @IsNotEmpty({ message: 'Meslek durumu zorunludur' })
  occupation_status: OccupationStatus;

  // Öğrenci ise zorunlu
  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsString()
  @IsNotEmpty({ message: 'Üniversite bilgisi zorunludur' })
  university?: string;

  @ValidateIf((o) => o.occupation_status === OccupationStatus.STUDENT)
  @IsString()
  @IsNotEmpty({ message: 'Bölüm bilgisi zorunludur' })
  department?: string;

  // Profesyonel ise zorunlu
  @ValidateIf((o) => o.occupation_status === OccupationStatus.PROFESSIONAL)
  @IsString()
  @IsNotEmpty({ message: 'Meslek bilgisi zorunludur' })
  occupation?: string;
}
