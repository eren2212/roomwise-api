import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../database.types'; // Veritabanı tiplerini buradan çekiyoruz

const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

@Global() // Bu modülü global yaptık, her yerde tekrar import etmene gerek yok
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        // process.env kontrolü yapıyoruz ki undefined hatası almayalım
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase URL veya Key .env dosyasında bulunamadı!');
        }

        return createClient<Database>(supabaseUrl, supabaseKey);
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
