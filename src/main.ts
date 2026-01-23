import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Sadece DTO'da tanımlı alanları kabul et
      forbidNonWhitelisted: true, // Ekstra alanlar gelirse hata ver
      transform: true, // Otomatik tip dönüşümü
    }),
  );

  // CORS
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
