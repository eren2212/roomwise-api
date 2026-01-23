import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Gender } from './create-profile.dto';

export class UpdateAboutDto {
  @IsDateString()
  @IsOptional()
  birth_date?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
