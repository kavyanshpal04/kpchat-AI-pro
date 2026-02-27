import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, User as UserIcon, Bot, Loader2, Sparkles, Menu, Plus, 
  MessageSquare, Trash2, Settings, Moon, Sun, Mic, Volume2, VolumeX, X, LogOut
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage } from './services/geminiService';
import { Auth } from './components/Auth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { User, Chat, Message } from './types';

const MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
];

export default function App() {
  const [user, setUser] = useLocalStorage<User | null>('kpchat_current_user', null);
  const [chats, setChats] = useLocalStorage<Chat[]>('kpchat_history', []);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings state
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('kpchat_theme', 'light');
  const [selectedModel, setSelectedModel] = useLocalStorage<string>('kpchat_model', 'gemini-3-flash-preview');
  const [voiceEnabled, setVoiceEnabled] = useLocalStorage<boolean>('kpchat_voice', false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Setup Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInput((prev) => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Could not start speech recognition:", e);
      }
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Remove markdown symbols for better speech
    const cleanText = text.replace(/[#*_~`]/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const currentChat = chats.find(c => c.id === currentChatId);
  const messages = currentChat?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setChats([newChat, ...chats]);
    setCurrentChatId(newChat.id);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Ensure there's always a chat selected if possible
  useEffect(() => {
    if (user && chats.length > 0 && !currentChatId) {
      setCurrentChatId(chats[0].id);
    } else if (user && chats.length === 0) {
      createNewChat();
    }
  }, [user, chats, currentChatId]);

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== id);
    setChats(updatedChats);
    if (currentChatId === id) {
      setCurrentChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !currentChatId || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now()
    };

    // Update chat with user message
    const updatedChats = chats.map(chat => {
      if (chat.id === currentChatId) {
        // Generate title from first message if it's a new chat
        const title = chat.messages.length === 0 
          ? userMessage.text.slice(0, 30) + (userMessage.text.length > 30 ? '...' : '')
          : chat.title;
          
        return {
          ...chat,
          title,
          messages: [...chat.messages, userMessage],
          updatedAt: Date.now()
        };
      }
      return chat;
    });
    
    setChats(updatedChats);
    setInput('');
    setIsLoading(true);

    try {
      const history = currentChat?.messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
      })) || [];

      const responseText = await sendMessage(userMessage.text, history, selectedModel);
      
      if (responseText) {
          const modelMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: Date.now()
          };
          
          setChats(prev => prev.map(chat => {
            if (chat.id === currentChatId) {
              return {
                ...chat,
                messages: [...chat.messages, modelMessage],
                updatedAt: Date.now()
              };
            }
            return chat;
          }));
          
          speakText(responseText);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Sorry, I encountered an error processing your request.',
        timestamp: Date.now()
      };
      
      setChats(prev => prev.map(chat => {
        if (chat.id === currentChatId) {
          return {
            ...chat,
            messages: [...chat.messages, errorMessage],
            updatedAt: Date.now()
          };
        }
        return chat;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    setUser(null);
    setChats([]);
    setCurrentChatId(null);
  };

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className={`flex h-screen transition-colors duration-200 ${theme === 'dark' ? 'bg-[#131314] text-gray-100' : 'bg-white text-gray-900'} font-sans overflow-hidden`}>
      
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        flex flex-col w-[280px] transition-transform duration-300 ease-in-out
        ${theme === 'dark' ? 'bg-[#1e1f20] border-gray-800' : 'bg-gray-50 border-gray-200'}
        border-r
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={createNewChat}
            className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-full transition-colors font-medium text-sm
              ${theme === 'dark' ? 'bg-[#282a2c] hover:bg-[#333537]' : 'bg-white border border-gray-200 hover:bg-gray-50 shadow-sm'}
            `}
          >
            <Plus size={18} />
            New chat
          </button>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden ml-2 p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 px-2 uppercase tracking-wider">
            Recent Chats
          </div>
          {chats.length > 0 ? (
            chats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => {
                  setCurrentChatId(chat.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer group transition-colors
                  ${currentChatId === chat.id 
                    ? (theme === 'dark' ? 'bg-[#282a2c] text-white' : 'bg-blue-50 text-blue-700 font-medium') 
                    : (theme === 'dark' ? 'hover:bg-[#282a2c] text-gray-300' : 'hover:bg-gray-100 text-gray-700')}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className={currentChatId === chat.id ? (theme === 'dark' ? 'text-white' : 'text-blue-600') : 'text-gray-400'} />
                  <span className="truncate">{chat.title}</span>
                </div>
                <button 
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500 italic">No recent chats</div>
          )}
        </div>
        
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium truncate">{user.name}</span>
                <span className="text-xs text-gray-500 truncate">{user.email}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between p-4 md:px-6 z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 -ml-2 rounded-full transition-colors
                ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-black hover:bg-gray-100'}
              `}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-medium flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 font-semibold tracking-tight">
                KPchat
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}
              `}>
                {MODELS.find(m => m.id === selectedModel)?.name || 'Advanced'}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`p-2 rounded-full transition-colors
                ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-black hover:bg-gray-100'}
              `}
            >
              <Settings size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm md:hidden">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-32">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto text-center px-4">
              <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-red-500">
                  Hello, {user.name.split(' ')[0]}
                </span>
              </h2>
              <p className={`text-lg md:text-xl max-w-2xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                How can I help you today? I am KPchat, created by Kavyansh Pal.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-2xl">
                {[
                  "Who created you?",
                  "Write a poem about coding",
                  "Explain quantum computing",
                  "Help me plan a trip"
                ].map((suggestion, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className={`p-4 rounded-xl text-left transition-colors flex items-center justify-between group border
                      ${theme === 'dark' 
                        ? 'bg-[#1e1f20] hover:bg-[#282a2c] border-gray-800 text-gray-300' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-sm'}
                    `}
                  >
                    <span className="text-sm font-medium">{suggestion}</span>
                    <Send size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pt-6 pb-6 space-y-8">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center mt-1 shadow-sm">
                      <Sparkles size={16} className="text-white" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' && (
                      <span className="text-xs font-medium text-gray-500 mb-1 px-1">{user.name}</span>
                    )}
                    
                    <div className={`
                      ${msg.role === 'user' 
                        ? (theme === 'dark' ? 'bg-[#282a2c] text-white' : 'bg-blue-600 text-white') + ' px-5 py-3.5 rounded-3xl rounded-tr-sm shadow-sm' 
                        : 'pt-1'}
                    `}>
                      {msg.role === 'user' ? (
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <div className={`prose prose-p:leading-relaxed max-w-none text-[15px]
                          ${theme === 'dark' 
                            ? 'prose-invert prose-pre:bg-[#1e1f20] prose-pre:border-gray-800' 
                            : 'prose-gray prose-pre:bg-gray-50 prose-pre:border-gray-200'}
                          prose-pre:border
                        `}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center mt-1 animate-pulse shadow-sm">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div className="pt-2 flex items-center gap-2 text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">KPchat is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Area */}
        <div className={`absolute bottom-0 left-0 right-0 pt-10 pb-6 px-4 md:px-8 bg-gradient-to-t 
          ${theme === 'dark' ? 'from-[#131314] via-[#131314] to-transparent' : 'from-white via-white to-transparent'}
        `}>
          <div className="max-w-3xl mx-auto relative">
            <div className={`relative flex items-end rounded-3xl border transition-all shadow-lg
              ${theme === 'dark' 
                ? 'bg-[#1e1f20] border-gray-700 focus-within:border-gray-500 focus-within:bg-[#282a2c]' 
                : 'bg-white border-gray-300 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50'}
            `}>
              <button
                onClick={toggleListening}
                className={`absolute left-3 bottom-2.5 p-2 rounded-full transition-colors
                  ${isListening 
                    ? 'bg-red-100 text-red-500 animate-pulse' 
                    : (theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100')}
                `}
                title="Speech to text"
              >
                <Mic size={20} />
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Ask KPchat..."}
                className={`w-full max-h-48 min-h-[56px] bg-transparent resize-none py-4 pl-14 pr-14 focus:outline-none rounded-3xl
                  ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}
                `}
                rows={1}
                style={{ height: 'auto' }}
              />
              
              <div className="absolute right-3 bottom-2.5">
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`p-2 rounded-full transition-colors
                    ${input.trim() && !isLoading
                      ? (theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md')
                      : (theme === 'dark' ? 'bg-transparent text-gray-600' : 'bg-transparent text-gray-300')}
                  `}
                >
                  <Send size={18} className={input.trim() && !isLoading ? "ml-0.5" : ""} />
                </button>
              </div>
            </div>
            <div className="text-center mt-3 text-xs text-gray-500">
              KPchat may display inaccurate info, including about people, so double-check its responses.
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden
            ${theme === 'dark' ? 'bg-[#1e1f20] text-gray-100 border border-gray-800' : 'bg-white text-gray-900'}
          `}>
            <div className={`flex justify-between items-center p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings size={20} />
                Settings
              </h2>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className={`p-1 rounded-full ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Theme</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Choose your preferred appearance</p>
                </div>
                <div className={`flex p-1 rounded-lg ${theme === 'dark' ? 'bg-[#131314]' : 'bg-gray-100'}`}>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${theme === 'light' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    <Sun size={16} /> Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${theme === 'dark' ? 'bg-[#282a2c] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}
                    `}
                  >
                    <Moon size={16} /> Dark
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <div>
                  <h3 className="font-medium">AI Model</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Select the Gemini model to use</p>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border outline-none transition-colors
                    ${theme === 'dark' 
                      ? 'bg-[#131314] border-gray-700 text-white focus:border-gray-500' 
                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
                  `}
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Voice Chat Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Voice Responses</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Read AI responses aloud</p>
                </div>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${voiceEnabled ? 'bg-blue-500' : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300')}
                  `}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${voiceEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `} />
                </button>
              </div>
            </div>
            
            <div className={`p-4 border-t flex justify-end ${theme === 'dark' ? 'border-gray-800 bg-[#131314]' : 'border-gray-200 bg-gray-50'}`}>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
