import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/layout.css';
import './styles.css';
import './styles/ui-cohesion.css';
import './styles/region.css';
import './styles/results-layout.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
