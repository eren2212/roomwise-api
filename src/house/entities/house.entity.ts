export interface House {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  rent_amount: number;
  currency: string | null;
  deposit_amount: number | null;
  rules: string[] | null;
  max_occupancy: number | null;
  is_active: boolean | null;
  location: unknown | null;
  created_at: string | null;
  photos: string[] | null;
  amenities: string[] | null;
  gender_preference:
    | 'male'
    | 'female'
    | 'non_binary'
    | 'prefer_not_to_say'
    | null;
}
