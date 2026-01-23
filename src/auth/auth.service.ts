import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LoginDto, RegisterDto } from './dto/login.dto';
import { Database } from 'src/database.types';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient<Database>;
  private supabaseAdmin: SupabaseClient<Database>;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE')!,
    );

    this.supabaseAdmin = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE')!,
    );
  }

  async kayitOl(body: RegisterDto) {
    return this.supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });
  }

  async girisYap(body: LoginDto) {
    return this.supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
  }

  async cikisYap(token: string) {
    // TypeScript artık supabaseAdmin'i tanıdığı için buradaki hatalar gidecek
    const { error } = await this.supabaseAdmin.auth.admin.signOut(token);

    if (error) {
      return { durum: 'Hata', mesaj: error.message };
    }

    return { durum: 'Başarılı', mesaj: 'Oturum sunucudan güvenle kapatıldı.' };
  }
}
