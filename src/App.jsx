import React, { useEffect } from 'react'; // ТІЛЬКИ ОДИН ТАКИЙ РЯДОК УГОРІ
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientView from './components/ClientView.jsx';
import BaristaView from './components/BaristaView.jsx';
import AdminView from './components/AdminView.jsx';
import ProtectedView from './components/ProtectedView.jsx';

export default function App() {

  useEffect(() => {
    
    // Міняємо версію (V1 -> V2), щоб змусити телефон оновитися після твоїх останніх змін
    const loader = document.getElementById('preloader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 500); // Повністю видаляємо через пів секунди
    }

    const currentVersion = 'forceRefreshV3'; 
    const hasRefreshed = sessionStorage.getItem(currentVersion);
    
    if (!hasRefreshed) {
      sessionStorage.setItem(currentVersion, 'true');
      // Оновлюємо сторінку
      window.location.reload(); 
    }
  }, []);

  return (
    // Головний контейнер (задаємо базовий темний колір на випадок затримки завантаження фото)
    <div className="relative min-h-screen w-full bg-[#1a110a] font-sans selection:bg-[#d2b48c]/30">
      
      {/* ФОНОВИЙ ШАР (PNG) */}
      {/* fixed inset-0 — розтягує на весь екран і фіксує */}
      <div 
        className="fixed inset-0 z-0 bg-[url('/CoffeeImg.png')]  bg-right-bottom bg-no-repeat opacity-40 pointer-events-none bg-[length:100%_auto]"
        aria-hidden="true"
      />

      {/* КОНТЕНТНИЙ ШАР */}
      {/* relative z-10 — ставимо поверх фону */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ClientView />} />
            
            <Route path="/barista" element={
              <ProtectedView type="barista">
                <BaristaView />
              </ProtectedView>
            } />

            <Route path="/admin" element={
              <ProtectedView type="admin">
                <AdminView />
              </ProtectedView>
            } />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}
