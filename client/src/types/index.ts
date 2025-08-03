export interface User {
  user_id: string;
  email: string;
  name: string;
  user_role?: string;
}

export interface ModelEndpoint {
  id: string;
  url: string;
  weight: number;
  is_active: boolean;
}

export interface Model {
  model_id: string;
  name: string;
  description: string;
  short_description: string;
  long_description: string;
  created_at: string;
  owner_user_id?: string;
  endpoints?: ModelEndpoint[];
}

export interface Conversation {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  current_leaf_message_id: string | null;
  model_name: string;
  model_id: string;
}

export interface Message {
  message_id: string;
  parent_message_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  order_index: number;
  children?: Message[];
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: Message[];
  allMessages: Message[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface StreamingMessage {
  type: 'token' | 'error' | 'resume';
  content?: string;
  isComplete?: boolean;
  message?: string;
}

export interface ModelUsage {
  model_id: string;
  name: string;
  description: string;
  short_description: string;
  usage_count?: number;
  last_used?: string;
  used_by_user?: boolean;
} 