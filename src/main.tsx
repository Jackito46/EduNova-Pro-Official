import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { installOutgoingSecurityMiddleware } from './middlewares/outgoingSecurityMiddleware.ts';
import App from './App.tsx';
import './index.css';

// Initialise le middleware de sécurité pour intercepter toutes les requêtes API sortantes
installOutgoingSecurityMiddleware();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
