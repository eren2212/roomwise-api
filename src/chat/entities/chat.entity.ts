/**
 * Konuşma türü
 */
export type ConversationType = 'direct' | 'group';

/**
 * Mesaj türü
 */
export type MessageTypeDb = 'text' | 'image' | 'location' | 'system';

/**
 * Mesaj entity
 */
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: MessageTypeDb;
  created_at: string;
}

/**
 * Konuşma entity
 */
export interface Conversation {
  id: string;
  type: ConversationType;
  house_id: string | null;
  match_id: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Konuşma katılımcısı entity
 */
export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  joined_at: string;
}

/**
 * Profil bilgisi ile konuşma katılımcısı
 */
export interface ParticipantWithProfile extends ConversationParticipant {
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

/**
 * Katılımcılar ile konuşma
 */
export interface ConversationWithParticipants extends Conversation {
  conversation_participants: ParticipantWithProfile[];
}

/**
 * Gönderen bilgisi ile mesaj
 */
export interface MessageWithSender extends Message {
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}
