import { Link, Outlet } from 'react-router-dom';
import './rootLayout.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

const queryClient = new QueryClient();

const UserButton = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span>{user.name}</span>
      <button onClick={signOut} style={{ padding: '5px 10px', cursor: 'pointer' }}>
        Sign Out
      </button>
    </div>
  );
};

const RootLayoutContent = () => {
  const { user } = useAuth();

  return (
    <div className="rootLayout">
      <header>
        <Link to="/" className="logo">
          <img src="/logo.png" alt='' />
          <span>DDS AI</span>
        </Link>
        <div className="user">
          {user && <UserButton />}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

const RootLayout = () => {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RootLayoutContent />
      </QueryClientProvider>
    </AuthProvider>
  );
};

export default RootLayout;
