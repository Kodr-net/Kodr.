import { useState, useEffect, useRef, useCallback } from 'react';import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { Send, Plus, ArrowLeft, Search, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  message_type: string;
  sender: {
    full_name: string;
    avatar_url: string | null;
  };
};

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const fetchMessage = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)')
        .eq('id', messageId)
        .single();

      if (error) throw error;
      
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === data.id);
        if (!exists) {
          return [...prev, {
            ...data,
            message_type: data.message_type || 'text',
            sender: data.sender || { full_name: 'Unknown', avatar_url: null }
          }];
        }
        return prev;
      });
    } catch (error) {
      console.error('Error fetching message:', error);
    }
  };

  const selectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    navigate(`/messages?conversation=${conversationId}`, { replace: true });
  };
  
  // Handle conversation from URL parameter and fetch conversations on mount
  useEffect(() => {
    if (!user) return;
    
    // Fetch conversations
    fetchConversations();
    
    // Handle conversation from URL
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      setSelectedConversation(conversationId);
      loadMessages(conversationId);
    } else {
      setSelectedConversation(null);
      setMessages([]);
    }
  }, [searchParams, user]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel('realtime messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          fetchMessage(newMessage.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants(
            user_id,
            profiles(
              id,
              full_name,
              avatar_url,
              role
            )
          ),
          messages!conversation_id(
            id,
            content,
            created_at,
            sender_id,
            conversation_id,
            message_type,
            profiles:profiles!messages_sender_id_fkey(
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .or(`user_id.eq.${user.id},conversation_participants.user_id.eq.${user.id}`);
        
      if (error) throw error;
      
      // Transform the data to match the Conversation type
      const transformedData: Conversation[] = (data || []).map(conv => ({
        ...conv,
        conversation_participants: conv.conversation_participants?.map(p => ({
          user_id: p.user_id,
          profiles: {
            full_name: p.profiles?.full_name || 'Unknown User',
            avatar_url: p.profiles?.avatar_url || null,
            role: p.profiles?.role || 'coder'
          }
        })) || [],
        messages: (conv.messages || []).map(msg => ({
          ...msg,
          message_type: msg.message_type || 'text',
          sender: {
            full_name: msg.profiles?.full_name || 'Unknown User',
            avatar_url: msg.profiles?.avatar_url || null
          }
        }))
      }));
      
      setConversations(transformedData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (!user) {
      toast.error('Please sign in to view messages');
      return;
    }
    
    try {
      setLoading(true);
      
      // First verify the user has access to this conversation
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();
        
      if (participantError || !participantData) {
        console.error('Not authorized to access this conversation');
        toast.error('You do not have permission to view this conversation');
        navigate('/messages'); // Redirect to messages list
        return;
      }

      // If authorized, fetch messages with sender info
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          conversation_id,
          message_type,
          profiles:profiles!messages_sender_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Transform messages to match our Message type
      const formattedMessages: Message[] = (messagesData || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        conversation_id: msg.conversation_id,
        message_type: msg.message_type || 'text',
        sender: {
          full_name: msg.profiles?.full_name || 'Unknown User',
          avatar_url: msg.profiles?.avatar_url || null
        }
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
  e?.preventDefault();
  if (!newMessage.trim() || !selectedConversation || !user) return;

  const messageContent = newMessage.trim();
  setNewMessage(''); // Clear input immediately for better UX

  // Create optimistic message
  const tempId = `temp-${Date.now()}`;
  const optimisticMessage: Message = {
    id: tempId,
    content: messageContent,
    sender_id: user.id,
    conversation_id: selectedConversation,
    message_type: 'text',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sender: {
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'You',
      avatar_url: user.user_metadata?.avatar_url || null
    }
  };

  // Add optimistic update
  setMessages(prev => [...prev, optimisticMessage]);
  scrollToBottom();

  try {
    // Send message to server
    const { data: messageData, error } = await supabase
      .from('messages')
      .insert([
        {
          content: messageContent,
          sender_id: user.id,
          conversation_id: selectedConversation,
          message_type: 'text'
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    // Update the conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', selectedConversation);

    // Replace optimistic message with server response
    setMessages(prev => {
      const newMessages = prev.filter(msg => msg.id !== tempId);
      newMessages.push({
        ...messageData,
        message_type: messageData.message_type || 'text',
        sender: {
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You',
          avatar_url: user?.user_metadata?.avatar_url || null
        }
      } as Message);
      return newMessages;
    });

    // Refresh conversations list to update the last message preview
    fetchConversations();
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Failed to send message');
    
    // Remove optimistic message on error
    setMessages(prev => prev.filter(msg => msg.id !== tempId));
  }
};

const getConversationName = (conversation: Conversation) => {
  if (!conversation.conversation_participants) return 'Unknown';
  const otherParticipants = conversation.conversation_participants.filter(
    p => p.user_id !== user?.id
  );
  return otherParticipants.map(p => p.profiles?.full_name).join(', ') || 'Unknown';
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

  // Get current conversation details
  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const otherParticipant = currentConversation?.conversation_participants?.find(
    p => p.user_id !== user?.id
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List - Hidden on mobile when conversation is selected */}
          <Card className={`lg:col-span-1 ${selectedConversation ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
            <CardHeader className="border-b p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Messages</CardTitle>
                <Button size="sm" variant="outline" className="hidden lg:flex">
                  <Plus className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>
              <div className="mt-2 relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
          <Card className="lg:col-span-3 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="border-b p-4 flex items-center space-x-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="lg:hidden"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  {otherParticipant && (
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={otherParticipant.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {otherParticipant.profiles?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{otherParticipant.profiles?.full_name || 'Unknown User'}</h3>
                        <p className="text-xs text-muted-foreground">
                          {otherParticipant.profiles?.role || 'Coder'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isUser = message.sender_id === user?.id;
                      const showHeader = index === 0 || 
                        messages[index - 1].sender_id !== message.sender_id ||
                        new Date(message.created_at).getTime() - 
                        new Date(messages[index - 1].created_at).getTime() > 5 * 60 * 1000; // 5 minutes
                      
                      return (
                        <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] lg:max-w-[60%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                            {showHeader && !isUser && (
                              <div className="flex items-center space-x-2 mb-1 px-2">
                                <span className="text-xs font-medium">
                                  {message.sender?.full_name || 'Unknown User'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}
                            <div 
                              className={`rounded-2xl px-4 py-2 ${
                                isUser 
                                  ? 'bg-primary text-primary-foreground rounded-br-none' 
                                  : 'bg-background border rounded-bl-none'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <div className={`text-xs mt-1 text-right ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="border-t p-4 bg-background">
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" size="default" disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No conversation selected</h3>
                <p className="text-muted-foreground max-w-md">
                  Select a conversation from the list or start a new chat to begin messaging.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;