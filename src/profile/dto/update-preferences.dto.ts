import { IsEnum, IsOptional } from 'class-validator';

export enum Smoking {
  NO_SMOKE = 'no_smoke',
  BALCONY = 'balcony',
  SMOKER = 'smoker',
}

export enum Alcohol {
  NO_ALCOHOL = 'no_alcohol',
  SOCIAL = 'social',
  FREQUENT = 'frequent',
}

export enum Pets {
  NO_PETS = 'no_pets',
  HAVE_PETS = 'have_pets',
  PET_FRIENDLY = 'pet_friendly',
  NO_TOLERANCE = 'no_tolerance',
}

export enum Sleep {
  EARLY_BIRD = 'early_bird',
  NIGHT_OWL = 'night_owl',
  FLEXIBLE = 'flexible',
}

export enum Guest {
  NO_GUESTS = 'no_guests',
  RARELY = 'rarely',
  FREQUENT = 'frequent',
}

export enum Cleanliness {
  RELAXED = 'relaxed',
  MODERATE = 'moderate',
  METICULOUS = 'meticulous',
}

export enum Communication {
  QUIET = 'quiet',
  CHATTY = 'chatty',
  BALANCED = 'balanced',
}

export enum Cooking {
  ORDERING_OUT = 'ordering_out',
  BASIC_COOK = 'basic_cook',
  MASTER_CHEF = 'master_chef',
}

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
