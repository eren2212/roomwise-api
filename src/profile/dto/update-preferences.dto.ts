import { IsEnum, IsOptional } from 'class-validator';
import {
  Smoking,
  Alcohol,
  Pets,
  Sleep,
  Guest,
  Cleanliness,
  Communication,
  Cooking,
} from './enums.dto';

export class UpdatePreferencesDto {
  @IsEnum(Smoking)
  @IsOptional()
  smoking?: Smoking;

  @IsEnum(Alcohol)
  @IsOptional()
  alcohol?: Alcohol;

  @IsEnum(Pets)
  @IsOptional()
  pets?: Pets;

  @IsEnum(Sleep)
  @IsOptional()
  sleep?: Sleep;

  @IsEnum(Guest)
  @IsOptional()
  guests?: Guest;

  @IsEnum(Cleanliness)
  @IsOptional()
  cleanliness?: Cleanliness;

  @IsEnum(Communication)
  @IsOptional()
  communication?: Communication;

  @IsEnum(Cooking)
  @IsOptional()
  cooking?: Cooking;
}
