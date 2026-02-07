/**
 * Ev isteği entity'si
 * house_requests tablosunu temsil eder
 */
export interface HouseRequest {
  id: string;
  house_id: string;
  user_id: string;
  status: 'pending' | 'verified' | 'rejected';
  message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Kullanıcı profil bilgileri ile zenginleştirilmiş istek
 */
export interface HouseRequestWithProfile extends HouseRequest {
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    birth_date: string | null;
    gender: string | null;
    occupation: string | null;
    verification_status: string;
  };
}

/**
 * Ev bilgileri ile zenginleştirilmiş istek
 */
export interface HouseRequestWithHouse extends HouseRequest {
  houses: {
    id: string;
    title: string;
    owner_id: string;
  };
}
