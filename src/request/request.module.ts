import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';

@Module({
  imports: [ConfigModule],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
