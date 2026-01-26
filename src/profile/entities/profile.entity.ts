import { Database } from '../../database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

// Eğer özel tip dönüşümü gerekiyorsa:
export interface ProfileWithRelations extends Profile {
  // İleride ilişkili veriler eklenebilir
  // preferences?: UserPreferences;
}
