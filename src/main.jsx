import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/vazirmatn/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';
import './index.css';
import App from './App.jsx';

// Also set here so the page stays RTL when it is embedded without its own <html> tag.
document.documentElement.lang = 'fa';
document.documentElement.dir = 'rtl';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
