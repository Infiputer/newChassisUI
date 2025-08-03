import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

const MermaidTest: React.FC = () => {
  const testContent = `
# Mermaid Diagram Test

Here's a simple flowchart:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

And here's a sequence diagram:

\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    
    User->>App: Send message
    App->>API: Process request
    API-->>App: Return response
    App-->>User: Display result
\`\`\`

And a class diagram:

\`\`\`mermaid
classDiagram
    class Message {
        +string content
        +string role
        +string message_id
        +render()
    }
    
    class MarkdownRenderer {
        +string content
        +render()
    }
    
    class MermaidDiagram {
        +string chart
        +render()
    }
    
    Message --> MarkdownRenderer
    MarkdownRenderer --> MermaidDiagram
\`\`\`

Regular code blocks still work:

\`\`\`javascript
console.log('Hello, World!');
\`\`\`
`;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mermaid Integration Test</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <MarkdownRenderer content={testContent} />
      </div>
    </div>
  );
};

export default MermaidTest; 