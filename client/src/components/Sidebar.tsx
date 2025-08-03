import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Conversation, Model, ModelUsage } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, MessageSquare, TrendingUp, Clock, Star, LogOut, User, Settings } from 'lucide-react';
import ModelCreationForm from './ModelCreationForm';
import { ThemeToggle } from '../App';

const Sidebar: React.FC = React.memo(() => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [models, setModels] = useState<Model[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [trendingModels, setTrendingModels] = useState<ModelUsage[]>([]);
  const [recentModels, setRecentModels] = useState<ModelUsage[]>([]);
  const [recommendations, setRecommendations] = useState<ModelUsage[]>([]);
  const [userModels, setUserModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversations' | 'models'>('conversations');
  const [showCreateModel, setShowCreateModel] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [modelsTabJustActivated, setModelsTabJustActivated] = useState(false);

  // Memoized loadData function
  const loadData = useCallback(async () => {
    try {
      const [
        conversationsData,
        // modelsData, 
        trendingData,
        recentData,
        recommendationsData,
        userModelsData] = await Promise.all([
          apiService.getConversations(),
          // apiService.getModels(),
          apiService.getTrendingModels(),
          apiService.getRecentModels(),
          apiService.getModelRecommendations(),
          apiService.getUserModels(),
        ]);

      setConversations(conversationsData);
      // setModels(modelsData);
      setTrendingModels(trendingData);
      setRecentModels(recentData);
      setRecommendations(recommendationsData);
      setUserModels(userModelsData);
    } catch (error) {
      console.error('Error loading sidebar data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized handleNewChat function
  const handleNewChat = useCallback(async (modelId: string) => {
    try {
      const conversation = await apiService.createConversation(modelId);
      navigate(`/chat/${conversation.conversation_id}`);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [navigate]);

  // Memoized handleLogout function
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, navigate]);

  // Memoized handleModelCreated function
  const handleModelCreated = useCallback(() => {
    setShowCreateModel(false);
    loadData(); // Reload all data to include the new model
  }, [loadData]);

  // Memoized formatDate function
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  // Memoized tab toggle function
  const toggleTab = useCallback(() => {
    setActiveTab(prev => prev === 'conversations' ? 'models' : 'conversations');
  }, []);

  // Memoized show models tab function
  const showModelsTab = useCallback(() => {
    setActiveTab('models');
    setModelsTabJustActivated(true);
    setTimeout(() => setModelsTabJustActivated(false), 2200); // match animation duration
  }, []);

  // Memoized show create model function
  const showCreateModelForm = useCallback(() => {
    setShowCreateModel(true);
  }, []);

  // Memoized conversations list
  const conversationsList = useMemo(() => {
    if (conversations.length === 0) {
      return (
        <p className="text-sm text-gray-500 text-center py-4">
          No conversations yet. Start a new chat!
        </p>
      );
    }

    return conversations.map((conversation) => (
      <Link
        key={conversation.conversation_id}
        to={`/chat/${conversation.conversation_id}`}
        className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
              {conversation.title}
            </p>
            <p className="text-xs text-gray-500">
              {conversation.model_name} • {formatDate(conversation.updated_at)}
            </p>
          </div>
        </div>
      </Link>
    ));
  }, [conversations, formatDate]);

  // Memoized user models list
  const userModelsList = useMemo(() => {
    if (userModels.length === 0) {
      return (
        <p className="text-xs text-gray-500 text-center py-2">
          No custom models yet
        </p>
      );
    }

    return userModels.map((model) => (
      <button
        key={model.model_id}
        onClick={() => handleNewChat(model.model_id)}
        className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <p className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</p>
        <p className="text-xs text-gray-500">{model.short_description}</p>
        <p className="text-xs text-primary-600 mt-1">
          {model.endpoints?.length || 0} endpoints
        </p>
      </button>
    ));
  }, [userModels, handleNewChat]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="sidebar w-80 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar w-80 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white"><a href="/">ChassisUI</a></h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTab}
              className={`btn-secondary text-sm`}
            >
              {activeTab === 'conversations' ? 'Models' : 'Chats'}
            </button>
            <ThemeToggle />
          </div>
        </div>

        <button
          onClick={showModelsTab}
          className="btn-primary w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </button>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/models"
              className="text-gray-400 hover:text-gray-600"
              title="Manage Models"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conversations' ? (
          <div className="p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3 dark:text-white">Recent Conversations</h2>
            <div className="space-y-2">
              {conversationsList}
            </div>
          </div>
        ) : (
          <div className={`p-4 space-y-6${modelsTabJustActivated ? ' heartbeat-breath' : ''}`}>
            {/* My Models */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 dark:text-white">
                  <Settings className="w-4 h-4" />
                  My Models
                </h2>
                <button
                  onClick={showCreateModelForm}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create
                </button>
              </div>
              <div className="space-y-2">
                {userModelsList}
              </div>
            </div>

            {/* Trending Models */}
            <div>
              <h2 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2 dark:text-white">
                <TrendingUp className="w-4 h-4" />
                Trending Models
              </h2>
              <div className="space-y-2">
                {trendingModels.map((model) => (
                  <button
                    key={model.model_id}
                    onClick={() => handleNewChat(model.model_id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.short_description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {model.usage_count} conversations this week
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Models */}
            <div>
              <h2 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2 dark:text-white">
                <Clock className="w-4 h-4" />
                Recently Used
              </h2>
              <div className="space-y-2">
                {recentModels.map((model) => (
                  <button
                    key={model.model_id}
                    onClick={() => handleNewChat(model.model_id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.short_description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h2 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2 dark:text-white">
                <Star className="w-4 h-4" />
                Recommended for You
              </h2>
              <div className="space-y-2">
                {recommendations.map((model) => (
                  <button
                    key={model.model_id}
                    onClick={() => handleNewChat(model.model_id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.short_description}</p>
                    {!model.used_by_user && (
                      <p className="text-xs text-primary-600 mt-1">New to you</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Model Creation Form */}
      {showCreateModel && (
        <ModelCreationForm
          onClose={() => setShowCreateModel(false)}
          onSuccess={handleModelCreated}
        />
      )}
    </div>
  );
});

export default Sidebar; 