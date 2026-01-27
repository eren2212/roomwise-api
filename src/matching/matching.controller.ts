import { 
  Controller, 
  Get, 
  Post, 
  Body,
  Param,
  Query, 
  Req, 
  UnauthorizedException,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import { SwipeDto } from './dto/swipe.dto';
import { SupabaseGuard } from 'src/auth/supabase.guard';
import type { RequestWithUser } from 'src/auth/supabase.guard';

@Controller('matches')
@UseGuards(SupabaseGuard) // ← Guard'ı tüm controller'a ekle
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  // 1. POTANSİYEL ADAYLARI LİSTELE (Swipe için)
  @Get('potential')
  async getPotentialMatches(
    @Req() req: RequestWithUser,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('rad') rad: string,
  ) {
    const userId = req.user?.id; 

    if (!userId) {
      throw new UnauthorizedException('Kullanıcı girişi gerekli');
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radius = rad ? parseInt(rad) : 30; // Varsayılan 30km

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radius)) {
      throw new UnauthorizedException('Geçersiz koordinat veya yarıçap');
    }

    return await this.matchingService.findMatchesForUser(userId, latitude, longitude, radius);
  }

  // 2. SWIPE İŞLEMİ (Like/Dislike/Superlike)
  @Post('swipe')
  async swipe(
    @Req() req: RequestWithUser,
    @Body(ValidationPipe) swipeDto: SwipeDto,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Kullanıcı girişi gerekli');
    }

    return await this.matchingService.createSwipe(
      userId,
      swipeDto.swipedUserId,
      swipeDto.action,
      swipeDto.houseId,
    );
  }

  // 3. KULLANICININ TÜM EŞLEŞMELERİNİ LİSTELE
  @Get()
  async getMyMatches(@Req() req: RequestWithUser) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Kullanıcı girişi gerekli');
    }

    return await this.matchingService.getUserMatches(userId);
  }

  // 4. TEK BİR EŞLEŞMENİN DETAYINI AL
  @Get(':matchId')
  async getMatchDetail(
    @Req() req: RequestWithUser,
    @Param('matchId') matchId: string,
  ) {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Kullanıcı girişi gerekli');
    }

    return await this.matchingService.getMatchById(matchId, userId);
  }
}