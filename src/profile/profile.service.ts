import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
    if (existingProfile) {
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

    // Opsiyonel alanlar
    if (createProfileDto.nickname) {
      profileData.nickname = createProfileDto.nickname;
    }
    if (createProfileDto.avatar_url) {
      profileData.avatar_url = createProfileDto.avatar_url;
    }
    if (createProfileDto.bio) {
      profileData.bio = createProfileDto.bio;
    }

    // Occupation durumuna göre ilgili alanları ekle
    if (createProfileDto.occupation_status === 'student') {
      profileData.university = createProfileDto.university;
      profileData.department = createProfileDto.department;
    } else if (createProfileDto.occupation_status === 'professional') {
      profileData.occupation = createProfileDto.occupation;
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .insert(profileData)
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
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(
        `Avatar yüklenemedi: ${error.message}`,
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from('avatars').getPublicUrl(filePath);

    // Update profile with avatar URL
    await this.updateProfile(userId, { avatar_url: publicUrl });

    return { avatar_url: publicUrl };
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

  async downloadAvatar(filename: string): Promise<{ buffer: Buffer }> {
    const { data, error } = await this.supabase.storage
      .from('avatars')
      .download(filename);

    if (error || !data) {
      throw new BadRequestException('Avatar bulunamadı');
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { buffer };
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
