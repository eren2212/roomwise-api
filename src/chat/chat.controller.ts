import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SupabaseGuard } from '../auth/supabase.guard';
import type { RequestWithUser } from '../auth/supabase.guard';
import { CreateMessageDto } from './dto';

@Controller('chat')
@UseGuards(SupabaseGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Mesaj gönder
   * POST /chat/send
   */
  @Post('send')
  async sendMessage(
    @Request() req: RequestWithUser,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const userId = req.user!.id;
    const message = await this.chatService.sendMessage(
      userId,
      createMessageDto,
    );

    return {
      success: true,
      message: 'Mesaj başarıyla gönderildi',
      data: message,
    };
  }

  /**
   * Kullanıcının konuşmalarını getir
   * GET /chat/conversations
   */
  @Get('conversations')
  async getConversations(@Request() req: RequestWithUser) {
    const userId = req.user!.id;
    const conversations = await this.chatService.getConversations(userId);

    return {
      success: true,
      data: conversations,
    };
  }

  /**
   * Konuşmanın mesajlarını getir
   * GET /chat/messages/:conversationId
   */
  @Get('messages/:conversationId')
  async getMessages(
    @Request() req: RequestWithUser,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user!.id;
    const messages = await this.chatService.getMessages(
      userId,
      conversationId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );

    return {
      success: true,
      data: messages,
    };
  }

  /**
   * Konuşmayı okundu olarak işaretle
   * PATCH /chat/read/:conversationId
   */
  @Patch('read/:conversationId')
  async markAsRead(
    @Request() req: RequestWithUser,
    @Param('conversationId') conversationId: string,
  ) {
    const userId = req.user!.id;
    await this.chatService.markAsRead(userId, conversationId);

    return {
      success: true,
      message: 'Konuşma okundu olarak işaretlendi',
    };
  }

  /**
   * Yeni direkt konuşma oluştur
   * POST /chat/conversations/direct
   */
  @Post('conversations/direct')
  async createDirectConversation(
    @Request() req: RequestWithUser,
    @Body('targetUserId') targetUserId: string,
  ) {
    const userId = req.user!.id;
    const conversation = await this.chatService.createDirectConversation(
      userId,
      targetUserId,
    );

    return {
      success: true,
      message: 'Konuşma oluşturuldu',
      data: conversation,
    };
  }
}
