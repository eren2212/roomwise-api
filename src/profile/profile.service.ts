import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CreateProfileDto,
  UpdateAboutDto,
  UpdateOccupationDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto';
import type { Profile, UserPreferences, QuestionCatalog } from './entities';

@Injectable()
export class ProfileService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    // Normal client (RLS ile)
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE')!,
    );
  }

  // ============================================
  // PROFILE CRUD OPERATIONS
  // ============================================

  async createProfile(
    userId: string,
    createProfileDto: CreateProfileDto,
  ): Promise<Profile> {
    // Önce profil var mı kontrol et
    const existingProfile = await this.getProfileByUserId(userId);
    if (existingProfile?.has_seen_onboarding) {
      throw new ConflictException('Bu kullanıcının zaten bir profili var');
    }

    // Profil verisini hazırla
    const profileData: any = {
      id: userId,
      full_name: createProfileDto.full_name,
      birth_date: createProfileDto.birth_date,
      gender: createProfileDto.gender,
      occupation_status: createProfileDto.occupation_status,
    };

    // Occupation durumuna göre ilgili alanları ekle
    if (createProfileDto.occupation_status === 'student') {
      profileData.university = createProfileDto.university;
      profileData.department = createProfileDto.department;
    } else if (createProfileDto.occupation_status === 'professional') {
      profileData.occupation = createProfileDto.occupation;
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Profil oluşturulamadı: ${error.message}`,
      );
    }

    return data as Profile;
  }

  async getProfileByUserId(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Profil yoksa null dön
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new BadRequestException(`Profil getirilemedi: ${error.message}`);
    }

    return data as Profile;
  }

  async getMyProfile(userId: string): Promise<Profile> {
    const profile = await this.getProfileByUserId(userId);

    if (!profile) {
      throw new NotFoundException('Profil bulunamadı');
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        ...updateProfileDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Profil güncellenemedi: ${error.message}`,
      );
    }

    return data as Profile;
  }

  async updateAbout(
    userId: string,
    updateAboutDto: UpdateAboutDto,
  ): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        birth_date: updateAboutDto.birth_date,
        gender: updateAboutDto.gender,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Profil güncellenemedi: ${error.message}`,
      );
    }

    return data as Profile;
  }

  async updateOccupation(
    userId: string,
    updateOccupationDto: UpdateOccupationDto,
  ): Promise<Profile> {
    const updateData: any = {
      occupation_status: updateOccupationDto.occupation_status,
      updated_at: new Date().toISOString(),
    };

    // Eğer student ise university ve department ekle
    if (updateOccupationDto.occupation_status === 'student') {
      updateData.university = updateOccupationDto.university;
      updateData.department = updateOccupationDto.department;
    } else {
      // Professional ise occupation ekle
      updateData.occupation = updateOccupationDto.occupation;
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Profil güncellenemedi: ${error.message}`,
      );
    }

    return data as Profile;
  }

  async markOnboardingComplete(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        has_seen_onboarding: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Onboarding tamamlanamadı: ${error.message}`,
      );
    }

    return data as Profile;
  }

  // ============================================
  // AVATAR UPLOAD
  // ============================================

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    
    // ---------------------------------------------------------
    // ADIM 1: Mevcut avatar URL'ini kontrol et (Eski resmi bul)
    // ---------------------------------------------------------
    const { data: currentProfile, error: fetchError } = await this.supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Eğer profil hiç yoksa veya hata varsa, kritik değilse devam edebiliriz 
    // ama fetchError varsa loglamak iyidir.
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: Veri bulunamadı hatası (normal)
       console.error('Profil getirme hatası:', fetchError);
    }

    // ---------------------------------------------------------
    // ADIM 2: Eski avatar varsa storage'dan sil
    // ---------------------------------------------------------
    if (currentProfile?.avatar_url) {
      const oldFileName = currentProfile.avatar_url;
      
      // Sadece dosya ismini tuttuğumuz için direkt silebiliriz
      const { error: deleteError } = await this.supabase.storage
        .from('avatars')
        .remove([oldFileName]);

      if (deleteError) {
        console.warn('Eski avatar silinemedi (önemsiz):', deleteError.message);
      }
    }

    // ---------------------------------------------------------
    // ADIM 3: Yeni dosya adı oluştur (unique)
    // ---------------------------------------------------------
    // Dosya uzantısını al (önceki konuşmamızdaki mime-type garantisi ile)
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    // Bucket içinde klasör yapısı kullanıyorsan: `${userId}/${fileName}`
    // Express kodunda düz fileName kullanmışsın, ona sadık kalıyorum:
    const filePath = fileName; 

    // ---------------------------------------------------------
    // ADIM 4: Yeni avatar'ı storage'a yükle
    // ---------------------------------------------------------
    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false, // Aynı isimde dosya varsa üzerine yazmasın, zaten timestamp ile unique yaptık
      });

    if (uploadError) {
      throw new BadRequestException(`Avatar storage'a yüklenemedi: ${uploadError.message}`);
    }

    // ---------------------------------------------------------
    // ADIM 5 & 6: Profil Tablosunu Güncelle (UPSERT KULLANIMI)
    // ---------------------------------------------------------
    // BURASI KRİTİK NOKTA: 'insert' yerine 'upsert' kullanıyoruz.
    // Upsert mantığı: ID eşleşiyorsa UPDATE yap, eşleşmiyorsa INSERT yap.
    // Bu sayede "duplicate key" hatası almazsın.
    
    const { data: updatedProfile, error: dbError } = await this.supabase
      .from('profiles')
      .upsert({
        id: userId,          // Bu ID'ye bakacak (Primary Key)
        avatar_url: filePath, // Sadece filename'i kaydediyoruz
        updated_at: new Date().toISOString(), // Varsa böyle bir alanın
      })
      .select()
      .single();

    if (dbError) {
      // DB güncellemesi başarısız olursa, az önce yüklediğimiz resmi geri silmeliyiz (Cleanup)
      await this.supabase.storage.from('avatars').remove([filePath]);
      
      throw new BadRequestException(`Profil veritabanında güncellenemedi: ${dbError.message}`);
    }

    // ---------------------------------------------------------
    // ADIM 7: Sonuç Döndür
    // ---------------------------------------------------------
    return { avatar_url: filePath };
  }

  // ============================================
  // USER PREFERENCES
  // ============================================

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Preference yoksa null dön
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new BadRequestException(
        `Tercihler getirilemedi: ${error.message}`,
      );
    }

    return data as UserPreferences;
  }

  async updatePreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<UserPreferences> {
    // Önce preference var mı kontrol et
    const existingPreferences = await this.getPreferences(userId);

    if (existingPreferences) {
      // Update
      const { data, error } = await this.supabase
        .from('user_preferences')
        .update({
          ...updatePreferencesDto,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(
          `Tercihler güncellenemedi: ${error.message}`,
        );
      }

      return data as UserPreferences;
    } else {
      // Insert
      const { data, error } = await this.supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          ...updatePreferencesDto,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(
          `Tercihler oluşturulamadı: ${error.message}`,
        );
      }

      return data as UserPreferences;
    }
  }

  // ============================================
  // AVATAR DOWNLOAD
  // ============================================

  async getAvatar(
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // 1. Güvenlik Kontrolü: Path Traversal saldırılarını engelle
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('Geçersiz dosya adı');
    }

    // 2. Supabase Storage'dan dosyayı indir
    const { data, error } = await this.supabase.storage
      .from('avatars')
      .download(filename);

    if (error || !data) {
      throw new NotFoundException('Avatar resmi bulunamadı');
    }

    // 3. Dosya tipini belirle (Express kodundaki mantık)
    let contentType = 'image/jpeg'; // Varsayılan
    if (filename.endsWith('.png')) {
      contentType = 'image/png';
    } else if (filename.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    // 4. Blob verisini Buffer'a çevir
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, contentType };
  }

  /**
   * Avatar'ı public olarak indir (RLS bypass)
   * Bu metod authentication gerektirmez
   */
  async downloadAvatar(
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // 1. Güvenlik Kontrolü: Path Traversal saldırılarını engelle
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('Geçersiz dosya adı');
    }

    // 2. Supabase Storage'dan dosyayı indir
    const { data, error } = await this.supabase.storage
      .from('avatars')
      .download(filename);

    if (error || !data) {
      throw new NotFoundException('Avatar resmi bulunamadı');
    }

    // 3. Dosya tipini belirle
    let contentType = 'image/jpeg'; // Varsayılan
    if (filename.endsWith('.png')) {
      contentType = 'image/png';
    } else if (filename.endsWith('.webp')) {
      contentType = 'image/webp';
    }

    // 4. Blob verisini Buffer'a çevir
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer, contentType };
  }

  // ============================================
  // QUESTION CATALOG
  // ============================================

  async getQuestions(): Promise<QuestionCatalog[]> {
    const { data, error } = await this.supabase
      .from('question_catalog')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      throw new BadRequestException(`Sorular getirilemedi: ${error.message}`);
    }

    return data as QuestionCatalog[];
  }

  // ============================================
  // PROFILE COMPLETION CHECK
  // ============================================

  async checkProfileCompletion(userId: string): Promise<{
    hasProfile: boolean;
    profileComplete: boolean;
    hasPreferences: boolean;
    onboardingComplete: boolean;
    nextStep: string | null;
  }> {
    const profile = await this.getProfileByUserId(userId);
    const preferences = await this.getPreferences(userId);

    if (!profile) {
      return {
        hasProfile: false,
        profileComplete: false,
        hasPreferences: false,
        onboardingComplete: false,
        nextStep: 'create_profile',
      };
    }

    // Profil tamamlanmış mı kontrol et
    const isProfileComplete =
      !!profile.full_name &&
      !!profile.birth_date &&
      !!profile.gender &&
      !!profile.occupation_status;

    if (!isProfileComplete) {
      // Hangi adımda kaldığını bul
      if (!profile.birth_date || !profile.gender) {
        return {
          hasProfile: true,
          profileComplete: false,
          hasPreferences: !!preferences,
          onboardingComplete: false,
          nextStep: 'about_you',
        };
      }

      if (!profile.occupation_status) {
        return {
          hasProfile: true,
          profileComplete: false,
          hasPreferences: !!preferences,
          onboardingComplete: false,
          nextStep: 'occupation',
        };
      }
    }

    // Preferences var mı?
    if (!preferences) {
      return {
        hasProfile: true,
        profileComplete: true,
        hasPreferences: false,
        onboardingComplete: false,
        nextStep: 'preferences',
      };
    }

    return {
      hasProfile: true,
      profileComplete: true,
      hasPreferences: true,
      onboardingComplete: profile.has_seen_onboarding ?? false,
      nextStep: profile.has_seen_onboarding ? null : 'complete_onboarding',
    };
  }
}
