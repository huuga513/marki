import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {FlashCardPage} from './FlashCard';
import {Home} from './Home';
import "./App.css";
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
function App() {
  const [initSucc, setInitSucc] = useState<Boolean>(true);
  const [reason, setReason] = useState<String>("No reason");
  useEffect(()=>{
    invoke<null>('greet')
      .catch((s:String) => {
        setReason(s);
        setInitSucc(false);
      });
  });
  if (!initSucc) {
    return (
      <h1>Failed to init, {reason}</h1>
    )
  }
  return (
    <main className="container">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flash-card-deck" element={<FlashCardPage/>} />
        </Routes>
      </BrowserRouter>
    </main>
  );
}

export default App;
