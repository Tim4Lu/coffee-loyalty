import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BaristaView() {
  // --- 1. СТЕЙТИ ---
  const [customer, setCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [bonusCustomers, setBonusCustomers] = useState([]);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const scannerRef = useRef(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // --- 2. ЕФЕКТИ ---

  // Налаштування PWA
  useEffect(() => {
    document.title = "Wake Up BARISTA";
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Visual Viewport API для Android (Клавіатура)
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      const isOpen = window.visualViewport.height < window.innerHeight * 0.85;
      setIsFocused(isOpen);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  // Скидання клієнта через 10 секунд (якщо немає активних дій)
  useEffect(() => {
    let timer;
    if (customer && !actionLoading) {
      timer = setTimeout(() => {
        setCustomer(null);
        setSearch('');
        setIsFocused(false);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [customer, actionLoading]);

  // Ініціалізація сканера
  useEffect(() => {
    const startScanner = () => {
        if (!scannerRef.current) {
          scannerRef.current = new Html5QrcodeScanner("reader", { 
            fps: 10, // 10 fps цілком достатньо і менше вантажить процесор
            qrbox: { width: 150, height: 150 }, 
            aspectRatio: 1.0,
            rememberLastUsedCamera: true, // Допомагає не тупити при старті
            showTorchButtonIfSupported: true
          });
          
          scannerRef.current.render(
            (txt) => {
              playSuccessSound(); // Твоя функція звуку
              findCustomer(txt);
            }, 
            (error) => {
              // Ігноруємо помилки сканування (вони летять кожну секунду, якщо коду немає в кадрі)
            }
          );
        }
      };

  startScanner();
  fetchBonusCustomers();

  return () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
      scannerRef.current = null;
    }
  };
  }, []);
  useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && scannerRef.current) {
      // Якщо вкладка стала видимою, а камера висить — пробуємо "пересмикнути" інтерфейс
      console.log("Wake up camera...");
    }
  };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // --- 3. ЛОГІКА ---

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
    setLoading(true);
    const { data } = await supabase.from('users').select('*').eq('phone', phoneToFind).maybeSingle();

    if (data) {
      setCustomer(data);
      setShowManualModal(false);
      setSearch('');
    } else if (isManual) {
      setShowManualModal(false); 
      setShowAddModal(true);
    }
    setTimeout(() => setLoading(false), 400);
  };

  // ВИПРАВЛЕНА ФУНКЦІЯ СПИСАННЯ/НАРАХУВАННЯ
  const handleAction = async (type) => {
    if (!customer || actionLoading) return;
    
    if (type === 'bonus' && !window.confirm(`Видати БЕЗКОШТОВНУ каву для ${customer.name}?`)) return;

    setActionLoading(true);
    
    let updates = {};
    if (type === 'bonus') {
      // Віднімаємо 7 чашок з прогресу
      updates = { 
        progress: Math.max(0, (customer.progress || 0) - 7) 
      };
    } else {
      // Додаємо 1 чашку
      updates = { 
        total_cups: (customer.total_cups || 0) + 1, 
        progress: (customer.progress || 0) + 1 
      };
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', customer.id)
      .select()
      .single();

    if (!error && data) {
      playSuccessSound();
      if (type === 'add') {
        setShowPlusOne(true);
        setTimeout(() => setShowPlusOne(false), 1000);
      }
      setCustomer(data);
      fetchBonusCustomers();
    } else {
      alert("Помилка оновлення бази даних");
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

  const appDownloadLink = "https://wakeupcofeeloyalty.vercel.app/"; 
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appDownloadLink)}&format=svg`;

  return (
    <div className="fixed inset-0 bg-[#1a110a] text-white flex flex-col overflow-hidden font-sans select-none touch-none">
      
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

      {/* SCANNER */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="relative w-60 h-60 overflow-hidden rounded-3xl border-4 border-[#d2b48c] bg-black shadow-2xl p-0">
          <div id="reader" className="w-full h-full scale-170 transform-gpu"></div>
        </div>
        {!customer && (
          <div className="mt-3 text-[7px] font-black uppercase tracking-[0.5em] opacity-20 italic animate-pulse">Ready to scan</div>
        )}
      </div>

      {/* BUTTONS */}
      <div className="h-20 flex justify-center items-center gap-6 shrink-0">
        <button onClick={() => { setShowBonusModal(true); fetchBonusCustomers(); }} className="w-16 h-16  bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] relative active:scale-90 transition-transform shadow-xl">
          🎁 {bonusCustomers.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[9px] font-black  w-5 h-5 flex items-center justify-center text-white border-2 border-[#1a110a]">{bonusCustomers.length}</span>}
        </button>
        <button onClick={() => setShowManualModal(true)} className="w-16 h-16  bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] relative active:scale-90 transition-transform shadow-xl">
          📞
        </button>
        <button onClick={() => setShowQRModal(true)} className="w-16 h-16  bg-white rounded-full flex items-center justify-center text-xl border-4 border-[#2a1d15] relative active:scale-90 transition-transform shadow-xl">🎦</button>
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

      {/* MODAL: MANUAL SEARCH */}
      {showManualModal && (
        <div className={`fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex justify-center p-6 transition-all duration-300 ${isFocused ? 'items-start pt-6' : 'items-center'}`}>
          <div className={`bg-[#2a1d15] p-6 rounded-[2.5rem] w-full max-w-sm border-2 border-[#d2b48c] shadow-2xl relative transition-transform duration-300 ${isFocused ? 'scale-95' : 'scale-100'}`}>
            <h2 className={`font-black uppercase text-[#d2b48c] text-center mb-4 italic tracking-tighter ${isFocused ? 'text-xs' : 'text-xl'}`}>Номер телефону</h2>
            <div className="flex flex-col gap-3">
              <input 
                type="tel" 
                autoFocus 
                className="w-full bg-black rounded-xl p-4 text-center text-3xl font-black text-white border border-white/5 outline-none focus:border-[#d2b48c]" 
                placeholder="093..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && findCustomer(search, true)} 
              />
              <button onMouseDown={(e) => { e.preventDefault(); findCustomer(search, true); }} className="w-full bg-[#d2b48c] text-[#1a110a] py-4 rounded-xl font-black uppercase text-sm">Знайти</button>
              <button onClick={() => setShowManualModal(false)} className="text-[9px] opacity-30 uppercase font-black">Скасувати</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {showAddModal && (
        <div className={`fixed inset-0 bg-black/98 z-[300] flex justify-center p-6 backdrop-blur-xl transition-all duration-300 ${isFocused ? 'items-start pt-6' : 'items-center'}`}>
          <div className={`bg-[#2a1d15] p-8 rounded-[3rem] w-full max-w-sm border-2 border-[#d2b48c] shadow-2xl relative transition-transform duration-300 ${isFocused ? 'scale-95' : 'scale-100'}`}>
            <h2 className={`font-black uppercase text-[#d2b48c] text-center mb-4 italic tracking-tighter ${isFocused ? 'text-xs' : 'text-xl'}`}>Новий клієнт</h2>
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="text-[9px] opacity-40 uppercase font-bold mb-1">Реєстрація номера:</p>
                <p className="text-2xl font-black text-white tracking-tighter">{search}</p>
              </div>
              <input 
                type="text" autoFocus 
                className="w-full bg-black rounded-xl p-4 text-center text-white font-bold border border-white/10 outline-none focus:border-[#d2b48c]" 
                placeholder="Ім'я клієнта" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 py-4 rounded-xl font-bold uppercase text-[9px] text-white/50">Назад</button>
                <button onMouseDown={(e) => { e.preventDefault(); handleCreateCustomer(); }} className="flex-2 bg-[#d2b48c] text-[#1a110a] py-4 rounded-xl font-black uppercase text-[9px]">Зберегти ＋</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANIMATION +1 */}
      {showPlusOne && (
        <div className="fixed inset-0 pointer-events-none z-[500] flex items-center justify-center">
          <div className="text-[#F12F2F] text-8xl font-black italic animate-bounce drop-shadow-[0_0_20px_rgba(241,47,47,0.7)]">＋1</div>
        </div>
      )}

      {/* MODAL: FULL SCREEN QR */}
      {showQRModal && (
        <div className="fixed inset-0 bg-[#1a110a]/95 backdrop-blur-xl z-[600] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
          
          {/* Кнопка закриття */}
          <button 
            onClick={() => setShowQRModal(false)} 
            className="absolute top-10 right-8 text-[#d2b48c] active:scale-75 transition-transform"
          >
            <span className="text-5xl font-light">&times;</span>
          </button>

          <div className="w-full max-w-xs flex flex-col items-center text-center">
            <h2 className="text-3xl font-black italic uppercase text-[#d2b48c] mb-2 tracking-tighter leading-none">
              Скануй та встановлюй
            </h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] mb-10">
              WAKE UP APP • Твій прогрес
            </p>

            {/* QR CONTAINER */}
            <div className="relative group">
              {/* Декоративні куточки */}
              <div className="absolute -top-3 -left-3 w-8 h-8 border-t-4 border-l-4 border-[#d2b48c]"></div>
              <div className="absolute -top-3 -right-3 w-8 h-8 border-t-4 border-r-4 border-[#d2b48c]"></div>
              <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-4 border-l-4 border-[#d2b48c]"></div>
              <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-4 border-r-4 border-[#d2b48c]"></div>

              <div className="bg-[#d2b48c] p-3 rounded-2xl shadow-[0_0_50px_rgba(210,180,140,0.2)]">
                <img 
                  src={qrImageUrl} 
                  alt="App Download QR" 
                  className="w-64 h-64 rounded-xl shadow-inner"
                />
              </div>
            </div>

            <div className="mt-12 flex flex-col gap-4 items-center">
              <p className="text-[#d2b48c] text-xs font-black uppercase italic tracking-widest leading-relaxed">
                Відскануй камеру смартфона,<br/> щоб отримати додаток клієнта
              </p>
              
              <button 
                onClick={() => setShowQRModal(false)}
                className="mt-6 px-10 py-3 bg-[#2a1d15] border border-[#d2b48c]/30 rounded-full text-[10px] font-black uppercase tracking-widest text-[#d2b48c] active:bg-[#d2b48c] active:text-black transition-all"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BONUS MODAL */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/98 z-[400] flex flex-col p-6 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase italic text-[#d2b48c]">Бонусники</h2>
            <button onClick={() => setShowBonusModal(false)} className="text-white text-3xl leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {bonusCustomers.length === 0 ? (
                <p className="text-center opacity-20 uppercase font-black text-xs py-20">Список порожній</p>
            ) : (
                bonusCustomers.map((c, i) => (
                    <div key={i} onClick={() => { setCustomer(c); setShowBonusModal(false); }} className="bg-[#2a1d15] p-4 rounded-2xl border border-white/5 active:bg-[#d2b48c] active:text-black transition-colors group">
                      <p className="font-black uppercase italic group-active:text-black">{c.name}</p>
                      <p className="text-[10px] opacity-40 group-active:text-black">{c.phone}</p>
                    </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}