import React, { useState } from 'react';
import { Sparkles, User as UserIcon, Mail, Lock } from 'lucide-react';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all fields');
      return;
    }

    const users = JSON.parse(localStorage.getItem('kpchat_users') || '[]');
    
    if (isLogin) {
      const user = users.find((u: any) => u.email === email && u.password === password);
      if (user) {
        onLogin({ id: user.id, name: user.name, email: user.email });
      } else {
        setError('Invalid email or password');
      }
    } else {
      if (users.some((u: any) => u.email === email)) {
        setError('Email already exists');
        return;
      }
      const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password
      };
      localStorage.setItem('kpchat_users', JSON.stringify([...users, newUser]));
      onLogin({ id: newUser.id, name: newUser.name, email: newUser.email });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#131314] text-gray-900 dark:text-gray-100 p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-[#1e1f20] rounded-3xl shadow-xl p-8 border border-gray-200 dark:border-gray-800 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-red-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-red-500">
            Welcome to KPchat
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {isLogin ? 'Sign in to continue' : 'Create an account to get started'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserIcon size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-[#282a2c] border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-[#1e1f20] focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>
          )}
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail size={18} className="text-gray-400" />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-[#282a2c] border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-[#1e1f20] focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={18} className="text-gray-400" />
            </div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-[#282a2c] border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-[#1e1f20] focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-purple-500 hover:text-purple-600 font-medium transition-colors"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
