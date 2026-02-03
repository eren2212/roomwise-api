import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { ProfileModule } from './profile/profile.module';
import { IdentityModule } from './identity/identity.module';
import { MatchingModule } from './matching/matching.module';
import { HouseModule } from './house/house.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    SupabaseModule,
    ProfileModule,
    IdentityModule,
    MatchingModule,
    HouseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
