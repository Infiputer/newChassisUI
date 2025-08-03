import React from 'react';

// Performance monitoring utility
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private renderTimes: Map<string, number[]> = new Map();
  private apiCallTimes: Map<string, number[]> = new Map();
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startRenderTimer(componentName: string): () => void {
    if (!this.isEnabled) return () => {};
    
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.renderTimes.has(componentName)) {
        this.renderTimes.set(componentName, []);
      }
      this.renderTimes.get(componentName)!.push(duration);
      
      // Log if render time is above threshold
      if (duration > 16) { // 60fps threshold
        console.warn(`[Performance] Slow render detected in ${componentName}: ${duration.toFixed(2)}ms`);
      }
    };
  }

  startApiTimer(endpoint: string): () => void {
    if (!this.isEnabled) return () => {};
    
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.apiCallTimes.has(endpoint)) {
        this.apiCallTimes.set(endpoint, []);
      }
      this.apiCallTimes.get(endpoint)!.push(duration);
      
      // Log if API call is slow
      if (duration > 1000) {
        console.warn(`[Performance] Slow API call detected for ${endpoint}: ${duration.toFixed(2)}ms`);
      }
    };
  }

  getAverageRenderTime(componentName: string): number {
    const times = this.renderTimes.get(componentName);
    if (!times || times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getAverageApiTime(endpoint: string): number {
    const times = this.apiCallTimes.get(endpoint);
    if (!times || times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getRenderCount(componentName: string): number {
    return this.renderTimes.get(componentName)?.length || 0;
  }

  getApiCallCount(endpoint: string): number {
    return this.apiCallTimes.get(endpoint)?.length || 0;
  }

  logSummary(): void {
    if (!this.isEnabled) return;
    
    console.group('[Performance Summary]');
    
    console.group('Render Times:');
    this.renderTimes.forEach((times, component) => {
      const avg = this.getAverageRenderTime(component);
      const count = this.getRenderCount(component);
      console.log(`${component}: ${avg.toFixed(2)}ms avg (${count} renders)`);
    });
    console.groupEnd();
    
    console.group('API Call Times:');
    this.apiCallTimes.forEach((times, endpoint) => {
      const avg = this.getAverageApiTime(endpoint);
      const count = this.getApiCallCount(endpoint);
      console.log(`${endpoint}: ${avg.toFixed(2)}ms avg (${count} calls)`);
    });
    console.groupEnd();
    
    console.groupEnd();
  }

  reset(): void {
    this.renderTimes.clear();
    this.apiCallTimes.clear();
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// React hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const endRenderTimer = performanceMonitor.startRenderTimer(componentName);
  
  // End timer on every render
  React.useEffect(() => {
    endRenderTimer();
  });
}; 