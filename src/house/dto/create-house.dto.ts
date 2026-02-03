import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum GenderPreference {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non_binary',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export class CreateHouseDto {
  @IsString()
  @IsNotEmpty({ message: 'İlan başlığı zorunludur' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Kira tutarı zorunludur' })
  @Min(0, { message: 'Kira tutarı negatif olamaz' })
  rent_amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Depozito tutarı negatif olamaz' })
  deposit_amount?: number;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  rules?: string[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'En az 1 kişi olmalı' })
  @Max(10, { message: 'En fazla 10 kişi olabilir' })
  max_occupancy?: number;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  amenities?: string[];

  @IsEnum(GenderPreference)
  @IsOptional()
  gender_preference?: GenderPreference;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;
}
