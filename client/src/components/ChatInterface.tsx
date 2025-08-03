import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Message, Conversation, Model, ModelUsage } from '../types';
import { apiService } from '../services/api';
import { websocketService } from '../services/websocket';
import { StreamingMessage } from '../types';
import { Send, Plus, TrendingUp, Clock, Star, Settings } from 'lucide-react';
import MessageItem from './MessageItem';
import './prismimports.js';
import MarkdownRenderer from './MarkdownRenderer';
import Prism from 'prismjs';

const ChatInterface: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Map<string, number>>(new Map());
  const streamingRef = useRef<HTMLDivElement>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [trendingModels, setTrendingModels] = useState<ModelUsage[]>([]);
  const [recentModels, setRecentModels] = useState<ModelUsage[]>([]);
  const [recommendations, setRecommendations] = useState<ModelUsage[]>([]);
  const [userModels, setUserModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const pendingBranchSwitchRef = useRef<{ editedMessageId: string, parentAssistantId: string } | null>(null);
  const inputDivRef = useRef<HTMLDivElement>(null);

  // Memoize the branches map to avoid recalculating on every render
  const branchesMap = useMemo(() => {
    const map = new Map<string, Message[]>();

    allMessages.forEach(msg => {
      if (msg.role === 'user') {
        const key = `${msg.parent_message_id || 'root'}-${msg.order_index}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(msg);
      }
    });

    // Sort each branch array by creation time
    map.forEach(branches => {
      branches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return map;
  }, [allMessages]);

  // Memoized getMessageBranches function
  const getMessageBranches = useCallback((message: Message): Message[] => {
    const key = `${message.parent_message_id || 'root'}-${message.order_index}`;
    const branches = branchesMap.get(key) || [];
    return branches;
  }, [branchesMap]);

  // Memoized getBranchIndex function
  const getBranchIndex = useCallback((messageId: string): number => {
    return selectedBranch.get(messageId) || 0;
  }, [selectedBranch]);

  // Memoized setBranchIndex function
  const setBranchIndex = useCallback(async (messageId: string, index: number) => {
    setSelectedBranch(prev => {
      const newMap = new Map(prev);
      newMap.set(messageId, index);
      return newMap;
    });

    // Update the backend with the new branch selection
    if (conversationId) {
      try {
        // Find the message at the selected branch index
        const parentMessage = findMessageById(messages, messageId);
        if (parentMessage && parentMessage.children) {
          const userBranches = parentMessage.children.filter((child: Message) => child.role === 'user');
          const selectedBranchMessage = userBranches[index];
          if (selectedBranchMessage) {
            await apiService.setCurrentBranch(conversationId, selectedBranchMessage.message_id);
          }
        }
      } catch (error) {
        console.error('Error updating branch selection:', error);
      }
    }
  }, [conversationId, messages]);

  // Memoized getCurrentBranchTip function
  const getCurrentBranchTip = useCallback((messages: Message[], selectedBranch: Map<string, number>): string | undefined => {
    let node: Message | undefined = messages[0]; // root
    let parentAssistantId: string | undefined = undefined;
    while (node) {
      if (node.role === 'assistant') {
        parentAssistantId = node.message_id;
        const userBranches: Message[] = node.children?.filter((child: Message) => child.role === 'user') || [];
        if (userBranches.length > 0) {
          const branchIndex: number = selectedBranch.get(node.message_id) || 0;
          node = userBranches[branchIndex] || userBranches[0];
        } else {
          break;
        }
      } else if (node.children && node.children.length > 0) {
        // For user, just follow the only assistant child
        node = node.children.find((child: Message) => child.role === 'assistant');
      } else {
        break;
      }
    }
    return parentAssistantId;
  }, []);

  // Memoized scrollToBottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Helper function to restore branch selection from backend
  const restoreBranchSelection = useCallback((messages: Message[], currentLeafMessageId: string) => {
    // Find the message that matches the current leaf
    const findMessageInTree = (msgs: Message[], targetId: string): Message | null => {
      for (const msg of msgs) {
        if (msg.message_id === targetId) {
          return msg;
        }
        if (msg.children) {
          const found = findMessageInTree(msg.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const targetMessage = findMessageInTree(messages, currentLeafMessageId);
    if (!targetMessage) return;

    // If the target message is a user message, find its parent assistant and set the branch
    if (targetMessage.role === 'user' && targetMessage.parent_message_id) {
      const parentMessage = findMessageById(messages, targetMessage.parent_message_id);
      if (parentMessage && parentMessage.children) {
        const userBranches = parentMessage.children.filter((child: Message) => child.role === 'user');
        const branchIndex = userBranches.findIndex((branch: Message) => branch.message_id === targetMessage.message_id);
        if (branchIndex !== -1) {
          setSelectedBranch(prev => {
            const newMap = new Map(prev);
            newMap.set(parentMessage.message_id, branchIndex);
            return newMap;
          });
        }
      }
    }
  }, []);

  // Memoized loadConversation function
  const loadConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const data = await apiService.getConversation(conversationId);
      setConversation(data.conversation);
      setMessages(data.messages);
      setAllMessages(data.allMessages);
      // Clear pending message after successful load
      setPendingUserMessage(null);

      // Restore branch selection from backend
      if (data.conversation.current_leaf_message_id) {
        restoreBranchSelection(data.messages, data.conversation.current_leaf_message_id);
      }

      // Branch switching logic moved here, using fresh messages
      if (pendingBranchSwitchRef.current) {
        const { editedMessageId, parentAssistantId } = pendingBranchSwitchRef.current;
        setTimeout(() => {
          // Log the full message tree
          console.log('[BranchSwitch] data.messages:', data.messages);
          console.log('[BranchSwitch] parentAssistantId:', parentAssistantId);
          console.log('[BranchSwitch] editedMessageId:', editedMessageId);
          const parentMessage = findMessageById(data.messages, parentAssistantId);
          console.log('[BranchSwitch] found parentMessage:', parentMessage);
          if (parentMessage && parentMessage.children) {
            console.log('[BranchSwitch] parentMessage.children:', parentMessage.children);
            const userBranches = parentMessage.children.filter((child: Message) => child.role === 'user');
            const newBranchIndex = userBranches.findIndex((branch: Message) => branch.message_id === editedMessageId);
            // Debug logging
            console.log('[BranchSwitch] userBranches:', userBranches.map(b => b.message_id));
            console.log('[BranchSwitch] newBranchIndex:', newBranchIndex);
            if (newBranchIndex !== -1) {
              setBranchIndex(parentAssistantId, newBranchIndex);
            } else {
              console.warn('[BranchSwitch] Could not find edited message in user branches!');
            }
          } else {
            console.warn('[BranchSwitch] Could not find parent assistant message or it has no children!');
          }
          pendingBranchSwitchRef.current = null;
        }, 200);
      }
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      // If it's a rate limit error, don't retry immediately
      if (error.response?.status === 429) {
        console.log('Rate limited, will retry later');
        return;
      }
      // For other errors, we might want to show a user-friendly message
    }
  }, [conversationId, setBranchIndex, restoreBranchSelection]);

  // Memoized connectWebSocket function
  const connectWebSocket = useCallback(() => {
    if (!conversationId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    websocketService.connect(conversationId, token);

    websocketService.onMessage((message: StreamingMessage) => {
      if (message.type === 'token') {
        if (message.content) {
          setStreamingMessage(prev => prev + message.content);
        }
        if (message.isComplete) {
          setIsStreamingComplete(true);
          setIsStreaming(false);
          setTimeout(() => {
            setStreamingMessage('');
            setPendingUserMessage(null);
            setIsStreamingComplete(false);
            // Reload conversation to get the new assistant message from database
            loadConversation(); // No branch switching here
          }, 100);
        }
      } else if (message.type === 'resume') {
        // console.log('[WebSocket] Resuming stream with content:', message.content);
        // Set the accumulated content from the server
        if (message.content) {
          setStreamingMessage(message.content);
          setIsStreaming(true);
          setIsStreamingComplete(false);
        }
      } else if (message.type === 'error') {
        setIsStreaming(false);
        setIsStreamingComplete(false);
        setStreamingMessage('');
        console.error('Streaming error:', message.message);
      }
    });

    websocketService.onError((error) => {
      console.error('WebSocket error:', error);
      setIsStreaming(false);
    });
  }, [conversationId, loadConversation]);

  // Memoized sendMessage function
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !conversationId || isStreaming || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);
    setIsStreamingComplete(false);

    try {
      // Refresh conversation data to get any new messages from previous streaming
      await loadConversation();

      // Find the assistant message at the tip of the currently selected branch
      const parentMessageId = getCurrentBranchTip(messages, selectedBranch);

      // Create optimistic user message for immediate display
      const optimisticUserMessage: Message = {
        message_id: `temp-${Date.now()}`,
        role: 'user',
        content: userMessage,
        parent_message_id: parentMessageId || null,
        order_index: 0,
        created_at: new Date().toISOString(),
        children: []
      };

      // Add user message to local state immediately
      setPendingUserMessage(optimisticUserMessage);

      // Add user message to database
      await apiService.addMessage(conversationId, userMessage, 'user', parentMessageId === null ? undefined : parentMessageId);
      setStreamingMessage('');

      // Start streaming AI response
      await apiService.startStreaming(conversationId, conversation!.model_id, userMessage);

      // Track usage (don't fail if this fails)
      try {
        await apiService.trackModelUsage(conversation!.model_id, 'message_sent', conversationId);
      } catch (usageError) {
        console.warn('Failed to track usage:', usageError);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setIsStreaming(false);
      // Remove optimistic message on error
      setPendingUserMessage(null);

      // If it's a rate limit error, show a user-friendly message
      if (error.response?.status === 429) {
        alert('Too many requests. Please wait a moment before sending another message.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, conversationId, isStreaming, isLoading, messages, selectedBranch, conversation, getCurrentBranchTip, loadConversation]);

  // Memoized editMessage function
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!conversationId || isLoading || isStreaming) return;
    setIsLoading(true);
    setIsStreaming(true);
    setIsStreamingComplete(false);
    try {
      // Only create the edited user message once
      const editResponse = await apiService.editMessage(conversationId, messageId, newContent, 'user');
      setStreamingMessage('');
      // Start streaming for the edit (only once)
      await apiService.startStreaming(conversationId, conversation!.model_id, newContent);
      await apiService.trackModelUsage(conversation!.model_id, 'message_edited', conversationId);
      setEditingMessage(null);
      // Store info for branch switch after streaming completes
      if (editResponse.edited_message) {
        const editedMessageId = editResponse.edited_message.message_id;
        const parentAssistantId = editResponse.edited_message.parent_message_id;
        if (editedMessageId && parentAssistantId) {
          pendingBranchSwitchRef.current = { editedMessageId, parentAssistantId };
        }
      }
      // Do NOT reload conversation here; it will be done after streaming completes
    } catch (error) {
      console.error('Error editing message:', error);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, isStreaming, conversation]);

  // Memoized input handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      sendMessage();
    }
  }, [sendMessage]);

  const handleStartEdit = useCallback((messageId: string) => {
    setEditingMessage(messageId);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleInputDivChange = useCallback(() => {
    if (inputDivRef.current) {
      setInputMessage(inputDivRef.current.innerText);
    }
  }, []);

  const handleInputDivKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Memoized renderMessage function - simplified to use MessageItem component
  const renderMessage = useCallback((message: Message, depth = 0, parentAssistantId: string | null = null) => {
    const branches = getMessageBranches(message);
    const currentIndex = parentAssistantId ? getBranchIndex(parentAssistantId) : getBranchIndex(message.message_id);
    const hasMultipleBranches = branches.length > 1;

    return (
      <MessageItem
        key={message.message_id}
        message={message}
        depth={depth}
        parentAssistantId={parentAssistantId}
        editingMessage={editingMessage}
        branches={branches}
        currentIndex={currentIndex}
        hasMultipleBranches={hasMultipleBranches}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onEditMessage={editMessage}
        onSetBranchIndex={setBranchIndex}
        onRenderChild={renderMessage}
      />
    );
  }, [editingMessage, getMessageBranches, getBranchIndex, setBranchIndex, editMessage, handleCancelEdit, handleStartEdit]);

  // Fetch models for selection panel if no conversationId
  useEffect(() => {
    if (!conversationId) {
      setModelsLoading(true);
      Promise.all([
        // apiService.getModels(),
        apiService.getTrendingModels(),
        apiService.getRecentModels(),
        apiService.getModelRecommendations(),
        apiService.getUserModels(),
      ]).then(([
        // modelsData, 
        trendingData,
        recentData,
        recommendationsData,
        userModelsData]) => {
        // setModels(modelsData);
        setTrendingModels(trendingData);
        setRecentModels(recentData);
        setRecommendations(recommendationsData);
        setUserModels(userModelsData);
      }).finally(() => setModelsLoading(false));
    }
  }, [conversationId]);

  // Start new chat from model selection
  const handleNewChat = useCallback(async (modelId: string) => {
    try {
      const conversation = await apiService.createConversation(modelId);
      navigate(`/chat/${conversation.conversation_id}`);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [navigate]);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
      connectWebSocket();
    }

    return () => {
      websocketService.disconnect();
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, pendingUserMessage, scrollToBottom]);

  useEffect(() => {
    if (isStreaming && streamingRef.current) {
      const codeBlocks = streamingRef.current.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const el = block as HTMLElement;
        const lang = el.className.replace('language-', '');
        if (Prism.languages[lang]) {
          el.innerHTML = Prism.highlight(el.textContent || '', Prism.languages[lang], lang);
        }
      });
    }
  }, [streamingMessage, isStreaming]);

  useEffect(() => {
    Prism.highlightAll();
  }, [messages, streamingMessage, selectedBranch]);

  useEffect(() => {
    if (inputMessage === '' && inputDivRef.current) {
      inputDivRef.current.innerText = '';
    }
  }, [inputMessage]);

  // Debug streamingMessage type and value
  // console.log('streamingMessage type:', typeof streamingMessage, streamingMessage);

  // Helper to recursively find a message by ID in the message tree
  function findMessageById(messages: Message[], id: string): Message | undefined {
    for (const msg of messages) {
      if (msg.message_id === id) return msg;
      if (msg.children && msg.children.length > 0) {
        const found = findMessageById(msg.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  if (!conversationId) {
    return (
      <div className="flex flex-col h-full overflow-auto p-8">
        <div className="w-full">
          <h2 className="text-2xl font-bold mb-6 text-center">Pick a model to start chatting</h2>
          {modelsLoading ? (
            <div className="text-center text-gray-500">Loading models...</div>
          ) : (
            <div className="space-y-8">
              {/* My Models */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> My Models</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {userModels.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">No custom models yet</p>
                  ) : userModels.map((model) => (
                    <button key={model.model_id} onClick={() => handleNewChat(model.model_id)} className="w-full text-left p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border">
                      <p className="text-base font-medium">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.short_description}</p>
                      <p className="text-xs text-primary-600 mt-1">{model.endpoints?.length || 0} endpoints</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Trending Models */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Trending Models</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {trendingModels.map((model) => (
                    <button key={model.model_id} onClick={() => handleNewChat(model.model_id)} className="w-full text-left p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border">
                      <p className="text-base font-medium">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.short_description}</p>
                      <p className="text-xs text-gray-400 mt-1">{model.usage_count} conversations this week</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Recently Used */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Clock className="w-5 h-5" /> Recently Used</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {recentModels.map((model) => (
                    <button key={model.model_id} onClick={() => handleNewChat(model.model_id)} className="w-full text-left p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border">
                      <p className="text-base font-medium">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.short_description}</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Star className="w-5 h-5" /> Recommended for You</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {recommendations.map((model) => (
                    <button key={model.model_id} onClick={() => handleNewChat(model.model_id)} className="w-full text-left p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border">
                      <p className="text-base font-medium">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.short_description}</p>
                      {!model.used_by_user && <p className="text-xs text-primary-600 mt-1">New to you</p>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {conversation?.title || 'New Chat'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-white">
              {conversation?.model_name}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="btn-secondary"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Render the message tree */}
        {messages.map(message => renderMessage(message))}

        {/* Show pending user message immediately */}
        {pendingUserMessage && (
          <div className="flex items-start gap-3 justify-end">
            <div className="flex-1 max-w-[80%] order-2">
              <div className="message-user p-3 rounded-lg">
                <p className="whitespace-pre-wrap">{pendingUserMessage.content}</p>
              </div>
            </div>
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && streamingMessage && typeof streamingMessage === 'string' && (
          <div className="assistant-message-block" ref={streamingRef}>
            <MarkdownRenderer content={streamingMessage} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {inputMessage === '' && (
              <span className="absolute left-3 top-2 text-gray-400 pointer-events-none select-none z-10">
                Type your message...
              </span>
            )}
            <div
              ref={inputDivRef}
              contentEditable={!isStreaming}
              suppressContentEditableWarning={true}
              onInput={handleInputDivChange}
              onKeyDown={handleInputDivKeyDown}
              className="input-field min-h-[40px] max-h-40 overflow-y-auto rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ whiteSpace: 'pre-wrap', position: 'relative', zIndex: 20 }}
              aria-label="Prompt input"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isStreaming || isLoading}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatInterface); 