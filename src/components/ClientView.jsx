import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; 
import { QRCodeSVG } from 'qrcode.react';

export default function ClientView() {
  const [user, setUser] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [step, setStep] = useState('loading');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(''); 
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  
  // Новий стейт для побажання
  const [dailyWish, setDailyWish] = useState("Завантажуємо бадьорість...");

  // 1. Визначення типу пристрою
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (ios && !isStandalone) setIsIOS(true);
    if (android && !isStandalone) setIsAndroid(true);
  }, []);

  // 2. Завантаження побажань (GitHub + LocalStorage)
  useEffect(() => {
    const RAW_URL = "https://raw.githubusercontent.com/ТВОЙ_ЛОГИН/ТВОЙ_РЕПО/main/wishes.json";

    const pickWish = (list) => {
      if (!list || list.length === 0) return;
      const today = new Date();
      // Хеш дати, щоб побажання було стабільним протягом 24 годин
      const dateHash = today.getFullYear() + (today.getMonth() + 1) + today.getDate();
      setDailyWish(list[dateHash % list.length]);
    };

    const loadWishes = async () => {
      try {
        const response = await fetch(RAW_URL);
        const freshWishes = await response.json();
        localStorage.setItem('cached_wishes', JSON.stringify(freshWishes));
        pickWish(freshWishes);
      } catch (error) {
        const cached = localStorage.getItem('cached_wishes');
        if (cached) {
          pickWish(JSON.parse(cached));
        } else {
          setDailyWish("Wake up. Drink coffee. Be awesome! ☕️");
        }
      }
    };

    loadWishes();
  }, []);

  // 3. Налаштування PWA для Android
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 4. Перевірка сесії
  useEffect(() => {
    const checkSession = async () => {
      const saved = localStorage.getItem('coffee_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUser(parsed); 
          setStep('card');
          if (navigator.onLine) initClient(parsed.phone);
        } catch (e) { setStep('phone'); }
      } else { setStep('phone'); }
    };
    checkSession();
  }, []);

  const initClient = async (phoneStr) => {
    if (!phoneStr) return;
    try {
      const { data } = await supabase.from('users').select('*').eq('phone', phoneStr.trim()).maybeSingle();
      if (data) {
        setUser(data);
        localStorage.setItem('coffee_user', JSON.stringify(data));
        setStep('card');
        const channel = supabase.channel(`user-${data.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${data.id}` },
            (payload) => {
              setUser(payload.new);
              localStorage.setItem('coffee_user', JSON.stringify(payload.new));
            }
          ).subscribe();
        return () => supabase.removeChannel(channel);
      }
    } catch (e) { console.log("Offline mode active"); }
  };

  const handleGetCode = async () => {
    if (!phone || !name) return alert("Заповніть поля");
    setLoading(true);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(code);
    try {
      await fetch(`https://api.telegram.org/bot8514861623:AAF2Tl2KnTd4xYz96wGJ1UmLzSgLzZsLcZo/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: "7508176287", 
          text: `🆕 РЕЄСТРАЦІЯ\n👤 Ім'я: ${name}\n📱 Номер: ${phone}\n🔑 КОД: ${code}`
        })
      });
      setStep('code');
    } catch (e) { alert("Помилка зв'язку з сервером"); } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (otp !== generatedCode) return alert("Невірний код");
    setLoading(true);
    try {
      const cleanPhone = phone.trim();
      const { data: ex } = await supabase.from('users').select('*').eq('phone', cleanPhone).maybeSingle();
      let currUser = ex;
      if (!ex) {
        const { data: nw, error } = await supabase.from('users').insert([{ name, phone: cleanPhone, progress: 0, total_cups: 0 }]).select().single();
        if (error) throw error;
        currUser = nw;
      }
      localStorage.setItem('coffee_user', JSON.stringify(currUser));
      setUser(currUser);
      setStep('card');
      initClient(currUser.phone);
    } catch (err) { alert("Помилка реєстрації"); } finally { setLoading(false); }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  if (step === 'loading') {
    return <div className="min-h-screen bg-[#1a110a] flex items-center justify-center text-[#d2b48c] font-black uppercase italic text-xl">Wake Up...</div>;
  }

  const bonuses = user ? Math.floor(user.progress / 7) : 0;
  const progressInCycle = user ? user.progress % 7 : 0;

  return (
    <div className="min-h-screen bg-transparent text-white p-4 flex flex-col items-center justify-center font-sans overflow-x-hidden">
      
      {step === 'card' && user ? (
        <div className="w-full max-w-sm flex flex-col items-center text-center my-auto animate-in fade-in zoom-in duration-500">
          
          {isAndroid && installPrompt && (
            <button onClick={handleInstall} className="mb-6 bg-white text-black px-6 py-2 rounded-full font-bold text-[10px] uppercase animate-bounce shadow-lg">Встановити на Android 📱</button>
          )}

          <h1 className="text-2xl sm:text-3xl font-black mb-6 text-[#d2b48c] italic uppercase tracking-tighter">Wake Up Coffee</h1>
          
          <div className="bg-white p-4 rounded-3xl shadow-2xl mb-6 border-4 border-[#2a1d15] flex items-center justify-center overflow-hidden w-40 h-40 sm:w-48 sm:h-48">
             <QRCodeSVG value={user.phone.trim()} size={180} level="H" style={{ height: "100%", width: "100%" }} bgColor="#ffffff" fgColor="#000000" />
          </div>

          <p className="text-xl font-black uppercase mb-0.5">{user.name}</p>
          <p className="opacity-30 font-mono text-[9px] tracking-[0.3em] mb-8">{user.phone}</p>
          
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-8">
            {[...Array(8)].map((_, i) => {
              const isGift = i === 7;
              const isActive = (!isGift && i < progressInCycle);
              const hasBonus = isGift && bonuses > 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${ (isActive || hasBonus) ? "bg-[#2a1d15] border-white/40 shadow-inner" : "bg-white/5 border-white/5" }`}>
                    {isGift ? <span className={`text-xl sm:text-2xl ${hasBonus ? "animate-bounce" : "opacity-10 grayscale"}`}>🎁</span> : <span className={`text-xl sm:text-2xl transition-transform duration-300 ${isActive ? "scale-110" : "opacity-10 grayscale scale-90"}`}>☕️</span>}
                  </div>
                  {!isGift && <span className={`text-[8px] sm:text-[9px] font-black italic uppercase tracking-widest ${isActive ? "text-white" : "text-white/20"}`}>{i + 1}</span>}
                </div>
              );
            })}
          </div>

          {bonuses > 0 && (
            <div className="w-full bg-[#d2b48c] text-[#1a110a] p-4 rounded-[2rem] mb-5 shadow-xl border-2 border-white/20 animate-in slide-in-from-bottom-4">
              <p className="text-[8px] uppercase font-black opacity-60 tracking-widest mb-0.5">Бонусний рахунок</p>
              <p className="text-base sm:text-lg font-black uppercase tracking-tighter">{bonuses} Безкоштовні кави ☕️</p>
            </div>
          )}

          {/* Блок з побажанням дня */}
          <div className="w-full bg-[#2a1d15]/30  p-3 rounded-[2.5rem] border border-white/10 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase font-black text-[#d2b48c] opacity-60 tracking-[0.3em] mb-3">Твоє натхнення сьогодні</span>
              <p className="text-lg sm:text-base font-regular italic leading-tight text-[#FCFBFB]/90">« {dailyWish} »</p>
            </div>
          </div>

          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="mt-12 opacity-20 text-[9px] uppercase font-black tracking-[0.3em] hover:opacity-100 transition-opacity">Вийти з акаунту</button>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center my-auto">
           {step === 'phone' ? (
             <div className="bg-[#2a1d15] p-6 sm:p-10 rounded-[2.5rem] w-full border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
               <h2 className="text-xl font-black mb-8 uppercase text-[#d2b48c] italic text-center tracking-tighter">Твій бонусний хаб</h2>
               <div className="space-y-4">
                 <input placeholder="Твоє ім'я" className="w-full bg-[#1a110a] p-4 rounded-2xl text-white text-center font-bold outline-none border border-white/5 focus:border-[#d2b48c]" value={name} onChange={e => setName(e.target.value)} />
                 <input placeholder="Номер телефону" type="tel" className="w-full bg-[#1a110a] p-4 rounded-2xl text-white text-center font-bold outline-none border border-white/5 focus:border-[#d2b48c]" value={phone} onChange={e => setPhone(e.target.value)} />
                 <button onClick={handleGetCode} disabled={loading} className="w-full bg-[#d2b48c] text-[#1a110a] font-black py-5 rounded-2xl uppercase tracking-[0.15em] active:scale-[0.98] shadow-lg text-xs disabled:opacity-50">{loading ? "Зачекайте..." : "Отримати код"}</button>
               </div>
             </div>
           ) : (
             <div className="bg-[#2a1d15] p-6 sm:p-10 rounded-[2.5rem] w-full border border-white/5 shadow-2xl text-center animate-in zoom-in-95 duration-300">
               <h2 className="text-xl font-black mb-4 uppercase text-[#d2b48c] italic tracking-tight">Підтвердження</h2>
               <div className="bg-[#d2b48c]/10 border border-[#d2b48c]/20 p-4 rounded-2xl mb-8"><p className="text-[10px] text-[#d2b48c] uppercase font-black leading-tight tracking-wider">☕️ Код у баристи <br/> <span className="opacity-60 font-medium">Він уже на планшеті</span></p></div>
               <input placeholder="****" maxLength={4} type="tel" autoFocus value={otp} className="w-full bg-[#1a110a] p-4 rounded-2xl mb-8 text-white text-center text-4xl font-black tracking-[0.4em] outline-none border border-white/5 focus:border-[#d2b48c]" onChange={e => setOtp(e.target.value)} />
               <button onClick={handleVerify} disabled={loading} className="w-full bg-[#d2b48c] text-[#1a110a] font-black py-5 rounded-2xl uppercase tracking-widest active:scale-95 shadow-lg text-xs disabled:opacity-50">{loading ? "Перевірка..." : "Увійти"}</button>
               <button onClick={() => setStep('phone')} className="mt-8 text-[9px] uppercase opacity-30 font-bold tracking-[0.2em] italic hover:opacity-100 transition-opacity">← Змінити номер</button>
             </div>
           )}
        </div>
      )}

      {isIOS && (
        <div className="fixed top-6 left-4 right-4 z-[999] max-w-sm mx-auto animate-in slide-in-from-top-full duration-700">
          <div className="bg-white text-[#1a110a] p-6 rounded-[2rem] shadow-2xl border-2 border-[#d2b48c] text-center">
            <p className="text-[11px] font-black uppercase mb-2 tracking-tight">Встановити на iPhone 📱</p>
            <p className="text-[10px] leading-relaxed opacity-80 mb-5 px-4">Натисни <span className="font-black underline decoration-[#d2b48c] decoration-2">«Поділитися»</span> та обери <span className="font-black underline decoration-[#d2b48c] decoration-2">«Додати на початковий екран»</span></p>
            <button onClick={() => setIsIOS(false)} className="w-full bg-[#1a110a] text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform">Зрозуміло</button>
          </div>
        </div>
      )}
    </div>
  );
}