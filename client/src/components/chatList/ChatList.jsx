import { Link } from 'react-router-dom';
import './chatList.css';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

const ChatList = () => {
  const { getToken } = useAuth();

  const { isPending, error, data } = useQuery({
    queryKey: ['userChats'],
    queryFn: async () => {
      const token = getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load chats: ${response.status} ${errorText}`);
      }

      return response.json();
    }
  });

  return (
    <div className="chatList">
      <span className="title">DASHBOARD</span>
      <Link to="/dashboard">Create a new Chat</Link>
      <Link to="/">Explore DDS AI</Link>
      <Link to="/">Contact</Link>
      <hr />
      <span className="title">RECENT CHATS</span>
      <div className="list">
        {isPending
          ? 'Loading...'
          : error
          ? (
              <div style={{ color: 'red', padding: '10px' }}>
                Error loading chats: {error.message}
              </div>
            )
          : data?.length === 0
          ? 'No chats yet'
          : data?.map((chat) => (
              <Link to={`/dashboard/chats/${chat._id}`} key={chat._id}>
                {chat.title}
              </Link>
            ))}
      </div>
      <hr />
      <div className="upgrade">
        <img src="/logo.png" alt='' />
        <div className="texts">
          <span>Upgrade to DDS AI Pro</span>
          <span>Get unlimited access to all features</span>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
