import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="no-print border-b border-rune">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="font-display text-2xl tracking-wide">
          Lectur<span className="text-amber">AI</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to="/library" className="hover:text-amber">My library</Link>
              <span className="hidden text-dust sm:inline">{user.name}</span>
              <button className="btn !py-1" onClick={() => { logout(); nav('/'); }}>Log out</button>
            </>
          ) : (
            <Link to="/login" className="btn !py-1">Log in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
