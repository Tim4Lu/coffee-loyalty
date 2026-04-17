import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; 
import { Html5Qrcode } from 'html5-qrcode'; // Використовуємо прямий клас для контролю

export default function BaristaView() {
  // --- 1. СТЕЙТИ ---
  const [customer, setCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [bonusCustomers, setBonusCustomers] = useState([]);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [isFocused, setIsFocused] = useState(false); 
  
  // PWA & Scanner Refs
  const deferredPromptRef = useRef(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false); // Захист від завісань при перемиканні

  // --- 2. ФУНКЦІЇ ---

  const playSuccessSound = () => {
    const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-37a.mp3');
    audio.play().catch(() => {});
  };

  const fetchBonusCustomers = async () => {
    const { data } = await supabase.from('users').select('id, name, phone, progress, total_cups').gte('progress', 7).order('name');
    if (data) setBonusCustomers(data);
  };

  const findCustomer = async (val, isManual = false) => {
    const phoneToFind = val.trim();
    if (!phoneToFind) return;
    
    const { data } = await supabase.from('users').select('*').eq('phone', phoneToFind).maybeSingle();

    if (data) {
      setCustomer(data);
      setShowManualModal(false);
      setSearch('');
    } else if (isManual) {
      setShowManualModal(false); 
      setShowAddModal(true);
    }
  };

  // --- 3. СКАНЕР (ВИПРАВЛЕНО: БЕЗ ЗАВІСАНЬ ТА ТІЛЬКИ ЗАДНЯ КАМЕРА) ---

  const startScanner = async () => {
    // Якщо вже скануємо або в процесі зупинки — чекаємо
    if ((scannerRef.current && scannerRef.current.isScanning) || isStopping.current) return;

    // Очищуємо DOM перед стартом
    const reader = document.getElementById("reader");
    if (reader) reader.innerHTML = "";

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const config = { 
      fps: 15, 
      qrbox: { width: 180, height: 180 }, 
      aspectRatio: 1.0 
    };

    try {
      // facingMode: "environment" гарантує запуск задньої камери
      await html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (txt) => {
          playSuccessSound();
          findCustomer(txt);
        }
      );
    } catch (err) {
      console.warn("Камера ще не готова або зайнята іншим процесом");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning && !isStopping.current) {
      isStopping.current = true;
      try {
        await scannerRef.current.stop();
        const readerEl = document.getElementById("reader");
        if (readerEl) readerEl.innerHTML = ""; 
        scannerRef.current = null;
      } catch (e) {
        console.error("Помилка зупинки камери:", e);
      } finally {
        isStopping.current = false;
      }
    }
  };

  // --- 4. ЕФЕКТИ ---

  useEffect(() => {
    document.title = "Wake Up BARISTA";
    startScanner();
    fetchBonusCustomers();

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        await stopScanner();
      } else {
        // Повернення в додаток — невелика затримка перед стартом камери
        setTimeout(startScanner, 800);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopScanner();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Авто-вихід з клієнта
  useEffect(() => {
    let timer;
    if (customer && !actionLoading) {
      timer = setTimeout(() => { setCustomer(null); }, 10000);
    }
    return () => clearTimeout(timer);
  }, [customer, actionLoading]);

  // PWA Prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Клавіатура (Android)
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      const isOpen = window.visualViewport.height < window.innerHeight * 0.85;
      setIsFocused(isOpen);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // --- 5. ОБРОБНИКИ ---

  const handleInstallClick = async () => {
    if (!deferredPromptRef.current) return;
    deferredPromptRef.current.prompt();
    deferredPromptRef.current = null;
    setShowInstallBtn(false);
  };

  const handleAction = async (type) => {
    if (!customer || actionLoading) return;
    if (type === 'bonus' && !window.confirm(`Видати БЕЗКОШТОВНУ каву для ${customer.name}?`)) return;

    setActionLoading(true);
    let updates = type === 'bonus' 
      ? { progress: Math.max(0, (customer.progress || 0) - 7) }
      : { total_cups: (customer.total_cups || 0) + 1, progress: (customer.progress || 0) + 1 };

    const { data, error } = await supabase.from('users').update(updates).eq('id', customer.id).select().single();

    if (!error && data) {
      playSuccessSound();
      if (type === 'add') {
        setShowPlusOne(true);
        setTimeout(() => setShowPlusOne(false), 1000);
      }
      setCustomer(data);
      fetchBonusCustomers();
    }
    setActionLoading(false);
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim() || !search.trim()) return;
    setActionLoading(true);
    const { data, error } = await supabase.from('users').insert([{ 
      name: newName.trim(), 
      phone: search.trim(), 
      progress: 0, 
      total_cups: 0 
    }]).select().single();
    
    if (!error && data) {
      setCustomer(data);
      setShowAddModal(false);
      setNewName('');
      setSearch('');
      playSuccessSound();
    }
    setActionLoading(false);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent("https://wakeupcofeeloyalty.vercel.app/")}&format=svg`;

  return (
    <div className="fixed inset-0 bg-transparent text-white flex flex-col overflow-hidden font-sans select-none touch-none">
      
      {/* HEADER */}
      <div className="h-16 flex items-center justify-center px-4 pt-4 shrink-0">
        {customer ? (
          <div className="w-full bg-[#2a1d15] py-2 px-4 rounded-2xl border border-[#d2b48c]/20 text-center shadow-lg animate-in fade-in zoom-in-95">
            <h2 className="text-base font-black uppercase italic truncate leading-tight">{customer.name}</h2>
            <p className="text-[10px] font-bold text-[#d2b48c] uppercase tracking-wider">
              Бонуси: {Math.floor(customer.progress / 7)} 🎁 ({customer.progress % 7}/7)
            </p>
          </div>
        ) : (
          <h1 className="text-lg font-black uppercase italic text-[#d2b48c] tracking-tighter">WAKE UP BARISTA</h1>
        )}
      </div>

      {/* SCANNER AREA */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="relative w-60 h-60 overflow-hidden rounded-3xl border-4 border-[#d2b48c] bg-black shadow-2xl">
          {/* reader div залишаємо порожнім, Html5Qrcode сам вставить відео */}
          <div id="reader" className="w-full h-full object-cover"></div>
        </div>
      </div>

      {/* INSTALL BUTTON */}
      {showInstallBtn && (
        <div className="px-4">
          <button onClick={handleInstallClick} className="bg-green-600 text-white p-3 rounded-xl font-bold w-full mb-2 animate-bounce shadow-lg text-xs uppercase">
            📥 Встановити на планшет
          </button>
        </div>
      )}

      {/* BOTTOM BUTTONS */}
      <div className="h-24 flex justify-center items-center gap-6 shrink-0">
        <button onClick={() => { setShowBonusModal(true); fetchBonusCustomers(); }} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] relative shadow-xl active:scale-90 transition-transform">
          🎁 {bonusCustomers.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] w-5 h-5 flex items-center justify-center rounded-full text-white font-black">{bonusCustomers.length}</span>}
        </button>
        <button onClick={() => setShowManualModal(true)} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] shadow-xl active:scale-90 transition-transform">📞</button>
        <button onClick={() => setShowQRModal(true)} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] shadow-xl active:scale-90 transition-transform">🎦</button>
      </div>

      {/* ACTION PANEL */}
      <div className="px-4 pb-10 min-h-[140px] flex flex-col justify-end shrink-0">
        {customer ? (
          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-5">
            <button onClick={() => handleAction('add')} disabled={actionLoading} className="w-full bg-[#d2b48c] text-[#1a110a] py-4 rounded-xl font-black uppercase text-base active:scale-95 shadow-xl disabled:opacity-50">
              {actionLoading ? "..." : "＋ Нарахувати чашку"}
            </button>
            {customer.progress >= 7 && (
              <button onClick={() => handleAction('bonus')} disabled={actionLoading} className="w-full bg-white text-black py-2.5 rounded-xl font-black uppercase text-[10px] border border-[#1a110a] active:scale-95 disabled:opacity-50">
                🎁 Видати БЕЗКОШТОВНУ каву
              </button>
            )}
            <button onClick={() => setCustomer(null)} className="text-[9px] opacity-30 uppercase font-black py-2 text-center tracking-widest active:opacity-100">Скинути клієнта</button>
          </div>
        ) : (
          <div className="h-20" /> 
        )}
      </div>

      {/* MODALS (Мануальний пошук, Додавання, QR) — залишаються без змін */}
      {showManualModal && (
        <div className={`fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex justify-center p-6 transition-all duration-300 ${isFocused ? 'items-start pt-6' : 'items-center'}`}>
          <div className={`bg-[#2a1d15] p-6 rounded-[2.5rem] w-full max-w-sm border-2 border-[#d2b48c] shadow-2xl relative transition-transform duration-300 ${isFocused ? 'scale-95' : 'scale-100'}`}>
            <h2 className={`font-black uppercase text-[#d2b48c] text-center mb-4 italic tracking-tighter ${isFocused ? 'text-xs' : 'text-xl'}`}>Номер телефону</h2>
            <div className="flex flex-col gap-3">
              <input type="tel" autoFocus className="w-full bg-black rounded-xl p-4 text-center text-3xl font-black text-white border border-white/5 outline-none focus:border-[#d2b48c]" placeholder="093..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && findCustomer(search, true)} />
              <button onMouseDown={(e) => { e.preventDefault(); findCustomer(search, true); }} className="w-full bg-[#d2b48c] text-[#1a110a] py-4 rounded-xl font-black uppercase text-sm">Знайти</button>
              <button onClick={() => setShowManualModal(false)} className="text-[9px] opacity-30 uppercase font-black mt-2">Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className={`fixed inset-0 bg-black/98 z-[300] flex justify-center p-6 backdrop-blur-xl transition-all duration-300 ${isFocused ? 'items-start pt-6' : 'items-center'}`}>
          <div className={`bg-[#2a1d15] p-8 rounded-[3rem] w-full max-w-sm border-2 border-[#d2b48c] shadow-2xl relative transition-transform duration-300 ${isFocused ? 'scale-95' : 'scale-100'}`}>
            <h2 className={`font-black uppercase text-[#d2b48c] text-center mb-4 italic tracking-tighter ${isFocused ? 'text-xs' : 'text-xl'}`}>Новий клієнт</h2>
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="text-[9px] opacity-40 uppercase font-bold mb-1">Реєстрація номера:</p>
                <p className="text-2xl font-black text-white tracking-tighter">{search}</p>
              </div>
              <input type="text" autoFocus className="w-full bg-black rounded-xl p-4 text-center text-white font-bold border border-white/10 outline-none focus:border-[#d2b48c]" placeholder="Ім'я клієнта" value={newName} onChange={e => setNewName(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 py-4 rounded-xl font-bold uppercase text-[9px] text-white/50">Назад</button>
                <button onMouseDown={(e) => { e.preventDefault(); handleCreateCustomer(); }} className="flex-[2] bg-[#d2b48c] text-[#1a110a] py-4 rounded-xl font-black uppercase text-[9px]">Зберегти ＋</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-[#1a110a]/95 backdrop-blur-xl z-[600] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
          <button onClick={() => setShowQRModal(false)} className="absolute top-10 right-8 text-[#d2b48c] active:scale-75 transition-transform"><span className="text-5xl font-light">&times;</span></button>
          <div className="w-full max-w-xs flex flex-col items-center text-center">
            <h2 className="text-3xl font-black italic uppercase text-[#d2b48c] mb-2 tracking-tighter leading-none">Скануй та встановлюй</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] mb-10">WAKE UP APP • Твій прогрес</p>
            <div className="bg-[#d2b48c] p-3 rounded-2xl">
              <img src={qrImageUrl} alt="App Download QR" className="w-64 h-64 rounded-xl shadow-inner" />
            </div>
            <button onClick={() => setShowQRModal(false)} className="mt-12 px-10 py-3 bg-[#2a1d15] border border-[#d2b48c]/30 rounded-full text-[10px] font-black uppercase tracking-widest text-[#d2b48c]">Зрозуміло</button>
          </div>
        </div>
      )}

      {showBonusModal && (
        <div className="fixed inset-0 bg-black/98 z-[400] flex flex-col p-6 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase italic text-[#d2b48c]">Бонусники</h2>
            <button onClick={() => setShowBonusModal(false)} className="text-white text-3xl leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {bonusCustomers.length === 0 ? <p className="text-center opacity-20 uppercase font-black text-xs py-20">Список порожній</p> : bonusCustomers.map((c, i) => (
              <div key={i} onClick={() => { setCustomer(c); setShowBonusModal(false); }} className="bg-[#2a1d15] p-4 rounded-2xl border border-white/5 active:bg-[#d2b48c] active:text-black transition-colors"><p className="font-black uppercase italic">{c.name}</p><p className="text-[10px] opacity-40">{c.phone}</p></div>
            ))}
          </div>
        </div>
      )}

      {showPlusOne && (
        <div className="fixed inset-0 pointer-events-none z-[500] flex items-center justify-center">
          <div className="text-[#F12F2F] text-8xl font-black italic animate-bounce drop-shadow-[0_0_20px_rgba(241,47,47,0.7)]">＋1</div>
        </div>
      )}
    </div>
  );
}