import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './sota-content-elements.css';
import 'react-quill/dist/quill.snow.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
