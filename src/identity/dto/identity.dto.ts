// dto/identity.dto.ts
import { IsNotEmpty } from 'class-validator';

/**
 * Request DTO - Multipart/form-data ile gelen dosyalar için
 * Controller'da @UploadedFiles() decorator ile kullanılır
 */
export class VerifyIdentityDto {
  @IsNotEmpty({ message: 'Selfie fotoğrafı zorunludur' })
  selfie: Express.Multer.File;

  @IsNotEmpty({ message: 'Kimlik fotoğrafı zorunludur' })
  idPhoto: Express.Multer.File;
}

/**
 * Response DTO - Doğrulama sonucu
 */
export class VerifyIdentityResponseDto {
  success: boolean;
  message: string;
  confidence?: number;
  verificationStatus: 'verified' | 'rejected' | 'pending';
  details?: {
    faceMatches?: number;
    similarity?: number;
    timestamp: string;
  };
}

/**
 * Error Response DTO
 */
export class VerifyIdentityErrorDto {
  success: false;
  message: string;
  error: string;
  statusCode: number;
}
