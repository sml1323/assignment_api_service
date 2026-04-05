import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CreateEvent from './pages/CreateEvent';
import Contribute from './pages/Contribute';
import Dashboard from './pages/Dashboard';
import BookPreview from './pages/BookPreview';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-50">
        <Routes>
          <Route path="/" element={<CreateEvent />} />
          <Route path="/contribute/:shareCode" element={<Contribute />} />
          <Route path="/dashboard/:shareCode" element={<Dashboard />} />
          <Route path="/preview/:shareCode" element={<BookPreview />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
