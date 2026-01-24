import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'; // User tipini ekledik
import { Database } from 'src/database.types';
import { Request } from 'express'; // Express'in Request tipini çağırdık
import { IS_PUBLIC_KEY } from './public.decorator';

// TypeScript'e "Bizim Request nesnemizin içinde kesinlikle 'user' olacak" diyoruz.
export interface RequestWithUser extends Request {
  user?: User;
}

@Injectable()
export class SupabaseGuard implements CanActivate {
  private supabase: SupabaseClient<Database>;

  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE')!,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public endpoint kontrolü
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // BURASI ÖNEMLİ: getRequest'in sonucunu 'RequestWithUser' olarak zorluyoruz (Casting)
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Kanka token göndermeyi unuttun!');
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException(
          'Bu token geçersiz veya süresi dolmuş!',
        );
      }

      // Artık TypeScript 'request.user' alanını tanıyor, kızmıyor.
      request.user = user;
      return true;
    } catch {
      // (error) kısmını sildik çünkü kullanmıyoruz, ESLint artık kızmaz.
      throw new UnauthorizedException();
    }
  }

  // Buraya gelen parametrenin tipini 'Request' olarak belirttik.
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
