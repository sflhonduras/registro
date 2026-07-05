import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import RegistroEvento1 from './pages/RegistroEvento1';
import RegistroEventoN from './pages/RegistroEventoN';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminParticipantes from './pages/AdminParticipantes';
import AdminDiplomas from './pages/AdminDiplomas';
import AdminEventos from './pages/AdminEventos';
import AdminUsuarios from './pages/AdminUsuarios';

function PublicShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicShell><Home /></PublicShell>} />
        <Route path="/registro/1" element={<PublicShell><RegistroEvento1 /></PublicShell>} />
        <Route path="/registro/:orden" element={<PublicShell><RegistroEventoN /></PublicShell>} />

        <Route path="/admin">
          <Route index element={<AdminLogin />} />
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="panel" element={<AdminDashboard />} />
            <Route path="participantes" element={<AdminParticipantes />} />
            <Route path="diplomas" element={<AdminDiplomas />} />
            <Route path="eventos" element={<AdminEventos />} />
            <Route path="usuarios" element={<ProtectedRoute rolRequerido="admin"><AdminUsuarios /></ProtectedRoute>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
