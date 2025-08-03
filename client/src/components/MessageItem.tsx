import React, { useCallback, useMemo } from 'react';
import { Message } from '../types';
import { Edit } from 'lucide-react';
import MessageEditor from './MessageEditor';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageItemProps {
  message: Message;
  depth: number;
  parentAssistantId: string | null;
  editingMessage: string | null;
  branches: Message[];
  currentIndex: number;
  hasMultipleBranches: boolean;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onEditMessage: (messageId: string, content: string) => void;
  onSetBranchIndex: (messageId: string, index: number) => void;
  onRenderChild: (message: Message, depth: number, parentAssistantId: string | null) => React.ReactNode;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({
  message,
  depth,
  parentAssistantId,
  editingMessage,
  branches,
  currentIndex,
  hasMultipleBranches,
  onStartEdit,
  onCancelEdit,
  onEditMessage,
  onSetBranchIndex,
  onRenderChild
}) => {
  const isEditing = editingMessage === message.message_id;
  const currentMessage = message;

  // Debug currentMessage.content type and value
  // console.log('currentMessage.content type:', typeof currentMessage.content, currentMessage.content);

  const handleStartEdit = useCallback(() => {
    onStartEdit(message.message_id);
  }, [message.message_id, onStartEdit]);

  const handleSetBranchIndex = useCallback((index: number) => {
    if (parentAssistantId) {
      onSetBranchIndex(parentAssistantId, index);
    }
  }, [parentAssistantId, onSetBranchIndex]);

  const renderChildren = useMemo(() => {
    if (!currentMessage.children || currentMessage.children.length === 0) {
      return null;
    }

    if (currentMessage.role === 'assistant') {
      // Only show the selected user branch
      const userBranches = currentMessage.children.filter(child => child.role === 'user');
      if (userBranches.length > 1) {
        const branchIndex = currentIndex;
        const selectedUserBranch = userBranches[branchIndex] || userBranches[0];
        return onRenderChild(selectedUserBranch, depth + 1, currentMessage.message_id);
      } else if (userBranches.length === 1) {
        return onRenderChild(userBranches[0], depth + 1, currentMessage.message_id);
      } else {
        return null;
      }
    } else {
      // For user messages, render all children (should only be one assistant child)
      return currentMessage.children.map(child => onRenderChild(child, depth + 1, null));
    }
  }, [currentMessage, depth, currentIndex, onRenderChild]);

  return (
    <div className="mb-4">
      <div className={`flex items-start gap-3 ${currentMessage.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex-1 max-w-[80%] ${currentMessage.role === 'user' ? 'order-2' : 'order-1'}`}>
          {isEditing ? (
            <MessageEditor
              messageId={message.message_id}
              initialContent={currentMessage.content}
              onSave={onEditMessage}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className={`p-3 rounded-lg ${
              currentMessage.role === 'user' ? 'message-user' : 'message-assistant'
            }`}>
              {/* Branch navigation buttons - ChatGPT style */}
              {currentMessage.role === 'user' && hasMultipleBranches && parentAssistantId && (
                <div className="flex items-center gap-1 mb-2 bg-blue-50 p-2 rounded border border-blue-200">
                  <span className="text-xs text-blue-600 mr-2">Edits:</span>
                  {branches.map((branch, index) => (
                    <button
                      key={index}
                      onClick={() => handleSetBranchIndex(index)}
                      className={`w-6 h-6 text-xs rounded-full border transition-colors ${
                        index === currentIndex
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                      title={`Version ${index + 1}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              )}
              {currentMessage.role === 'assistant' && typeof currentMessage.content === 'string' ? (
                <MessageMarkdown content={currentMessage.content} />
              ) : (
                <p className="whitespace-pre-wrap">{currentMessage.content}</p>
              )}
              {currentMessage.role === 'user' && (
                <button
                  onClick={handleStartEdit}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Edit className="w-3 h-3 inline mr-1" />
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Render children */}
      {renderChildren && (
        <div className="mt-2">
          {renderChildren}
        </div>
      )}
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;

function MessageMarkdown({ content }: { content: string }) {
  return <div className="assistant-message-block"><MarkdownRenderer content={content} /></div>;
} 