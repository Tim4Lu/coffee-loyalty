import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

export default function ClientView() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState('loading'); // 'phone', 'code', 'card'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('coffee_user');
    if (saved) {
      const localUser = JSON.parse(saved);
      setUser(localUser); // Миттєво показуємо старі дані (офлайн режим)
      setStep('card');
      refreshUserData(localUser.id); // Спробуємо оновити, якщо є інет
    } else { 
      setStep('phone'); 
    }
  }, []);

  const refreshUserData = async (id) => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (data && !error) {
        setUser(data);
        localStorage.setItem('coffee_user', JSON.stringify(data)); // Оновлюємо кеш новими бонусами
      }
    } catch (e) {
      console.log("Працюємо в офлайні");
    }
  };

  const fetchUser = async (id) => {
    const { data } = await supabase.from('users').select('*').eq('id', id).single();
    if (data) { 
      setUser(data); 
      localStorage.setItem('coffee_user', JSON.stringify(data)); // <-- ОБОВ'ЯЗКОВО ДОДАЙ ЦЕ
      setStep('card'); 
    }
    else { setStep('phone'); }
  };

  // Тут буде твоя логіка реєстрації та відправки коду в Telegram...

  if (step === 'loading') return <div className="min-h-screen bg-[#1a110a] text-white p-10 text-center">Завантаження...</div>;

  const sendTelegramCode = async (phone, code) => {
  const token = "8514861623:AAF2Tl2KnTd4xYz96wGJ1UmLzSgLzZsLcZo";
  const chatId = "7508176287";
  const message = `🔔 Нова реєстрація!\n📱 Номер: ${phone}\n🔑 Код: ${code}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (e) {
    console.error("Помилка ТГ:", e);
  }
};

return (
    <div className="min-h-screen bg-[#1a110a] text-white p-6 flex flex-col items-center justify-center select-none" translate="no">
      
      {/* 💳 КАРТКА КЛІЄНТА (Step: card) */}
      {step === 'card' && user ? (
        <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <h1 className="text-3xl font-black mb-8 text-[#d2b48c] italic uppercase tracking-tighter">Coffee Pass</h1>
          
          {/* Контейнер QR-коду (працює офлайн) */}
          <div className="bg-white p-6 rounded-[3rem] shadow-[0_0_50px_rgba(210,180,140,0.15)] mb-8 border-4 border-[#d2b48c]">
             <QRCodeSVG 
                value={user.phone} 
                size={200} 
                level="H" // Висока точність для легкого сканування
             />
          </div>
          
          <div className="text-center">
            <p className="text-3xl font-black uppercase italic tracking-tight mb-1 leading-none">{user.name}</p>
            <p className="text-[#d2b48c] font-black text-sm tracking-[0.3em] opacity-50 italic uppercase">{user.phone}</p>
          </div>

          {/* Статус бонусів (підтягується з локальної пам'яті) */}
          <div className="mt-10 bg-[#2a1d15] px-8 py-3 rounded-full border border-[#d2b48c]/20 shadow-lg">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d2b48c]">
               Бонуси: {user.progress % 7}/7 ☕️
             </p>
          </div>

          {/* Кнопка виходу (якщо треба змінити акаунт) */}
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="mt-12 text-[8px] opacity-20 uppercase font-bold tracking-[0.4em] hover:opacity-100 transition-opacity"
          >
            Вийти з профілю
          </button>
        </div>
      ) : (
        
        /* 📱 ФОРМА РЕЄСТРАЦІЇ (Step: phone/code) */
        <div className="bg-[#2a1d15] p-10 rounded-[3.5rem] w-full max-w-md border border-[#d2b48c]/10 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
           <h2 className="text-2xl font-black mb-8 uppercase text-[#d2b48c] italic tracking-tighter">Реєстрація</h2>
           
           <div className="space-y-4">
             <div className="space-y-1">
               <p className="text-[9px] uppercase font-black text-[#d2b48c]/50 ml-4 tracking-widest text-left">Ваше ім'я</p>
               <input 
                 placeholder="Введіть Ім'я" 
                 className="w-full bg-[#1a110a] p-5 rounded-2xl text-white font-bold outline-none border border-white/5 focus:border-[#d2b48c] transition-all" 
                 onChange={e => setName(e.target.value)}
               />
             </div>

             <div className="space-y-1">
               <p className="text-[9px] uppercase font-black text-[#d2b48c]/50 ml-4 tracking-widest text-left">Телефон</p>
               <input 
                 placeholder="093..." 
                 type="tel"
                 className="w-full bg-[#1a110a] p-5 rounded-2xl text-white font-bold outline-none border border-white/5 focus:border-[#d2b48c] transition-all" 
                 onChange={e => setPhone(e.target.value)}
               />
             </div>

             <button className="w-full bg-[#d2b48c] text-[#1a110a] font-black py-5 rounded-2xl uppercase italic text-lg active:scale-95 transition-transform shadow-xl mt-4">
               Отримати код
             </button>
           </div>
        </div>
      )}
    </div>
  );
}