import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AdminView() {
  const [users, setUsers] = useState([]);

  const load = async () => {
    const { data } = await supabase.from('users').select('*').order('total_cups', { ascending: false });
    if (data) setUsers(data);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('admin').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  return (
    <div className="min-h-screen bg-[#1a110a] text-white p-6 flex flex-col items-center">
      <h1 className="text-2xl font-black mb-8 uppercase text-[#d2b48c]">Аналітика</h1>
      <div className="w-full max-w-md space-y-4">
        {users.map(u => (
          <div key={u.id} className="bg-[#2a1d15] p-6 rounded-[2.5rem] border border-white/5 flex justify-between">
            <div><p className="font-black">{u.name}</p><p className="text-[10px] opacity-30 italic">{u.phone}</p></div>
            <div className="text-right text-[#d2b48c] font-black">{u.total_cups} ☕</div>
          </div>
        ))}
      </div>
    </div>
  );
  
}



