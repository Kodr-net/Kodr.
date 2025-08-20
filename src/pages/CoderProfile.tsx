import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, MapPin, DollarSign, Star, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'] & {
  user_skills: Array<{
    skills: {
      name: string;
      category: string;
    };
    level: string;
  }>;
  portfolio_items: Array<{
    id: string;
    title: string;
    description: string;
    image_url: string;
    project_url: string;
  }>;
};

const CoderProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProfile();
      if (user) {
        checkFollowStatus();
      }
    }
  }, [id, user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_skills(
          level,
          skills(name, category)
        ),
        portfolio_items(*)
      `)
      .eq('id', id)
      .eq('role', 'coder')
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
      return;
    }

    setProfile(data as Profile);
    setLoading(false);
  };

  const checkFollowStatus = async () => {
    if (!user || !id) return;

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', id)
      .single();

    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (!user || !id) return;

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', id);

      if (error) {
        toast.error('Failed to unfollow');
        return;
      }

      setIsFollowing(false);
      toast.success('Unfollowed successfully');
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: id
        });

      if (error) {
        toast.error('Failed to follow');
        return;
      }

      setIsFollowing(true);
      toast.success('Following successfully');
    }
  };

  const handleStartChat = async () => {
    if (!user || !id) return;

    // Check if conversation already exists
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('project_id', null)
      .limit(1);

    if (existingConversation && existingConversation.length > 0) {
      const convId = existingConversation[0].id;
      
      // Check if both users are participants
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', convId);

      const participantIds = participants?.map(p => p.user_id) || [];
      
      if (participantIds.includes(user.id) && participantIds.includes(id)) {
        navigate('/messages');
        return;
      }
    }

    // Create new conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError) {
      toast.error('Failed to create conversation');
      return;
    }

    // Add participants
    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: conversation.id, user_id: user.id },
        { conversation_id: conversation.id, user_id: id }
      ]);

    if (participantError) {
      toast.error('Failed to add participants');
      return;
    }

    navigate('/messages');
    toast.success('Chat started successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Coder not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Avatar className="w-24 h-24 mx-auto">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                    <p className="text-foreground-muted">{profile.role}</p>
                  </div>

                  {profile.location && (
                    <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}

                  {profile.hourly_rate && (
                    <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                      <DollarSign className="w-4 h-4" />
                      <span>${profile.hourly_rate}/hour</span>
                    </div>
                  )}

                  <div className="flex items-center justify-center space-x-4 text-sm text-foreground-muted">
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{profile.xp} XP</span>
                    </div>
                    <div>
                      <span>{profile.followers_count} followers</span>
                    </div>
                    <div>
                      <span>{profile.following_count} following</span>
                    </div>
                  </div>

                  {user && user.id !== profile.id && (
                    <div className="flex space-x-2">
                      <Button onClick={handleStartChat} className="flex-1">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Chat
                      </Button>
                      <Button 
                        variant={isFollowing ? "outline" : "default"}
                        onClick={handleFollow}
                      >
                        {isFollowing ? (
                          <>
                            <UserMinus className="w-4 h-4 mr-2" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Follow
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            {profile.user_skills && profile.user_skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile.user_skills.map((userSkill, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{userSkill.skills.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {userSkill.level}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio */}
            {profile.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground-muted leading-relaxed">{profile.bio}</p>
                </CardContent>
              </Card>
            )}

            {/* Portfolio */}
            {profile.portfolio_items && profile.portfolio_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profile.portfolio_items.map((item) => (
                      <Card key={item.id} className="hover-lift">
                        <CardContent className="p-4">
                          {item.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h3 className="font-semibold mb-2">{item.title}</h3>
                          {item.description && (
                            <p className="text-sm text-foreground-muted mb-3 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          {item.project_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={item.project_url} target="_blank" rel="noopener noreferrer">
                                View Project
                              </a>
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoderProfile;