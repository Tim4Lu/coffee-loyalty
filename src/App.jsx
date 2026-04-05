import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientView from './components/ClientView.jsx';
import BaristaView from './components/BaristaView.jsx';
import AdminView from './components/AdminView.jsx';
import ProtectedView from './components/ProtectedView.jsx';

export default function App() {
  return (
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
  );
}