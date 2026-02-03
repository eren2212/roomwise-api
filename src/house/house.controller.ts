import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HouseService } from './house.service';
import { SupabaseGuard } from '../auth/supabase.guard';
import { Public } from '../auth/public.decorator';
import type { RequestWithUser } from '../auth/supabase.guard';
import { CreateHouseDto, UpdateHouseDto } from './dto';

@Controller('houses')
@UseGuards(SupabaseGuard)
export class HouseController {
  constructor(private readonly houseService: HouseService) {}

  /**
   * Ev ilanı oluştur
   * POST /houses
   */
  @Post()
  @UseInterceptors(FilesInterceptor('photos', 10))
  async createHouse(
    @Request() req: RequestWithUser,
    @Body() createHouseDto: CreateHouseDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Dosya validasyonu
    if (files && files.length > 0) {
      const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
      const maxFileSize = 10 * 1024 * 1024; // 10MB

      for (const file of files) {
        if (!allowedMimes.includes(file.mimetype)) {
          throw new BadRequestException(
            'Sadece JPEG, PNG ve WebP formatları desteklenmektedir',
          );
        }

        if (file.size > maxFileSize) {
          throw new BadRequestException('Her resim en fazla 10MB olabilir');
        }
      }
    }

    const userId = req.user!.id;
    const house = await this.houseService.createHouse(
      userId,
      createHouseDto,
      files,
    );

    return {
      success: true,
      message: 'Ev ilanı başarıyla oluşturuldu',
      data: house,
    };
  }

  /**
   * Ev ilanını güncelle
   * PATCH /houses/:id
   */
  @Patch(':id')
  async updateHouse(
    @Request() req: RequestWithUser,
    @Param('id') houseId: string,
    @Body() updateHouseDto: UpdateHouseDto,
  ) {
    const userId = req.user!.id;
    const house = await this.houseService.updateHouse(
      userId,
      houseId,
      updateHouseDto,
    );

    return {
      success: true,
      message: 'Ev ilanı başarıyla güncellendi',
      data: house,
    };
  }

  /**
   * Tüm aktif ilanları getir (Arama için)
   * GET /houses
   */
  @Public()
  @Get()
  async getAllHouses() {
    const houses = await this.houseService.getAllHouses();

    return {
      success: true,
      data: houses,
    };
  }

  /**
   * Tek ev ilanını getir
   * GET /houses/:id
   */
  @Public()
  @Get(':id')
  async getHouseById(@Param('id') houseId: string) {
    const house = await this.houseService.getHouseById(houseId);

    return {
      success: true,
      data: house,
    };
  }

  /**
   * Kullanıcının kendi ilanlarını getir
   * GET /houses/me
   */
  @Get('me/listings')
  async getMyHouses(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const houses = await this.houseService.getMyHouses(userId);

    return {
      success: true,
      data: houses,
    };
  }

  /**
   * Ev ilanını sil (soft delete)
   * DELETE /houses/:id
   */
  @Delete(':id')
  async deleteHouse(
    @Request() req: RequestWithUser,
    @Param('id') houseId: string,
  ) {
    const userId = req.user!.id;
    await this.houseService.deleteHouse(userId, houseId);

    return {
      success: true,
      message: 'Ev ilanı başarıyla silindi',
    };
  }

  /**
   * Ev resmini indir (Public)
   * GET /houses/images/:houseId/:filename
   */
  @Public()
  @Get('images/:houseId/:filename')
  async downloadHouseImage(
    @Param('houseId') houseId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const { buffer, contentType } =
        await this.houseService.downloadHouseImage(houseId, filename);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error: any) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
