import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Home', to: '/' },
    { label: 'Create Darbar', to: '/create' },
    { label: 'Join Darbar', to: '/join' },
    { label: 'Dashboard', to: '/dashboard' },
  ];

  const handlePrimaryAction = async () => {
    if (user) {
      await logout();
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  return (
    <header className="w-full border-b border-[#E8DEC8] bg-[#FAF5EC]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-[#1D0E30] whitespace-nowrap shrink-0"
        >
          SOHBAT
        </Link>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A3B5C]">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1D0E30] ${
                  active ? 'text-[#1D0E30] underline underline-offset-4 decoration-[#E59819] decoration-2' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="px-4 py-2 rounded-lg bg-[#1D0E30] text-[#FAF5EC] text-xs font-semibold hover:bg-[#2B1547] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user ? 'Sign Out' : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Mobile compact secondary nav row */}
      <nav className="md:hidden flex items-center justify-around border-t border-[#E8DEC8] px-4 py-2 text-xs font-medium text-[#4A3B5C]">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`whitespace-nowrap shrink-0 py-1 ${
                active ? 'text-[#1D0E30] font-semibold' : ''
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
