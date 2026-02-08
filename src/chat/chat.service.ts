import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateMessageDto } from './dto';
import type {
  Message,
  ConversationWithParticipants,
  MessageWithSender,
} from './entities';

@Injectable()
export class ChatService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_KEY')!,
    );
  }

  /**
   * Mesaj gönder
   */
  async sendMessage(
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    const { conversationId, content, type } = createMessageDto;

    // Konuşmayı ve katılımcı kontrolü
    const { data: participant, error: participantError } = await this.supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      throw new ForbiddenException('Bu konuşmaya mesaj gönderme yetkiniz yok');
    }

    // Mesajı ekle
    const { data: message, error: messageError } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: content || null,
        message_type: type || 'text',
      })
      .select()
      .single();

    if (messageError) {
      throw new BadRequestException(
        `Mesaj gönderilemedi: ${messageError.message}`,
      );
    }

    // Konuşmanın son mesaj bilgilerini güncelle
    const { error: updateError } = await this.supabase
      .from('conversations')
      .update({
        last_message_content: content || `[${type}]`,
        last_message_at: new Date().toISOString(),
        last_message_sender_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Konuşma güncellenemedi:', updateError.message);
    }

    return message as Message;
  }

  /**
   * Kullanıcının konuşmalarını getir
   */
  async getConversations(
    userId: string,
  ): Promise<ConversationWithParticipants[]> {
    // Kullanıcının katıldığı konuşma ID'lerini bul
    const { data: participantData, error: participantError } =
      await this.supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

    if (participantError) {
      throw new BadRequestException(
        `Konuşmalar getirilemedi: ${participantError.message}`,
      );
    }

    if (!participantData || participantData.length === 0) {
      return [];
    }

    const conversationIds = participantData.map((p) => p.conversation_id);

    // Konuşmaları katılımcı profilleri ile getir
    const { data: conversations, error: conversationsError } =
      await this.supabase
        .from('conversations')
        .select(
          `
        *,
        conversation_participants (
          id,
          user_id,
          last_read_at,
          joined_at,
          profiles (
            id,
            full_name,
            avatar_url
          )
        )
      `,
        )
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

    if (conversationsError) {
      throw new BadRequestException(
        `Konuşmalar getirilemedi: ${conversationsError.message}`,
      );
    }

    return (conversations || []) as ConversationWithParticipants[];
  }

  /**
   * Konuşmanın mesajlarını getir
   */
  async getMessages(
    userId: string,
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<MessageWithSender[]> {
    // Katılımcı kontrolü
    const { data: participant, error: participantError } = await this.supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      throw new ForbiddenException('Bu konuşmayı görme yetkiniz yok');
    }

    // Mesajları getir
    const { data: messages, error: messagesError } = await this.supabase
      .from('messages')
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `,
      )
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      throw new BadRequestException(
        `Mesajlar getirilemedi: ${messagesError.message}`,
      );
    }

    return (messages || []) as MessageWithSender[];
  }

  /**
   * Konuşmayı okundu olarak işaretle
   */
  async markAsRead(userId: string, conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(`İşaretlenemedi: ${error.message}`);
    }
  }

  /**
   * Yeni konuşma oluştur (direct mesaj için)
   */
  async createDirectConversation(
    userId: string,
    targetUserId: string,
  ): Promise<ConversationWithParticipants> {
    // Var olan direkt konuşma kontrolü
    const { data: existingParticipants } = await this.supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (existingParticipants && existingParticipants.length > 0) {
      const conversationIds = existingParticipants.map(
        (p) => p.conversation_id,
      );

      const { data: targetParticipant } = await this.supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', conversationIds);

      if (targetParticipant && targetParticipant.length > 0) {
        // Direkt konuşmayı bul
        const { data: existingConversation } = await this.supabase
          .from('conversations')
          .select(
            `
            *,
            conversation_participants (
              id,
              user_id,
              last_read_at,
              joined_at,
              profiles (
                id,
                full_name,
                avatar_url
              )
            )
          `,
          )
          .eq('id', targetParticipant[0].conversation_id)
          .eq('type', 'direct')
          .single();

        if (existingConversation) {
          return existingConversation as ConversationWithParticipants;
        }
      }
    }

    // Yeni konuşma oluştur
    const { data: conversation, error: conversationError } = await this.supabase
      .from('conversations')
      .insert({
        type: 'direct',
      })
      .select()
      .single();

    if (conversationError) {
      throw new BadRequestException(
        `Konuşma oluşturulamadı: ${conversationError.message}`,
      );
    }

    // Katılımcıları ekle
    const { error: participantsError } = await this.supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: conversation.id, user_id: userId },
        { conversation_id: conversation.id, user_id: targetUserId },
      ]);

    if (participantsError) {
      // Konuşmayı sil (rollback)
      await this.supabase
        .from('conversations')
        .delete()
        .eq('id', conversation.id);
      throw new BadRequestException(
        `Katılımcılar eklenemedi: ${participantsError.message}`,
      );
    }

    // Katılımcılarla birlikte getir
    const { data: fullConversation, error: fetchError } = await this.supabase
      .from('conversations')
      .select(
        `
        *,
        conversation_participants (
          id,
          user_id,
          last_read_at,
          joined_at,
          profiles (
            id,
            full_name,
            avatar_url
          )
        )
      `,
      )
      .eq('id', conversation.id)
      .single();

    if (fetchError) {
      throw new BadRequestException(
        `Konuşma getirilemedi: ${fetchError.message}`,
      );
    }

    return fullConversation as ConversationWithParticipants;
  }
}
