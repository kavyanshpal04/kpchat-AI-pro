export type User = {
  id: string;
  name: string;
  email: string;
};

export type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
