import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateRequestDto, UpdateRequestStatusDto } from './dto';
import type { HouseRequest, HouseRequestWithProfile } from './entities';

@Injectable()
export class RequestService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_KEY')!,
    );
  }

  /**
   * Yeni ev isteği oluştur
   */
  async createRequest(
    userId: string,
    createRequestDto: CreateRequestDto,
  ): Promise<HouseRequest> {
    const { house_id, message } = createRequestDto;

    // Ev kontrolü
    const { data: house, error: houseError } = await this.supabase
      .from('houses')
      .select('id, owner_id, is_active')
      .eq('id', house_id)
      .single();

    if (houseError || !house) {
      throw new NotFoundException('Ev bulunamadı');
    }

    if (!house.is_active) {
      throw new BadRequestException('Bu ev ilanı artık aktif değil');
    }

    // Kendi evine istek gönderemez
    if (house.owner_id === userId) {
      throw new BadRequestException('Kendi evinize istek gönderemezsiniz');
    }

    // İstek oluştur
    const { data: request, error: requestError } = await this.supabase
      .from('house_requests')
      .insert({
        house_id,
        user_id: userId,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      // Unique constraint hatası
      if (requestError.code === '23505') {
        throw new ConflictException('Bu eve zaten istek gönderdiniz');
      }
      throw new BadRequestException(
        `İstek oluşturulamadı: ${requestError.message}`,
      );
    }

    return request as HouseRequest;
  }

  /**
   * Eve gelen istekleri getir (sadece ev sahibi görebilir)
   */
  async getRequestsForHouse(
    userId: string,
    houseId: string,
  ): Promise<HouseRequestWithProfile[]> {
    // Ev sahipliği kontrolü
    const { data: house, error: houseError } = await this.supabase
      .from('houses')
      .select('owner_id')
      .eq('id', houseId)
      .single();

    if (houseError || !house) {
      throw new NotFoundException('Ev bulunamadı');
    }
    // İstekleri profil bilgileri ile getir
    const { data: requests, error } = await this.supabase
      .from('house_requests')
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          avatar_url,
          birth_date,
          gender,
          occupation,
          verification_status
        )
      `,
      )
      .eq('house_id', houseId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`İstekler getirilemedi: ${error.message}`);
    }

    return (requests || []) as HouseRequestWithProfile[];
  }

  /**
   * Kullanıcının evlerine gelen bekleyen istek sayısını getir
   */
  async getPendingRequestCount(userId: string): Promise<number> {
    // Kullanıcının evlerini bul
    const { data: houses, error: housesError } = await this.supabase
      .from('houses')
      .select('id')
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (housesError || !houses || houses.length === 0) {
      return 0;
    }

    const houseIds = houses.map((h) => h.id);

    // Bekleyen istek sayısını getir
    const { count, error } = await this.supabase
      .from('house_requests')
      .select('*', { count: 'exact', head: true })
      .in('house_id', houseIds)
      .eq('status', 'pending');

    if (error) {
      return 0;
    }

    return count || 0;
  }

  /**
   * İstek detayını getir (profil bilgileri ile)
   */
  async getRequestById(
    userId: string,
    requestId: string,
  ): Promise<HouseRequestWithProfile> {
    const { data: request, error } = await this.supabase
      .from('house_requests')
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          avatar_url,
          birth_date,
          gender,
          occupation,
          verification_status
        ),
        houses (
          id,
          title,
          owner_id
        )
      `,
      )
      .eq('id', requestId)
      .single();

    if (error || !request) {
      throw new NotFoundException('İstek bulunamadı');
    }

    // Sadece ev sahibi veya isteği gönderen görebilir
    const isOwner = request.houses?.owner_id === userId;
    const isRequester = request.user_id === userId;

    if (!isOwner && !isRequester) {
      throw new ForbiddenException('Bu isteği görme yetkiniz yok');
    }

    return request as HouseRequestWithProfile;
  }

  /**
   * İstek durumunu güncelle (kabul/red)
   */
  async updateRequestStatus(
    userId: string,
    requestId: string,
    updateDto: UpdateRequestStatusDto,
  ): Promise<HouseRequest> {
    // İstek ve ev bilgisini getir
    const { data: request, error: fetchError } = await this.supabase
      .from('house_requests')
      .select(
        `
        *,
        houses (
          id,
          owner_id
        )
      `,
      )
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new NotFoundException('İstek bulunamadı');
    }
    // Zaten işlenmiş mi?
    if (request.status !== 'pending') {
      throw new BadRequestException('Bu istek zaten işlendi');
    }

    // Durumu güncelle
    const { data: updatedRequest, error: updateError } = await this.supabase
      .from('house_requests')
      .update({
        status: updateDto.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(
        `İstek güncellenemedi: ${updateError.message}`,
      );
    }

    return updatedRequest as HouseRequest;
  }
}
