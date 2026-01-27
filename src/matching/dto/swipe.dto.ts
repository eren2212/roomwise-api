import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Database } from 'src/database.types';

export class SwipeDto {
  @IsUUID()
  @IsNotEmpty()
  swipedUserId: string;

  @IsEnum(['like', 'dislike', 'superlike'])
  @IsNotEmpty()
  action: Database['public']['Enums']['swipe_action'];

  @IsUUID()
  @IsOptional()
  houseId?: string;
}
