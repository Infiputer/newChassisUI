import React, { useState, useCallback } from 'react';

interface MessageEditorProps {
  messageId: string;
  initialContent: string;
  onSave: (messageId: string, content: string) => void;
  onCancel: () => void;
}

const MessageEditor: React.FC<MessageEditorProps> = React.memo(({ 
  messageId, 
  initialContent, 
  onSave, 
  onCancel 
}) => {
  const [editContent, setEditContent] = useState(initialContent);

  const handleSave = useCallback(() => {
    onSave(messageId, editContent);
  }, [messageId, editContent, onSave]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div className="space-y-2">
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="input-field w-full"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="btn-primary text-sm"
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          className="btn-secondary text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

MessageEditor.displayName = 'MessageEditor';

export default MessageEditor; 