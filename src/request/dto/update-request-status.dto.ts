import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * İstek durumu güncelleme DTO
 */
export class UpdateRequestStatusDto {
  @IsEnum(['verified', 'rejected'], {
    message: 'Durum verified veya rejected olmalıdır',
  })
  @IsNotEmpty({ message: 'Durum zorunludur' })
  status: 'verified' | 'rejected';
}
