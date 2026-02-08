import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * Grup konuşması oluşturma DTO
 */
export class CreateGroupConversationDto {
  @IsUUID()
  @IsNotEmpty()
  houseId: string;
}
