import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule], // Supabase client'ı kullanabilmek için
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService], // Başka modüllerde kullanılabilir
})
export class IdentityModule {}
