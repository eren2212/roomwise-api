import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PREFERENCE_MAP, WEIGHTS } from './dto/enum.dto';
import { Database } from 'src/database.types';

type UserPreference = Database['public']['Tables']['user_preferences']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];
type SwipeAction = Database['public']['Enums']['swipe_action'];

@Injectable()
export class MatchingService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    // .env dosyasındaki anahtarları kullanıyoruz
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
    );
  }

  // 1. ANA FONKSİYON: Kullanıcıya uygun adayları bul
  async findMatchesForUser(
    userId: string,
    lat: number,
    lng: number,
    radiusKm: number,
  ) {
    const radiusMeters = radiusKm * 1000;

    // A) RPC Çağır
    const { data: candidates, error } = await this.supabase.rpc(
      'get_nearby_candidates',
      {
        query_user_id: userId,
        center_lat: lat,
        center_long: lng,
        radius_meters: radiusMeters,
      },
    );

    if (error) {
      console.error('RPC Hatası:', error);
      throw new Error(`Adaylar çekilemedi: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) return [];

    // B) Benim Tercihlerim
    const { data: myPrefs, error: myPrefsError } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (myPrefsError && myPrefsError.code !== 'PGRST116') {
      throw new Error(`Tercihler çekilemedi: ${myPrefsError.message}`);
    }

    // C) Adayların Tercihleri
    const candidateIds = candidates.map((c: any) => c.id);
    const { data: candidatePrefsList } = await this.supabase
      .from('user_preferences')
      .select('*')
      .in('user_id', candidateIds);

    // --- KATALOG ÇEKME ---
    // TypeScript burada hata vermesin diye sonucu 'any' olarak işaretleyebiliriz
    // Ama en temiz çözüm aşağıda map içinde 'as any' kullanmaktır.
    const { data: catalog } = await this.supabase
      .from('question_catalog')
      .select('target_column, icon_name, options, label_tr');

    // D) Birleştirme
    const results = candidates.map((candidate: any) => {
      const rawPrefs = candidatePrefsList?.find(
        (p) => p.user_id === candidate.id,
      );

      const score =
        myPrefs && rawPrefs
          ? this.calculateWeightedEuclidean(myPrefs, rawPrefs)
          : 50;

      // --- İSTEDİĞİN KISIM VE DÜZELTME ---
      const preferencesList = catalog
        // BURASI DEĞİŞTİ: (catItem: any) diyerek TypeScript kontrolünü aşıyoruz
        ?.map((item: any) => {
          const catItem = item; // Artık hata vermez

          // 1. Sütun Adı
          const column = catItem.target_column;

          // 2. İKON
          const staticIcon = catItem.icon_name;

          // 3. Değer
          const userValue = rawPrefs ? rawPrefs[column] : null;

          // 4. Label
          const optionsArray = catItem.options as any[];

          const labelData = Array.isArray(optionsArray)
            ? optionsArray.find((opt: any) => opt.value === userValue)
            : null;

          return {
            key: column,
            icon: staticIcon,
            title: catItem.label_tr || 'Bilinmiyor', // Artık hata vermez
            value: userValue,
            label: labelData?.label || 'Belirtilmemiş',
          };
        })
        .filter((item) => item.value !== null);

      return {
        ...candidate,
        match_score: score,
        preferences: preferencesList || [],
      };
    });

    return results.sort((a, b) => b.match_score - a.match_score);
  }

  // 2. SWIPE İŞLEMİ: Like/Dislike/Superlike
  async createSwipe(
    swiperId: string,
    swipedId: string,
    action: SwipeAction,
    houseId?: string,
  ) {
    // Kendine swipe yapamaz
    if (swiperId === swipedId) {
      throw new BadRequestException('Kendine swipe yapamazsın');
    }

    // Daha önce swipe yapılmış mı kontrol et
    const { data: existingSwipe } = await this.supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', swiperId)
      .eq('swiped_id', swipedId)
      .single();

    if (existingSwipe) {
      throw new BadRequestException('Bu kullanıcıya zaten swipe yaptın');
    }

    // Swipe kaydını oluştur
    const { data: swipe, error } = await this.supabase
      .from('swipes')
      .insert({
        swiper_id: swiperId,
        swiped_id: swipedId,
        action,
        house_id: houseId,
      })
      .select()
      .single();

    if (error) {
      // Duplicate key hatası (23505 = PostgreSQL unique constraint violation)
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        throw new BadRequestException('Bu kullanıcıya zaten swipe yaptın');
      }
      throw new Error(`Swipe kaydedilemedi: ${error.message}`);
    }

    // Eşleşme oldu mu kontrol et (trigger otomatik yapıyor ama biz de kontrol edelim)
    if (action === 'like' || action === 'superlike') {
      const { data: match } = await this.supabase
        .from('matches')
        .select('*')
        .or(
          `and(user1_id.eq.${swiperId},user2_id.eq.${swipedId}),and(user1_id.eq.${swipedId},user2_id.eq.${swiperId})`,
        )
        .single();

      return {
        swipe,
        isMatch: !!match,
        match: match || null,
      };
    }

    return {
      swipe,
      isMatch: false,
      match: null,
    };
  }

  // 3. KULLANICININ EŞLEŞMELERİNİ LİSTELE
  async getUserMatches(userId: string) {
    const { data: matches, error } = await this.supabase
      .from('matches')
      .select(
        `
        *,
        user1:user1_id(id, full_name, avatar_url, bio, occupation, university),
        user2:user2_id(id, full_name, avatar_url, bio, occupation, university)
      `,
      )
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Eşleşmeler çekilemedi: ${error.message}`);
    }

    // Karşı tarafı belirle (user1 bensem user2'yi göster, değilse user1'i göster)
    const formattedMatches = matches?.map((match: any) => {
      const isUser1 = match.user1_id === userId;
      const otherUser = isUser1 ? match.user2 : match.user1;

      return {
        matchId: match.id,
        createdAt: match.created_at,
        houseId: match.house_id,
        user: otherUser,
      };
    });

    return formattedMatches || [];
  }

  // 4. TEK BİR EŞLEŞMENİN DETAYINI AL
  async getMatchById(matchId: string, userId: string) {
    const { data: match, error } = await this.supabase
      .from('matches')
      .select(
        `
        *,
        user1:user1_id(id, full_name, avatar_url, bio, birth_date, gender, occupation, university, department),
        user2:user2_id(id, full_name, avatar_url, bio, birth_date, gender, occupation, university, department)
      `,
      )
      .eq('id', matchId)
      .single();

    if (error || !match) {
      throw new NotFoundException('Eşleşme bulunamadı');
    }

    // Kullanıcı bu eşleşmenin bir parçası mı?
    if (match.user1_id !== userId && match.user2_id !== userId) {
      throw new BadRequestException('Bu eşleşmeye erişim yetkiniz yok');
    }

    // Karşı tarafın ID'sini belirle
    const isUser1 = match.user1_id === userId;
    const otherUserId = isUser1 ? match.user2_id : match.user1_id;
    const otherUser = isUser1 ? match.user2 : match.user1;

    // ID null check (TypeScript için)
    if (!otherUserId) {
      throw new NotFoundException('Eşleşme verisi eksik');
    }

    // Karşı tarafın tercihlerini de çek
    const { data: otherUserPrefs } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', otherUserId)
      .single();

    return {
      matchId: match.id,
      createdAt: match.created_at,
      houseId: match.house_id,
      isActive: match.is_active,
      user: otherUser,
      preferences: otherUserPrefs,
    };
  }

  // 5. YARDIMCI FONKSİYON: Weighted Euclidean Distance
  private calculateWeightedEuclidean(
    userA: UserPreference,
    userB: UserPreference,
  ): number {
    let totalWeightedDiff = 0;
    let maxPossibleWeightedDiff = 0;

    for (const key of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
      const weight = WEIGHTS[key];

      // Enum'ı Sayıya Çevir (Constants dosyasındaki haritayı kullanır)
      const valA = this.getNumericValue(key, userA[key] as string);
      const valB = this.getNumericValue(key, userB[key] as string);

      // Veri eksikse hesaplamaya katma
      if (valA === null || valB === null) continue;

      // Öklid Farkı: (A - B)^2 * Ağırlık
      const diff = Math.pow(valA - valB, 2);
      totalWeightedDiff += diff * weight;

      // Normalizasyon için max farkı hesapla (maksimum fark 1 olabilir: 1.0 - 0.0 = 1)
      maxPossibleWeightedDiff += Math.pow(1, 2) * weight;
    }

    const euclideanDistance = Math.sqrt(totalWeightedDiff);
    const maxDistance = Math.sqrt(maxPossibleWeightedDiff);

    if (maxDistance === 0) return 100;

    // Mesafeyi Benzerlik Yüzdesine Çevir
    const similarity = 1 - euclideanDistance / maxDistance;
    return Math.round(similarity * 100);
  }

  // 6. String Enum -> Number dönüşümü
  private getNumericValue(category: string, value: string): number | null {
    // Kategori var mı? (örn: smoking)
    if (!PREFERENCE_MAP[category]) return null;
    // Değer var mı? (örn: no_smoke)
    if (PREFERENCE_MAP[category][value] === undefined) return null;

    return PREFERENCE_MAP[category][value];
  }
}
