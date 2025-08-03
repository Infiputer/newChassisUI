import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Model, Conversation, Message, AuthResponse, ModelUsage, ConversationResponse } from '../types';

class ApiService {
  public api: AxiosInstance;

  public cache: {
    models?: Model[];
    trendingModels?: ModelUsage[];
    recentModels?: ModelUsage[];
    recommendations?: ModelUsage[];
    modelDetails: { [modelId: string]: Model };
    userModels?: Model[];
  } = {
      modelDetails: {}
    };

  private modelsPromise: Promise<Model[]> | null = null;
  private trendingModelsPromise: Promise<ModelUsage[]> | null = null;
  private recentModelsPromise: Promise<ModelUsage[]> | null = null;
  private recommendationsPromise: Promise<ModelUsage[]> | null = null;
  private modelPromises: { [modelId: string]: Promise<Model> } = {};
  private userModelsPromise: Promise<Model[]> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log('[api.ts] Request:', config.method, config.url, config.data);
      return config;
    });

    this.api.interceptors.response.use(
      (response) => {
        console.log('[api.ts] Response:', response.config.url, response.status, response.data);
        return response;
      },
      async (error) => {
        console.error('[api.ts] Error response:', error.config?.url, error.response?.status, error.response?.data);
        if (error.response?.status === 401) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const response = await axios.post('/api/auth/refresh', {
                refreshToken,
              });
              const { accessToken } = response.data;
              localStorage.setItem('accessToken', accessToken);
              error.config.headers.Authorization = `Bearer ${accessToken}`;
              return this.api.request(error.config);
            } catch (refreshError) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    console.log('[api.ts] register called', { email, name });
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/register', {
      email,
      password,
      name,
    });
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    console.log('[api.ts] login called', { email });
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout(): Promise<void> {
    console.log('[api.ts] logout called');
    await this.api.post('/auth/logout', {
      refreshToken: localStorage.getItem('refreshToken'),
    });
  }

  // Conversation endpoints
  async getConversations(): Promise<Conversation[]> {
    console.log('[api.ts] getConversations called');
    const response: AxiosResponse<Conversation[]> = await this.api.get('/conversations');
    return response.data;
  }

  async createConversation(modelId: string, title?: string): Promise<Conversation> {
    console.log('[api.ts] createConversation called', { modelId, title });
    const response: AxiosResponse<Conversation> = await this.api.post('/conversations', {
      model_id: modelId,
      title,
    });
    return response.data;
  }

  async getConversation(conversationId: string): Promise<ConversationResponse> {
    console.log('[api.ts] getConversation called', { conversationId });
    const response: AxiosResponse<ConversationResponse> = await this.api.get(
      `/conversations/${conversationId}`
    );
    return response.data;
  }

  async addMessage(conversationId: string, content: string, role: 'user' | 'assistant', parentMessageId?: string): Promise<Message> {
    console.log('[api.ts] addMessage called', { conversationId, content, role, parentMessageId });
    const response: AxiosResponse<Message> = await this.api.post(`/conversations/${conversationId}/messages`, {
      content,
      role,
      parent_message_id: parentMessageId,
    });
    return response.data;
  }

  async editMessage(conversationId: string, messageId: string, content: string, role: 'user' | 'assistant'): Promise<{ edited_message: Message; model_response: Message }> {
    console.log('[api.ts] editMessage called', { conversationId, messageId, content, role });
    const response: AxiosResponse<{ edited_message: Message; model_response: Message }> = await this.api.post(`/conversations/${conversationId}/messages/${messageId}/edit`, {
      content,
      role,
    });
    return response.data;
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    const response: AxiosResponse<Conversation> = await this.api.patch(`/conversations/${conversationId}`, {
      title,
    });
    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.api.delete(`/conversations/${conversationId}`);
  }

  async setCurrentBranch(conversationId: string, messageId: string): Promise<{ success: boolean; current_leaf_message_id: string }> {
    const response: AxiosResponse<{ success: boolean; current_leaf_message_id: string }> = await this.api.post(`/conversations/${conversationId}/branch`, {
      message_id: messageId,
    });
    return response.data;
  }

  // // Model endpoints with fixed caching
  // async getModels(): Promise<Model[]> {
  //   // console.log('[getModels] Checking cache...');
  //   // if (this.cache.models) {
  //   //   console.log('[getModels] Cache hit');
  //   //   return this.cache.models;
  //   // }

  //   // if (this.modelsPromise) {
  //   //   console.log('[getModels] Waiting for existing request...');
  //   //   return this.modelsPromise;
  //   // }

  //   // console.log('[getModels] Cache miss, fetching from API...');
  //   // this.modelsPromise = this.api.get('/models')
  //   //   .then((response: AxiosResponse<Model[]>) => {
  //   //     console.log('[getModels] API response received');
  //   //     this.cache.models = response.data;
  //   //     return response.data;
  //   //   })
  //   //   .catch((error) => {
  //   //     console.error('[getModels] API error:', error);
  //   //     throw error;
  //   //   })
  //   //   .finally(() => {
  //   //     this.modelsPromise = null;
  //   //   });

  //   // return this.modelsPromise;
  // }

  async getTrendingModels(): Promise<ModelUsage[]> {
    console.log('[getTrendingModels] Checking cache...');
    if (this.cache.trendingModels) {
      console.log('[getTrendingModels] Cache hit');
      return this.cache.trendingModels;
    }

    if (this.trendingModelsPromise) {
      console.log('[getTrendingModels] Waiting for existing request...');
      return this.trendingModelsPromise;
    }

    console.log('[getTrendingModels] Cache miss, fetching from API...');
    this.trendingModelsPromise = this.api.get('/models/trending')
      .then((response: AxiosResponse<ModelUsage[]>) => {
        console.log('[getTrendingModels] API response received');
        this.cache.trendingModels = response.data;
        return response.data;
      })
      .catch((error) => {
        console.error('[getTrendingModels] API error:', error);
        throw error;
      })
      .finally(() => {
        this.trendingModelsPromise = null;
      });

    return this.trendingModelsPromise;
  }

  async getRecentModels(): Promise<ModelUsage[]> {
    console.log('[getRecentModels] Checking cache...');
    if (this.cache.recentModels) {
      console.log('[getRecentModels] Cache hit');
      return this.cache.recentModels;
    }

    if (this.recentModelsPromise) {
      console.log('[getRecentModels] Waiting for existing request...');
      return this.recentModelsPromise;
    }

    console.log('[getRecentModels] Cache miss, fetching from API...');
    this.recentModelsPromise = this.api.get('/models/recent')
      .then((response: AxiosResponse<ModelUsage[]>) => {
        console.log('[getRecentModels] API response received');
        this.cache.recentModels = response.data;
        return response.data;
      })
      .catch((error) => {
        console.error('[getRecentModels] API error:', error);
        throw error;
      })
      .finally(() => {
        this.recentModelsPromise = null;
      });

    return this.recentModelsPromise;
  }

  async getModelRecommendations(): Promise<ModelUsage[]> {
    console.log('[getModelRecommendations] Checking cache...');
    if (this.cache.recommendations) {
      console.log('[getModelRecommendations] Cache hit');
      return this.cache.recommendations;
    }

    if (this.recommendationsPromise) {
      console.log('[getModelRecommendations] Waiting for existing request...');
      return this.recommendationsPromise;
    }

    console.log('[getModelRecommendations] Cache miss, fetching from API...');
    this.recommendationsPromise = this.api.get('/models/recommendations')
      .then((response: AxiosResponse<ModelUsage[]>) => {
        console.log('[getModelRecommendations] API response received');
        this.cache.recommendations = response.data;
        return response.data;
      })
      .catch((error) => {
        console.error('[getModelRecommendations] API error:', error);
        throw error;
      })
      .finally(() => {
        this.recommendationsPromise = null;
      });

    return this.recommendationsPromise;
  }

  async getModel(modelId: string): Promise<Model> {
    console.log(`[getModel] Checking cache for modelId: ${modelId}...`);
    if (this.cache.modelDetails[modelId]) {
      console.log(`[getModel] Cache hit for modelId: ${modelId}`);
      return this.cache.modelDetails[modelId];
    }

    if (modelId in this.modelPromises) {
      console.log(`[getModel] Waiting for existing request for modelId: ${modelId}...`);
      return this.modelPromises[modelId];
    }

    console.log(`[getModel] Cache miss for modelId: ${modelId}, fetching from API...`);
    this.modelPromises[modelId] = this.api.get(`/models/${modelId}`)
      .then((response: AxiosResponse<Model>) => {
        console.log(`[getModel] API response received for modelId: ${modelId}`);
        this.cache.modelDetails[modelId] = response.data;
        return response.data;
      })
      .catch((error) => {
        console.error(`[getModel] API error for modelId: ${modelId}:`, error);
        throw error;
      })
      .finally(() => {
        delete this.modelPromises[modelId];
      });

    return this.modelPromises[modelId];
  }

  async trackModelUsage(modelId: string, usageType: string, conversationId?: string, tokensUsed?: number, sessionDuration?: number): Promise<void> {
    await this.api.post(`/models/${modelId}/usage`, {
      usage_type: usageType,
      conversation_id: conversationId,
      tokens_used: tokensUsed,
      session_duration: sessionDuration,
    });
  }

  // Model creation and management
  async createModel(modelData: {
    name: string;
    description?: string;
    short_description?: string;
    long_description?: string;
    endpoints: Array<{ url: string; weight: number }>;
  }): Promise<Model> {
    const response: AxiosResponse<Model> = await this.api.post('/models', modelData);
    return response.data;
  }

  async updateModel(modelId: string, modelData: {
    name: string;
    description?: string;
    short_description?: string;
    long_description?: string;
    endpoints: Array<{ url: string; weight: number }>;
  }): Promise<Model> {
    const response: AxiosResponse<Model> = await this.api.put(`/models/${modelId}`, modelData);
    return response.data;
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.api.delete(`/models/${modelId}`);
  }

  async getUserModels(): Promise<Model[]> {
    console.log('[getUserModels] Checking cache...');
    if (this.cache.userModels) {
      console.log('[getUserModels] Cache hit');
      return this.cache.userModels;
    }

    if (this.userModelsPromise) {
      console.log('[getUserModels] Waiting for existing request...');
      return this.userModelsPromise;
    }

    console.log('[getUserModels] Cache miss, fetching from API...');
    this.userModelsPromise = this.api.get('/models')
      .then((response: AxiosResponse<Model[]>) => {
        console.log('[getUserModels] API response received');
        const userModels = response.data.filter(model => model.owner_user_id);
        this.cache.userModels = userModels;
        return userModels;
      })
      .catch((error) => {
        console.error('[getUserModels] API error:', error);
        throw error;
      })
      .finally(() => {
        this.userModelsPromise = null;
      });

    return this.userModelsPromise;
  }

  async startStreaming(conversationId: string, modelId: string, messageContent: string): Promise<void> {
    console.log('[api.ts] startStreaming called', { conversationId, modelId, messageContent });
    await this.api.post(`/stream/${conversationId}`, {
      modelId,
      messageContent,
    });
  }
}

export const apiService = new ApiService();