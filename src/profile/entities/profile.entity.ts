export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  gender: string | null;
  occupation: string | null;
  trust_score: number | null;
  is_verified: boolean | null;
  verification_status: string | null;
  location: unknown | null;
  created_at: string | null;
  updated_at: string | null;
  has_seen_onboarding: boolean | null;
  occupation_status: string | null;
  university: string | null;
  department: string | null;
}
