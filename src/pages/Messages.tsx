import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { Send, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['conversations']['Row'] & {
  conversation_participants: Array<{
    user_id: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  }>;
  messages: Array<Database['public']['Tables']['messages']['Row'] & {
    sender: {
      full_name: string;
      avatar_url: string | null;
    };
  }>;
};

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: {
    full_name: string;
    avatar_url: string | null;
  };
};

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    fetchConversations();
    
    // Subscribe to real-time message updates
    const messagesChannel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as Database['public']['Tables']['messages']['Row'];
          if (newMessage.conversation_id === selectedConversation) {
            // Fetch the complete message with sender info
            fetchMessage(newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [user, selectedConversation]);

  const fetchMessage = async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
      `)
      .eq('id', messageId)
      .single();

    if (error) {
      console.error('Error fetching message:', error);
      return;
    }

    setMessages(prev => [...prev, data as Message]);
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants(
          user_id,
          profiles(full_name, avatar_url, role)
        ),
        messages(
          id,
          content,
          created_at,
          sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
        )
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
      return;
    }

    // Filter conversations where user is a participant
    const userConversations = data?.filter(conv => 
      conv.conversation_participants?.some(p => p.user_id === user.id)
    ) || [];

    setConversations(userConversations as Conversation[]);
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
      return;
    }

    setMessages(data as Message[]);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: newMessage.trim()
      });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return;
    }

    setNewMessage('');
  };

  const selectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    loadMessages(conversationId);
  };

  const getConversationName = (conversation: Conversation) => {
    const otherParticipants = conversation.conversation_participants?.filter(
      p => p.user_id !== user?.id
    );
    return otherParticipants?.map(p => p.profiles?.full_name).join(', ') || 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    const otherParticipant = conversation.conversation_participants?.find(
      p => p.user_id !== user?.id
    );
    return otherParticipant?.profiles?.avatar_url;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Please log in to view messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Messages</CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-foreground-muted">Loading...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-foreground-muted">No conversations yet</div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => selectConversation(conversation.id)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted ${
                        selectedConversation === conversation.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getConversationAvatar(conversation) || undefined} />
                          <AvatarFallback>
                            {getConversationName(conversation).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {getConversationName(conversation)}
                          </p>
                          {conversation.messages?.[0] && (
                            <p className="text-xs text-foreground-muted truncate">
                              {conversation.messages[0].content}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="lg:col-span-2">
            {selectedConversation ? (
              <>
                <CardHeader>
                  <CardTitle>
                    {conversations.find(c => c.id === selectedConversation) && 
                      getConversationName(conversations.find(c => c.id === selectedConversation)!)
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-[500px]">
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto space-y-4 p-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex items-start space-x-2 max-w-[70%] ${
                          message.sender_id === user.id ? 'flex-row-reverse space-x-reverse' : ''
                        }`}>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.sender?.avatar_url || undefined} />
                            <AvatarFallback>
                              {message.sender?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`rounded-lg p-3 ${
                            message.sender_id === user.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              message.sender_id === user.id 
                                ? 'text-primary-foreground/70' 
                                : 'text-foreground-muted'
                            }`}>
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-border pt-4">
                    <div className="flex space-x-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1"
                      />
                      <Button onClick={sendMessage} size="sm">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full">
                <p className="text-foreground-muted">Select a conversation to start messaging</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;