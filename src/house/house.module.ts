import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';

@Module({
  imports: [ConfigModule],
  controllers: [HouseController],
  providers: [HouseService],
  exports: [HouseService],
})
export class HouseModule {}
