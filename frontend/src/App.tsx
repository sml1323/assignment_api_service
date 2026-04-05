import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import CreateTrip from './pages/CreateTrip';
import TripAdmin from './pages/TripAdmin';
import JoinTrip from './pages/JoinTrip';
import Contribute from './pages/Contribute';
import BookPreview from './pages/BookPreview';
import OrderPage from './pages/OrderPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateTrip />} />
          <Route path="/trip/:tripId/admin" element={<TripAdmin />} />
          <Route path="/join/:token" element={<JoinTrip />} />
          <Route path="/trip/:tripId/contribute" element={<Contribute />} />
          <Route path="/trip/:tripId/preview" element={<BookPreview />} />
          <Route path="/trip/:tripId/order" element={<OrderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
