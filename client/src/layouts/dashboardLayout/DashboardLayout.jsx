import { Outlet, useNavigate } from 'react-router-dom';
import './dashboardLayout.css';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect } from 'react';
import ChatList from '../../components/chatList/ChatList';

const DashboardLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/sign-in');
    }
  }, [loading, user, navigate]);

  if (loading) return "Loading...";
  if (!user) return null;

  return (
    <div className="dashboardLayout">
      <div className="menu"><ChatList/></div>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
