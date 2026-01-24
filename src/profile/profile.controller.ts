import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { SupabaseGuard } from '../auth/supabase.guard';
import { Public } from '../auth/public.decorator';
import type { RequestWithUser } from '../auth/supabase.guard';
import {
  CreateProfileDto,
  UpdateAboutDto,
  UpdateOccupationDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto';

@Controller('profiles')
@UseGuards(SupabaseGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ============================================
  // PROFILE ENDPOINTS
  // ============================================

  /**
   * Profil Oluşturma (Tek Endpoint - Tüm Bilgiler)
   * Frontend'de kullanıcı tüm adımları doldurduktan sonra
   * tek seferde bu endpoint'e istek gönderir.
   * İçinde: full_name, birth_date, gender, occupation_status,
   * university/department (student ise) veya occupation (professional ise)
   */
  @Post()
  async createProfile(
    @Request() req: RequestWithUser,
    @Body() createProfileDto: CreateProfileDto,
  ) {
    const userId = req.user!.id;
    const profile = await this.profileService.createProfile(
      userId,
      createProfileDto,
    );

    return {
      success: true,
      message: 'Profil başarıyla oluşturuldu',
      data: profile,
    };
  }

  @Get('me')
  async getMyProfile(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const profile = await this.profileService.getMyProfile(userId);

    return {
      success: true,
      data: profile,
    };
  }

  /**
   * Profil Güncelleme (Genel) - Profil oluşturulduktan sonra
   * kullanıcı profil sayfasından bilgilerini güncelleyebilir
   */
  @Patch('me')
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user!.id;
    const profile = await this.profileService.updateProfile(
      userId,
      updateProfileDto,
    );

    return {
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: profile,
    };
  }

  /**
   * Hakkında Bilgilerini Güncelle (Sonradan düzenleme için)
   */
  @Patch('me/about')
  async updateAbout(
    @Request() req: RequestWithUser,
    @Body() updateAboutDto: UpdateAboutDto,
  ) {
    const userId = req.user!.id;
    const profile = await this.profileService.updateAbout(
      userId,
      updateAboutDto,
    );

    return {
      success: true,
      message: 'Hakkında bilgileri güncellendi',
      data: profile,
    };
  }

  /**
   * Meslek Bilgilerini Güncelle (Sonradan düzenleme için)
   */
  @Patch('me/occupation')
  async updateOccupation(
    @Request() req: RequestWithUser,
    @Body() updateOccupationDto: UpdateOccupationDto,
  ) {
    const userId = req.user!.id;
    const profile = await this.profileService.updateOccupation(
      userId,
      updateOccupationDto,
    );

    return {
      success: true,
      message: 'Meslek bilgileri güncellendi',
      data: profile,
    };
  }

  @Post('me/complete-onboarding')
  async completeOnboarding(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const profile = await this.profileService.markOnboardingComplete(userId);

    return {
      success: true,
      message: 'Onboarding tamamlandı',
      data: profile,
    };
  }

  @Get('me/check-completion')
  async checkProfileCompletion(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const status = await this.profileService.checkProfileCompletion(userId);

    return {
      success: true,
      data: status,
    };
  }

  // ============================================
  // AVATAR UPLOAD
  // ============================================

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar dosyası yüklenmedi');
    }

    // Dosya tipi kontrolü
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Sadece JPEG, PNG ve WebP formatları desteklenmektedir',
      );
    }

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("Avatar boyutu 5MB'dan küçük olmalıdır");
    }

    const userId = req.user!.id;
    const result = await this.profileService.uploadAvatar(userId, file);

    return {
      success: true,
      message: 'Avatar başarıyla yüklendi',
      data: result,
    };
  }

  @Get('me/avatar/:filename')
  async getAvatar(
    @Param('filename') filename: string,
    @Res() res: Response, // Express response objesine erişim
  ) {
    // Service'den buffer ve content type'ı al
    const { buffer, contentType } = await this.profileService.getAvatar(
      filename,
    );
    if (!buffer || !contentType) {
      throw new BadRequestException('Avatar bulunamadı');
    }

    // Header ayarları (Cache ve Type)
    res.set({
      'Content-Type': contentType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000', // 1 yıl cache
    });

    // Buffer'ı client'a gönder
    res.send(buffer);
  }
  // ============================================
  // PREFERENCES ENDPOINTS
  // ============================================

  @Get('preferences')
  async getPreferences(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const preferences = await this.profileService.getPreferences(userId);

    return {
      success: true,
      data: preferences,
    };
  }

  @Put('preferences')
  async updatePreferences(
    @Request() req: RequestWithUser,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    const userId = req.user!.id;
    const preferences = await this.profileService.updatePreferences(
      userId,
      updatePreferencesDto,
    );

    return {
      success: true,
      message: 'Tercihler başarıyla güncellendi',
      data: preferences,
    };
  }

  // ============================================
  // QUESTION CATALOG
  // ============================================

  @Get('questions')
  async getQuestions() {
    const questions = await this.profileService.getQuestions();

    return {
      success: true,
      data: questions,
    };
  }

  // ============================================
  // AVATAR DOWNLOAD (Public - RLS bypass)
  // ============================================

  /**
   * Avatar resmini download et
   * Public endpoint - herkes görebilir
   */
  @Public()
  @Get('avatar/:filename')
  async downloadAvatar(@Param('filename') filename: string, @Res() res: Response) {
    try {
      // Güvenlik kontrolü
      if (!filename || filename.includes('..') || filename.includes('/')) {
        throw new BadRequestException('Geçersiz dosya adı');
      }

      const result = await this.profileService.downloadAvatar(filename);
      
      // Content type belirle
      const contentType = filename.endsWith('.png')
        ? 'image/png'
        : filename.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(result.buffer);
    } catch (error: any) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
