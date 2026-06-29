import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nueva versión detectada - notificando al usuario...');
    const event = new CustomEvent('app-update-available');
    window.dispatchEvent(event);
  },
  onOfflineReady() {
    console.log('Reporta está listo para funcionar offline');
  },
  onRegistered(registration) {
    console.log('Service Worker registrado correctamente');
    if (registration) {
      setInterval(() => {
        console.log('Verificando actualizaciones...');
        registration.update();
      }, 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('Error al registrar Service Worker:', error);
  }
});

window.addEventListener('app-update-reload', () => {
  console.log('Actualizando la aplicación...');
  updateSW(true);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
