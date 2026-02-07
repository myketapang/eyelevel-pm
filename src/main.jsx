import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const rootContainer = document.getElementById('root');
if (rootContainer) {
  createRoot(rootContainer).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
