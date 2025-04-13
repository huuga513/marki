import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {FlashCardPage} from './FlashCard';
import {Home} from './Home';
import "./App.css";
function App() {
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
