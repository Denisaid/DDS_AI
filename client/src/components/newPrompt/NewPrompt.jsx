import { useEffect, useRef, useState, useMemo } from "react";
import { IKImage } from "imagekitio-react";
import Markdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Upload from "../upload/Upload";
import { getModel } from "../../lib/gemini";
import { getSimpleModel } from "../../lib/gemini-simple";
import { useAuth } from "../../contexts/AuthContext";
import "./newPrompt.css";

const NewPrompt = ({ data }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const endRef = useRef(null);
  const formRef = useRef(null);
  const { getToken } = useAuth();

  const queryClient = useQueryClient();

  // Create chat instance with useMemo to avoid recreating on every render
  const chat = useMemo(() => {
    if (!data) return null;
    
    // Check API key first
    const apiKey = import.meta.env.VITE_GEMINI_PUBLIC_KEY;
    if (!apiKey) {
      console.error('VITE_GEMINI_PUBLIC_KEY is not set in environment variables');
      console.error('Please create a .env file in the client folder with: VITE_GEMINI_PUBLIC_KEY=your-api-key');
      return null;
    }
    
    let modelInstance = getModel();
    if (!modelInstance) {
      console.warn('Failed to get advanced model, trying simple model...');
      modelInstance = getSimpleModel();
      if (!modelInstance) {
        console.error('Failed to get any Gemini model instance');
        console.error('API Key present:', !!apiKey, 'Length:', apiKey?.length);
        return null;
      }
    }
    
    const history = data?.history?.length > 0 
      ? data.history.map(({ role, parts }) => ({
          role,
          parts: parts?.length > 0 && parts[0]?.text ? [{ text: parts[0].text }] : [],
        }))
      : [];

    try {
      return modelInstance.startChat({
        history,
        generationConfig: {
          // maxOutputTokens: 100,
        },
      });
    } catch (error) {
      console.error('Failed to start chat:', error);
      return null;
    }
  }, [data]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data, question, answer, img.dbData]);

  const mutation = useMutation({
    mutationFn: () => {
      const token = getToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      return fetch(`${apiUrl}/api/chats/${data._id}`, {
        method: "PUT",
        credentials: "include",
        // FORMAT OF WHAT WE ARE GOING TO SEND TO THE BE
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: question.length ? question : undefined,
          answer,
          img: img.dbData?.filePath || undefined,
        }),
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Failed to update chat');
        }
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient
        // THANKS TO THIS THE NEW messages IN THE CHAT REMAIN IN DISPLAY BC THEY ARE NO LONGER prompt AND answer FROM THE AI BUT THEY ARE COMING FROM THE DB
        .invalidateQueries({ queryKey: ["chat", data._id] })
        .then(() => {
          formRef.current.reset();
          setQuestion("");
          setAnswer("");
          setImg({
            isLoading: false,
            error: "",
            dbData: {},
            aiData: {},
          });
        });
    },
    onError: (err) => {
      console.log(err);
    },
  });

  const add = async (text, isInitial) => {
    if (!chat) {
      console.error('Chat not initialized');
      setAnswer('Error: Chat not initialized. Please refresh the page.');
      return;
    }

    if (!isInitial) {
      setQuestion(text);
    }

    try {
      // Check if Gemini API key is configured
      const apiKey = import.meta.env.VITE_GEMINI_PUBLIC_KEY;
      console.log('=== AI Request Debug ===');
      console.log('API Key present:', !!apiKey);
      console.log('API Key length:', apiKey?.length);
      console.log('API Key starts with AI:', apiKey?.startsWith('AI'));
      console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
      
      if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please set VITE_GEMINI_PUBLIC_KEY in your .env file and restart the dev server.');
      }

      if (!apiKey.startsWith('AI') && apiKey.length < 20) {
        console.warn('API key format might be incorrect. Gemini API keys usually start with "AI" and are longer than 20 characters');
      }

      const messageContent = Object.entries(img.aiData).length ? [img.aiData, text] : [text];
      console.log('Sending message to AI:', text);
      console.log('Chat instance:', !!chat);
      
      setAnswer('Thinking...'); // Show loading state
      
      const result = await chat.sendMessageStream(messageContent);
      console.log('AI response received, streaming...');

      let accumulatedText = "";
      let hasReceivedChunk = false;

      try {
        for await (const chunk of result.stream) {
          hasReceivedChunk = true;
          const chunkText = chunk.text();
          console.log('AI chunk received:', chunkText);
          accumulatedText += chunkText;
          setAnswer(accumulatedText);
        }

        // Only mutate if we have an answer
        if (accumulatedText) {
          console.log('AI response complete, saving to database...');
          mutation.mutate();
        } else if (!hasReceivedChunk) {
          console.warn('No chunks received from AI stream');
          setAnswer('Sorry, I did not receive a response. The AI model might not be available. Please check your API key.');
        } else {
          console.warn('Received chunks but no text content');
          setAnswer('Sorry, I did not receive a valid response. Please try again.');
        }
      } catch (streamError) {
        console.error('Error reading stream:', streamError);
        if (accumulatedText) {
          // We got some text, save it
          mutation.mutate();
        } else {
          throw streamError; // Re-throw to be caught by outer catch
        }
      }
    } catch (err) {
      console.error('=== AI Error Details ===');
      console.error('Error message:', err.message);
      console.error('Error name:', err.name);
      console.error('Error stack:', err.stack);
      console.error('Full error object:', err);
      
      let errorMessage = 'Failed to get response from AI.\n\n';
      
      // More specific error handling
      const errorMsg = err.message || '';
      const errorStr = JSON.stringify(err);
      
      if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('is not found') || errorStr.includes('404')) {
        errorMessage += '❌ The AI model is not available.\n\n';
        errorMessage += 'Possible causes:\n';
        errorMessage += '1. Your API key might not have access to Gemini models\n';
        errorMessage += '2. The model name might be incorrect for your API key\n';
        errorMessage += '3. Your API key might be expired or invalid\n\n';
        errorMessage += 'Solutions:\n';
        errorMessage += '• Get a new API key from: https://makersuite.google.com/app/apikey\n';
        errorMessage += '• Make sure VITE_GEMINI_PUBLIC_KEY is set in .env file\n';
        errorMessage += '• Restart your dev server after changing .env\n';
        errorMessage += '• Check console for detailed error messages';
      } else if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401') || errorMsg.includes('403') || errorStr.includes('401') || errorStr.includes('403')) {
        errorMessage += '❌ Invalid or unauthorized API key.\n\n';
        errorMessage += 'Please:\n';
        errorMessage += '1. Verify your API key at https://makersuite.google.com/app/apikey\n';
        errorMessage += '2. Make sure VITE_GEMINI_PUBLIC_KEY is set correctly in .env file\n';
        errorMessage += '3. Restart your dev server after changing .env\n';
        errorMessage += '4. Check that your API key starts with "AI"';
      } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit') || errorStr.includes('quota')) {
        errorMessage += '❌ API quota exceeded or rate limit reached.\n\n';
        errorMessage += 'Please try again later or check your API quota.';
      } else {
        errorMessage += `❌ Error: ${errorMsg || 'Unknown error'}\n\n`;
        errorMessage += 'Please check:\n';
        errorMessage += '1. Your internet connection\n';
        errorMessage += '2. Your API key is valid\n';
        errorMessage += '3. Browser console for more details';
      }
      
      setAnswer(errorMessage);
      
      // Still try to save the question even if AI failed
      if (question) {
        mutation.mutate();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const text = e.target.text.value;
    if (!text) {
      return;
    }

    add(text, false);
  };

  // IN PRODUCTION WE DON'T NEED IT
  // THE useEffect BELOW IS GOING TO BE RUN TWICE,THIS OCCURS BC IN development WE ARE USING <strict mode> AND MAKES YOUR app RUN TWICE, TO PREVENT THIS WE USE THIS useRef
  // WE ALSO HAVE TO USE IT BC WE ARE USING streaming IN OUR AI MODEL
  const hasRun = useRef(false);

  // WHEN WE START A NEW chat FROM dashboardPage AND WE HIT enter THE AI DOESN'T RESPOND BC WE ONLY TRIGGER OUR function ONLY WHEN WE SUBMIT THE chatPage form
  useEffect(() => {
    if (!hasRun.current && chat) {
      // WHEN VERIFY IF WE ONLY HAVE ONE message IN THE CHAT THAT MEANS IT IS ONLY THE user's prompt, THEN WE CAN GENERATE OUR ANSWER AND SEND IT TO THE DB, THAT IS WHY WE IMPLEMENT isInitial
      if (data?.history?.length === 1) {
        const firstMessage = data.history[0];
        if (firstMessage?.parts?.[0]?.text) {
          add(firstMessage.parts[0].text, true);
        }
      }
    }
    hasRun.current = true;
  }, [chat, data]);

  return (
    <>
      {/* ADD NEW CHAT */}
      {img.isLoading && <div className="">Loading...</div>}
      {img.dbData?.filePath && (
        <IKImage
          urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
          path={img.dbData?.filePath}
          width="380"
          transformation={[{ width: 380 }]}
        />
      )}

      {question && <div className="message user">{question}</div>}
      {answer && (
        <div className="message">
          {answer.startsWith('Error:') ? (
            <div style={{ color: 'red' }}>{answer}</div>
          ) : (
            <Markdown>{answer}</Markdown>
          )}
        </div>
      )}

      <div className="endChat" ref={endRef}></div>
      
      <form className="newForm" onSubmit={handleSubmit} ref={formRef}>
        <Upload setImg={setImg} />

        <input id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Ask anything..." />
        
        <button>
          <img src="/arrow.png" alt="" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;