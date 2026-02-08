import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  LOCATION = 'location',
  SYSTEM = 'system',
}

/**
 * Mesaj gönderme DTO
 */
export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Konuşma ID zorunludur' })
  conversationId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;
}
