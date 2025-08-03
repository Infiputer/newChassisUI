import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import svgPanZoom from 'svg-pan-zoom';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, id }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = id || `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    // Initialize mermaid with custom configuration to suppress logs
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      logLevel: 'fatal', // suppress internal logs
      fontFamily: 'monospace',
    });
  }, []);

  useEffect(() => {
    // Prevent Mermaid from appending global error messages
    if (typeof window !== 'undefined' && (window as any).mermaid) {
      (window as any).mermaid.parseError = function() {};
    }
    if (containerRef.current && chart) {
      try {
        containerRef.current.innerHTML = '';
        mermaid.render(uniqueId, chart).then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
            const svgElement = containerRef.current.querySelector('svg');
            if (svgElement) {
              // Fix: Ensure viewBox is set and width/height are valid numbers
              if (!svgElement.getAttribute('viewBox')) {
                let width = svgElement.getAttribute('width');
                let height = svgElement.getAttribute('height');
                // Remove units if present (e.g., "800px" -> "800")
                if (width) width = width.replace(/[^0-9.]/g, '');
                if (height) height = height.replace(/[^0-9.]/g, '');
                // Fallback to default if parsing fails
                const w = parseFloat(width || '') || 800;
                const h = parseFloat(height || '') || 600;
                svgElement.setAttribute('viewBox', `0 0 ${w} ${h}`);
                svgElement.setAttribute('width', `${w}`);
                svgElement.setAttribute('height', `${h}`);
              }
              try {
                svgPanZoom(svgElement, {
                  zoomEnabled: true,
                  controlIconsEnabled: true,
                  fit: true,
                  center: true,
                  panEnabled: true,
                  minZoom: 0.5,
                  maxZoom: 10,
                });
              } catch (e) {
                console.error('svg-pan-zoom initialization error:', e);
              }
            }
          }
        }).catch((error) => {
          console.error('Mermaid rendering error:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
                <p class="font-semibold">Mermaid Diagram Error:</p>
                <p class="text-sm">${error.message}</p>
                <details class="mt-2">
                  <summary class="cursor-pointer text-xs">Show code</summary>
                  <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">${chart}</pre>
                </details>
              </div>
            `;
          }
        });
      } catch (error) {
        console.error('Mermaid initialization error:', error);
      }
    }
  }, [chart, uniqueId]);

  return (
    <div 
      ref={containerRef} 
      className="mermaid-diagram my-4 flex justify-center"
      data-testid="mermaid-diagram"
    />
  );
};

export default MermaidDiagram; 