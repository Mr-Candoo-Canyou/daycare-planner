import { Outlet, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();

  const getNavLinks = () => {
    if (!user) return [];

    switch (user.role) {
      case 'parent':
        return [
          { to: '/parent/dashboard', label: 'Dashboard' },
          { to: '/parent/apply', label: 'New Application' }
        ];
      case 'daycare_admin':
        return [
          { to: '/daycare/dashboard', label: 'Waitlist' }
        ];
      case 'funder':
        return [
          { to: '/funder/dashboard', label: 'Reports' }
        ];
      default:
        return [];
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--primary-color)',
        color: 'white',
        padding: '1rem 0',
        boxShadow: 'var(--shadow)'
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Daycare Planner</h1>

          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {getNavLinks().map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                {link.label}
              </Link>
            ))}

            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '1.5rem' }}>
              <span style={{ marginRight: '1rem' }}>
                {user?.firstName} {user?.lastName}
              </span>
              <button
                onClick={() => logout()}
                style={{
                  background: 'transparent',
                  border: '1px solid white',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer style={{
        background: 'var(--bg-secondary)',
        padding: '1rem 0',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        color: 'var(--text-light)'
      }}>
        <div className="container">
          <p style={{ margin: 0 }}>
            Privacy-focused daycare waitlist management system
          </p>
        </div>
      </footer>
    </div>
  );
}
