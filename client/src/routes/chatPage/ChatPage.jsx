import './chatPage.css';
import NewPrompt from '../../components/newPrompt/NewPrompt';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import Markdown from 'react-markdown';
import { IKImage } from 'imagekitio-react';
import { useAuth } from '../../contexts/AuthContext';

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split('/').pop();
  const { getToken } = useAuth();

  const { isPending, error, data } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => {
      const token = getToken();
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch chat');
        }
        return res.json();
      });
    },
  });

   console.log(data);

  return (
    <div className="chatPage">
      <div className="wrapper">
        <div className="chat">
          {isPending
            ? 'Loading...'
            : error
            ? 'Something went wrong!'
            : data?.history?.map((message, i) => (
                <div key={i}>
                  {message.img && (
                    <IKImage
                      urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                      path={message.img}
                      height="300"
                      width="400"
                      transformation={[{ height: 300, width: 400 }]}
                      loading="lazy"
                      lqip={{ active: true, quality: 20 }}
                    />
                  )}
                  <div
                    className={
                      message.role === 'user' ? 'message user' : 'message'
                    }
                  >
                    <Markdown>{message.parts[0].text}</Markdown>
                  </div>
                </div>
              ))}

          {data && <NewPrompt data={data}/>}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;