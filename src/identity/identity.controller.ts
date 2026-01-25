import {
  Controller,
  Post,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IdentityService } from './identity.service';
import { SupabaseGuard } from '../auth/supabase.guard';
import { VerifyIdentityResponseDto } from './dto/identity.dto';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  /**
   * POST /identity/verify
   * Kimlik doğrulama endpoint'i
   *
   * Multipart/form-data ile 2 dosya alır:
   * - selfie: Kullanıcının selfie fotoğrafı
   * - idPhoto: Kimlik belgesindeki fotoğraf
   *
   * @example
   * FormData:
   *   selfie: File (image/jpeg, image/png)
   *   idPhoto: File (image/jpeg, image/png)
   */
  @UseGuards(SupabaseGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'selfie', maxCount: 1 },
      { name: 'idPhoto', maxCount: 1 },
    ]),
  )
  async verify(
    @Req() req,
    @UploadedFiles()
    files: {
      selfie?: Express.Multer.File[];
      idPhoto?: Express.Multer.File[];
    },
  ): Promise<VerifyIdentityResponseDto> {
    // User ID'yi JWT token'dan al
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new BadRequestException('Kullanıcı kimliği bulunamadı');
    }

    // Dosya kontrolü
    if (!files || !files.selfie || !files.idPhoto) {
      throw new BadRequestException(
        'Hem selfie hem de kimlik fotoğrafı yüklenmelidir',
      );
    }

    const selfieFile = files.selfie[0];
    const idPhotoFile = files.idPhoto[0];

    if (!selfieFile || !idPhotoFile) {
      throw new BadRequestException(
        'Hem selfie hem de kimlik fotoğrafı yüklenmelidir',
      );
    }

    // Service'e gönder
    return this.identityService.verifyUserIdentity(
      userId,
      selfieFile,
      idPhotoFile,
    );
  }

  /**
   * GET /identity/status
   * Kullanıcının mevcut doğrulama durumunu getir
   */
  @UseGuards(SupabaseGuard)
  @Get('status')
  async getStatus(@Req() req) {
    const userId = req.user?.sub || req.user?.id;

    if (!userId) {
      throw new BadRequestException('Kullanıcı kimliği bulunamadı');
    }

    return this.identityService.getVerificationStatus(userId);
  }
}
