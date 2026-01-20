// =============================================================================
// SOTA WP CONTENT OPTIMIZER PRO - ENTRY POINT v12.0
// Enterprise-Grade Application Bootstrap
// =============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { SotaErrorBoundary } from './App';
import './index.css';

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[SOTA Global Error]', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[SOTA Unhandled Promise]', event.reason);
  });
}

// Bootstrap application
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('[SOTA] Root element not found. Ensure index.html has <div id="root"></div>');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <SotaErrorBoundary>
      <App />
    </SotaErrorBoundary>
  </React.StrictMode>
);

console.log('🚀 SOTA WP Content Optimizer Pro v12.0 - Initialized');

