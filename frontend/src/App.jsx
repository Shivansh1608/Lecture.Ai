import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Landing from './pages/Landing.jsx';
import Result from './pages/Result.jsx';
import Library from './pages/Library.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './lib/auth.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-8 text-dust caret">loading</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/library" element={<Private><Library /></Private>} />
          <Route path="/lecture/:id" element={<Private><Result /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
