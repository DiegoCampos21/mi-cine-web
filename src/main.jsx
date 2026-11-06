import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Forzamos el fondo oscuro globalmente en el root del DOM
const rootElement = document.getElementById('root');
rootElement.style.backgroundColor = '#141414';
rootElement.style.minHeight = '100vh';
rootElement.style.margin = '0';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);