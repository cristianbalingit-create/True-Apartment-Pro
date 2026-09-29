import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global handler ensuring every button smoothly flashes orange when clicked
if (typeof window !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest("button, [role='button'], a.neu-btn, a.neu-btn-primary, .neu-btn");
    if (btn) {
      btn.classList.add("btn-clicked");
    }
  }, true);

  const clearClicked = (e: Event) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest("button, [role='button'], a.neu-btn, a.neu-btn-primary, .neu-btn");
    if (btn) {
      setTimeout(() => {
        btn.classList.remove("btn-clicked");
      }, 350);
    } else {
      document.querySelectorAll(".btn-clicked").forEach(el => {
        setTimeout(() => el.classList.remove("btn-clicked"), 250);
      });
    }
  };

  document.addEventListener("pointerup", clearClicked, true);
  document.addEventListener("pointercancel", clearClicked, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
