import React, { useRef, useEffect } from 'react';
import { marked } from 'marked';
import MermaidDiagram from './MermaidDiagram';
import Prism from 'prismjs';

interface MarkdownRendererProps {
  content: string;
}

// Normalize code for comparison: trim, normalize line endings, remove trailing blank lines
function normalizeCode(code: string) {
  return code
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+$/g, '') // remove trailing whitespace
    .replace(/\n+$/g, '') // remove trailing blank lines
    .trim();
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom renderer for marked that handles mermaid code blocks
  const customRenderer = new marked.Renderer();

  // Override the code renderer to handle mermaid blocks
  customRenderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    if (lang === 'mermaid') {
      const encoded = encodeURIComponent(text);
      return `<div class="mermaid-code-block" data-mermaid="${encoded}"></div>`;
    }
    // For other languages, add a header with language and copy button
    const language = lang || 'text';
    // Remove leading common indentation from all lines (handle tabs and spaces)
    const lines = text.split('\n');
    // Remove leading/trailing empty lines
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    // Find min indent (spaces/tabs) for non-empty lines
    let minIndent: number | null = null;
    for (const line of lines) {
      if (line.trim() === '') continue;
      const match = line.match(/^(\s*)/);
      if (match) {
        // Count tabs as 4 spaces for indent calculation
        const indent = match[1].replace(/\t/g, '    ').length;
        if (minIndent === null || indent < minIndent) minIndent = indent;
      }
    }
    if (minIndent === null) minIndent = 0;
    // Remove minIndent from each line
    const safeMinIndent = minIndent ?? 0;
    const dedentedLines = lines.map(line => {
      let i = 0, removed = 0;
      while (removed < safeMinIndent && i < line.length) {
        if (line[i] === ' ') { removed++; i++; }
        else if (line[i] === '\t') { removed += 4; i++; }
        else break;
      }
      return line.slice(i);
    });
    const dedentedText = dedentedLines.join('\n');
    const escapedCode = dedentedText.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    // The raw code (not escaped) is used for copying
    // Place the language and copy button inside <pre> but outside <code>
return `
  <div class="code-block-container" style="margin-top:1.5em;">
    <pre class="code-block-pre" style="display:inline-block;max-width:100%;overflow-x:auto;margin:0;padding:0.0em 1em;border-radius:6px;">
      <div class="code-block-header" style="display:flex;justify-content:space-between;align-items:center;gap:0em;margin-bottom:0em;">
        <span class="code-lang-label" style="font-size:0.85em;color:#888;">${language}</span>
        <button class="copy-btn" data-code="${encodeURIComponent(dedentedText)}" style="font-size:0.85em;padding:2px 8px;border-radius:4px;border:none;">Copy</button>
      </div>
      <code class="language-${language}" style="display:block;margin:0;">${escapedCode}</code>
    </pre>
  </div>
`;
  };

  useEffect(() => {
    if (containerRef.current) {
      const parseMarkdown = async () => {
        try {
          const html = await marked.parse(content, { renderer: customRenderer });
          if (typeof html === 'string' && containerRef.current) {
            containerRef.current.innerHTML = html;

            // Find and render mermaid blocks
            const mermaidBlocks = containerRef.current.querySelectorAll('.mermaid-code-block');
            mermaidBlocks.forEach((block, index) => {
              const mermaidCode = decodeURIComponent(block.getAttribute('data-mermaid') || '');
              // More forgiving regex: match all completed mermaid code blocks
              // - allow whitespace before/after
              // - normalize line endings
              // - allow extra blank lines at end
              const codeBlockRegex = /```mermaid\s*\n([\s\S]*?)\n*```/g;
              let foundComplete = false;
              let match;
              const normalizedMermaidCode = normalizeCode(mermaidCode);
              while ((match = codeBlockRegex.exec(content)) !== null) {
                const normalizedBlock = normalizeCode(match[1]);
                if (normalizedBlock === normalizedMermaidCode) {
                  foundComplete = true;
                  break;
                }
              }
              if (foundComplete && mermaidCode) {
                const mermaidElement = React.createElement(MermaidDiagram, {
                  chart: mermaidCode,
                  id: `mermaid-${index}`
                });
                const root = document.createElement('div');
                block.appendChild(root);
                const ReactDOM = require('react-dom');
                ReactDOM.render(mermaidElement, root);
              } else {
                // If not complete, show placeholder
                block.innerHTML = '<div class="mermaid-placeholder">Rendering diagram...</div>';
              }
            });

            // Apply syntax highlighting to code blocks
            const codeBlocks = containerRef.current.querySelectorAll('pre code');
            codeBlocks.forEach((block) => {
              const el = block as HTMLElement;
              const lang = el.className.replace('language-', '');
              if (Prism.languages[lang]) {
                el.innerHTML = Prism.highlight(el.textContent || '', Prism.languages[lang], lang);
              }
            });

            // Add copy button click handler
            const clickHandler = (e: Event) => {
              const target = e.target as HTMLElement;
              if (target.classList.contains('copy-btn')) {
                const code = decodeURIComponent(target.getAttribute('data-code') || '');
                navigator.clipboard.writeText(code);
                const original = target.textContent;
                target.textContent = 'Copied!';
                setTimeout(() => {
                  target.textContent = original || 'Copy';
                }, 1200);
              }
            };
            containerRef.current.addEventListener('click', clickHandler);
            // Clean up on unmount or re-render
            return () => {
              containerRef.current?.removeEventListener('click', clickHandler);
            };
          }
        } catch (error) {
          console.error('Error parsing markdown:', error);
        }
      };
      parseMarkdown();
    }
  }, [content]);

  return <div ref={containerRef} className="markdown-content" />;
};

export default MarkdownRenderer; 