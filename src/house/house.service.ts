import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateHouseDto, UpdateHouseDto } from './dto';
import type { House } from './entities';
import sharp from 'sharp';

@Injectable()
export class HouseService {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient; // Service role için

  constructor(private configService: ConfigService) {
    // Normal client (RLS ile)
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_KEY')!,
    );

    // Admin client (RLS bypass - storage için)
    this.supabaseAdmin = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE')!,
    );
  }

  /**
   * Ev ilanı oluştur ve resimleri yükle
   */
  async createHouse(
    userId: string,
    createHouseDto: CreateHouseDto,
    files?: Express.Multer.File[],
  ): Promise<House> {
    // House verisini oluştur
    const houseData: any = {
      owner_id: userId,
      title: createHouseDto.title,
      description: createHouseDto.description || null,
      address: createHouseDto.address || null,
      city: createHouseDto.city || 'Konya',
      rent_amount: createHouseDto.rent_amount,
      currency: createHouseDto.currency || 'TRY',
      deposit_amount: createHouseDto.deposit_amount || null,
      rules: createHouseDto.rules || [],
      max_occupancy: createHouseDto.max_occupancy || 3,
      amenities: createHouseDto.amenities || [],
      gender_preference:
        createHouseDto.gender_preference || 'prefer_not_to_say',
      is_active: true,
    };

    // Location varsa ekle (PostGIS WKT formatı)
    if (createHouseDto.latitude && createHouseDto.longitude) {
      houseData.location = `POINT(${createHouseDto.longitude} ${createHouseDto.latitude})`;
    }

    // Database'e insert et
    const { data: house, error: dbError } = await this.supabase
      .from('houses')
      .insert(houseData)
      .select()
      .single();

    if (dbError) {
      throw new BadRequestException(
        `Ev ilanı oluşturulamadı: ${dbError.message}`,
      );
    }

    // Resimler varsa yükle
    if (files && files.length > 0) {
      try {
        await this.uploadHouseImages(house.id, files);

        // Güncel house verisini getir
        const { data: updatedHouse } = await this.supabase
          .from('houses')
          .select('*')
          .eq('id', house.id)
          .single();

        return updatedHouse as House;
      } catch (error: any) {
        // Resim yükleme başarısız olursa house'u sil
        await this.supabase.from('houses').delete().eq('id', house.id);
        throw error;
      }
    }

    return house as House;
  }

  /**
   * Ev resimlerini Sharp ile sıkıştırıp yükle
   */
  async uploadHouseImages(
    houseId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Sharp ile resmi sıkıştır ve WebP formatına çevir
        const compressedBuffer = await sharp(file.buffer)
          .resize(1920, 1080, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80 })
          .toBuffer();

        // Dosya yolu: {houseId}/{timestamp}-{index}.webp
        const fileName = `${Date.now()}-${i}.webp`;
        const filePath = `${houseId}/${fileName}`;

        // Storage'a yükle (Admin client ile - RLS bypass)
        const { error: uploadError } = await this.supabaseAdmin.storage
          .from('houses-images')
          .upload(filePath, compressedBuffer, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (uploadError) {
          throw new BadRequestException(
            `Resim yüklenemedi: ${uploadError.message}`,
          );
        }

        uploadedPaths.push(filePath);
        uploadedUrls.push(filePath);
      }

      // Tüm resimlerin URL'lerini database'e kaydet
      const { error: updateError } = await this.supabase
        .from('houses')
        .update({ photos: uploadedUrls })
        .eq('id', houseId);

      if (updateError) {
        // DB güncellemesi başarısız olursa yüklenen resimleri temizle
        await this.supabaseAdmin.storage
          .from('houses-images')
          .remove(uploadedPaths);

        throw new BadRequestException(
          `Resim URL'leri kaydedilemedi: ${updateError.message}`,
        );
      }

      return uploadedUrls;
    } catch (error: any) {
      // Hata oluşursa yüklenen resimleri temizle
      if (uploadedPaths.length > 0) {
        await this.supabaseAdmin.storage
          .from('houses-images')
          .remove(uploadedPaths);
      }
      throw error;
    }
  }

  /**
   * Ev ilanını güncelle
   */
  async updateHouse(
    userId: string,
    houseId: string,
    updateHouseDto: UpdateHouseDto,
  ): Promise<House> {
    // Ownership kontrolü
    const { data: existingHouse, error: fetchError } = await this.supabase
      .from('houses')
      .select('owner_id')
      .eq('id', houseId)
      .single();

    if (fetchError || !existingHouse) {
      throw new NotFoundException('Ev ilanı bulunamadı');
    }

    if (existingHouse.owner_id !== userId) {
      throw new ForbiddenException('Bu ilanı güncelleme yetkiniz yok');
    }

    // Update verisini hazırla
    const updateData: any = { ...updateHouseDto };

    // Location güncellemesi varsa WKT formatında ekle
    if (updateHouseDto.latitude && updateHouseDto.longitude) {
      updateData.location = `POINT(${updateHouseDto.longitude} ${updateHouseDto.latitude})`;
    }

    // Latitude ve longitude'u çıkar (database'de yok)
    delete updateData.latitude;
    delete updateData.longitude;

    // Güncelleme yap
    const { data: updatedHouse, error: updateError } = await this.supabase
      .from('houses')
      .update(updateData)
      .eq('id', houseId)
      .select()
      .single();

    if (updateError) {
      throw new BadRequestException(
        `Ev ilanı güncellenemedi: ${updateError.message}`,
      );
    }

    return updatedHouse as House;
  }

  /**
   * ID'ye göre ev ilanını getir
   */
  async getHouseById(houseId: string): Promise<House> {
    const { data: house, error } = await this.supabase
      .from('houses')
      .select('*')
      .eq('id', houseId)
      .eq('is_active', true)
      .single();

    if (error || !house) {
      throw new NotFoundException('Ev ilanı bulunamadı');
    }

    return house as House;
  }

  /**
   * Kullanıcının kendi ilanlarını getir
   */
  async getMyHouses(userId: string): Promise<House[]> {
    const { data: houses, error } = await this.supabase
      .from('houses')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`İlanlar getirilemedi: ${error.message}`);
    }

    return (houses || []) as House[];
  }

  /**
   * Tüm aktif ilanları getir (arama için)
   */
  async getAllHouses(): Promise<House[]> {
    const { data: houses, error } = await this.supabase
      .from('houses')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`İlanlar getirilemedi: ${error.message}`);
    }

    return (houses || []) as House[];
  }

  /**
   * Ev ilanını soft delete yap (is_active = false)
   */
  async deleteHouse(userId: string, houseId: string): Promise<void> {
    // Ownership kontrolü
    const { data: existingHouse, error: fetchError } = await this.supabase
      .from('houses')
      .select('owner_id')
      .eq('id', houseId)
      .single();

    if (fetchError || !existingHouse) {
      throw new NotFoundException('Ev ilanı bulunamadı');
    }

    if (existingHouse.owner_id !== userId) {
      throw new ForbiddenException('Bu ilanı silme yetkiniz yok');
    }

    // Soft delete
    const { error: deleteError } = await this.supabase
      .from('houses')
      .update({ is_active: false })
      .eq('id', houseId);

    if (deleteError) {
      throw new BadRequestException(`İlan silinemedi: ${deleteError.message}`);
    }
  }

  /**
   * Kullanıcının aktif ev üyeliğini ve ev arkadaşlarını getir
   */
  async getMyMembership(userId: string): Promise<{
    house: House;
    members: Array<{
      id: string;
      user_id: string;
      role: string;
      joined_at: string;
      profile: {
        id: string;
        full_name: string;
        avatar_url: string | null;
      };
    }>;
    currentUserId: string;
  } | null> {
    // Kullanıcının aktif üyeliğini bul (left_at IS NULL)
    const { data: membership, error: membershipError } = await this.supabase
      .from('house_members')
      .select('house_id')
      .eq('user_id', userId)
      .is('left_at', null)
      .single();

    if (membershipError || !membership) {
      return null;
    }

    const houseId = membership.house_id;

    // Ev detayını getir
    const { data: house, error: houseError } = await this.supabase
      .from('houses')
      .select('*')
      .eq('id', houseId)
      .single();

    if (houseError || !house) {
      return null;
    }

    // Aynı evin tüm aktif üyelerini getir (profiles ile join)
    const { data: members, error: membersError } = await this.supabase
      .from('house_members')
      .select(
        `
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('house_id', houseId)
      .is('left_at', null);

    if (membersError) {
      throw new BadRequestException(
        `Ev üyeleri getirilemedi: ${membersError.message}`,
      );
    }

    // Profiles nesnesini düzleştir
    const formattedMembers = (members || []).map((member: any) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      profile: member.profiles || {
        id: member.user_id,
        full_name: 'Bilinmiyor',
        avatar_url: null,
      },
    }));

    return {
      house: house as House,
      members: formattedMembers,
      currentUserId: userId,
    };
  }

  /**
   * Ev resmini indir (Public access)
   */
  async downloadHouseImage(
    houseId: string,
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // Güvenlik kontrolü: Path traversal saldırılarını engelle
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Geçersiz dosya adı');
    }

    // Dosya yolu
    const filePath = `${houseId}/${filename}`;

    // Storage'dan indir
    const { data, error } = await this.supabase.storage
      .from('houses-images')
      .download(filePath);

    if (error || !data) {
      throw new NotFoundException('Resim bulunamadı');
    }

    // Content type belirle
    let contentType = 'image/webp'; // Varsayılan
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png';
    }

    // Blob'u Buffer'a çevir
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, contentType };
  }
}
