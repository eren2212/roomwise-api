import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Ev isteği oluşturma DTO
 */
export class CreateRequestDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Ev ID zorunludur' })
  house_id: string;

  @IsString()
  @IsOptional()
  @MaxLength(140, { message: 'Mesaj en fazla 140 karakter olabilir' })
  message?: string;
}
