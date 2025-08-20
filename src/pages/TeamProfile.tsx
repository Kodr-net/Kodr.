import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Team = Database['public']['Tables']['teams']['Row'] & {
  owner: {
    full_name: string;
    avatar_url: string | null;
  };
  team_members: Array<{
    role: string;
    joined_at: string;
    profiles: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      role: string;
    };
  }>;
};

const TeamProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTeam();
    }
  }, [id]);

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        owner:profiles!teams_owner_id_fkey(full_name, avatar_url),
        team_members(
          role,
          joined_at,
          profiles(id, full_name, avatar_url, role)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching team:', error);
      toast.error('Failed to load team');
      return;
    }

    setTeam(data as Team);
    setLoading(false);
  };

  const handleStartChat = async () => {
    if (!user || !id || !team) return;

    // Create new conversation with team owner
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError) {
      toast.error('Failed to create conversation');
      return;
    }

    // Add participants (current user and team owner)
    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: conversation.id, user_id: user.id },
        { conversation_id: conversation.id, user_id: team.owner_id }
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

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Team not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Avatar className="w-24 h-24 mx-auto">
                    <AvatarImage src={team.logo_url || undefined} />
                    <AvatarFallback>
                      {team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h1 className="text-2xl font-bold">{team.name}</h1>
                    <p className="text-foreground-muted">Team</p>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                    <Users className="w-4 h-4" />
                    <span>{team.team_members.length} members</span>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-foreground-muted">
                    <Calendar className="w-4 h-4" />
                    <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                  </div>

                  {user && user.id !== team.owner_id && (
                    <Button onClick={handleStartChat} className="w-full">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Contact Team
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Team Owner */}
            <Card>
              <CardHeader>
                <CardTitle>Team Owner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={team.owner.avatar_url || undefined} />
                    <AvatarFallback>
                      {team.owner.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{team.owner.full_name}</p>
                    <p className="text-sm text-foreground-muted">Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {team.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground-muted leading-relaxed">{team.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Team Members */}
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {team.team_members.map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={member.profiles.avatar_url || undefined} />
                          <AvatarFallback>
                            {member.profiles.full_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.profiles.full_name}</p>
                          <p className="text-sm text-foreground-muted">
                            {member.profiles.role} • Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          {member.role}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/coder/${member.profiles.id}`)}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamProfile;