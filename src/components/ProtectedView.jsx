import React, { useState } from 'react';

const PASSWORDS = { 
  admin: "1111", 
  barista: "0000" 
};

function ProtectedView({ children, type }) {
  const [isAuth, setIsAuth] = useState(() => {
    return localStorage.getItem(`auth_${type}`) === 'true';
  });
  const [pass, setPass] = useState("");

  const handleLogin = () => {
    if (pass === PASSWORDS[type]) {
      localStorage.setItem(`auth_${type}`, 'true');
      setIsAuth(true);
    } else {
      alert("Невірний пароль!");
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#1a110a] flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-[#2a1d15] p-8 rounded-[2.5rem] w-full max-w-sm border border-white/5 shadow-2xl text-center">
          <h2 className="text-2xl font-black mb-2 uppercase italic text-[#d2b48c]">Вхід</h2>
          <p className="text-[10px] opacity-40 uppercase tracking-widest mb-8">Доступ для: {type}</p>
          
          <input 
            type="password" 
            placeholder="Пароль" 
            className="w-full bg-[#1a110a] border-none rounded-2xl p-4 mb-4 text-center text-xl font-bold text-white focus:ring-2 focus:ring-[#d2b48c] outline-none"
            onChange={e => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          
          <button 
            onClick={handleLogin}
            className="w-full bg-[#d2b48c] text-[#1a110a] font-black py-4 rounded-2xl uppercase tracking-widest active:scale-95 transition-all shadow-lg"
          >
            Увійти
          </button>
        </div>
      </div>
    );
  }

  return children;
}

// ПЕРЕВІР ЦЕЙ РЯДОК:
export default ProtectedView;