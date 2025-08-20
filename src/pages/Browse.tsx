import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/lib/auth';
import { Search, Star, Users, MessageSquare, MapPin, Clock, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Team = Database['public']['Tables']['teams']['Row'] & {
  owner: Profile;
  team_members: Array<{
    profiles: Profile;
    role: string;
  }>;
};

const Browse = () => {
  const [coders, setCoders] = useState<Array<Profile & { user_skills?: any[]; is_following?: boolean }>>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('coders');
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({});
  const [skillFilter, setSkillFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    fetchCoders();
    fetchTeams();
  }, []);

  const fetchCoders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_skills(
            skills(name, category)
          )
        `)
        .eq('role', 'coder')
        .order('xp', { ascending: false });

      if (error) throw error;
      setCoders(data || []);
    } catch (error) {
      console.error('Error fetching coders:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          owner:profiles!teams_owner_id_fkey(*),
          team_members(
            role,
            profiles(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId: string) => {
    if (!user) {
      toast.error('Please sign in to start a chat');
      return;
    }
    
    try {
      // Check if conversation already exists between users
      const { data: existingConvos, error: convosError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .in('user_id', [user.id, userId])
        .not('conversation_id', 'is', null);

      if (convosError) throw convosError;

      // Find common conversation ID
      const conversationCounts = (existingConvos || []).reduce((acc, curr) => {
        acc[curr.conversation_id] = (acc[curr.conversation_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const existingConversationId = Object.entries(conversationCounts)
        .find(([_, count]) => count >= 2)?.[0];

      if (existingConversationId) {
        // Navigate to existing conversation
        window.location.href = `/messages?conversation=${existingConversationId}`;
        return;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({})
        .select('id')
        .single();

      if (createError || !newConversation) throw createError || new Error('Failed to create conversation');

      // Add participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConversation.id, user_id: user.id },
          { conversation_id: newConversation.id, user_id: userId }
        ]);

      if (participantError) throw participantError;

      // Navigate to new conversation
      window.location.href = `/messages?conversation=${newConversation.id}`;
      
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat. Please try again.');
    }
  };

  const handleFollow = async (profileId: string) => {
    if (!user) return;
    
    // Store current state for potential rollback
    const wasFollowing = followStatus[profileId];
    const previousCoders = [...coders];
    
    try {
      // Optimistic update
      setFollowStatus(prev => ({
        ...prev,
        [profileId]: !wasFollowing
      }));
      
      // Update the followers count optimistically without re-sorting
      setCoders(prevCoders => 
        prevCoders.map(coder => 
          coder.id === profileId 
            ? { 
                ...coder, 
                followers_count: wasFollowing 
                  ? Math.max(0, (coder.followers_count || 0) - 1)
                  : (coder.followers_count || 0) + 1
              } 
            : coder
        )
      );
      
      // Make the API call
      const { error } = wasFollowing
        ? await supabase
            .from('follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', profileId)
        : await supabase
            .from('follows')
            .insert({
              follower_id: user.id,
              following_id: profileId
            });
      
      if (error) throw error;
      
      // Only fetch fresh data after a short delay to allow the UI to update smoothly
      setTimeout(() => {
        fetchCoders();
      }, 300);
      
    } catch (error) {
      console.error('Error updating follow status:', error);
      
      // Revert to previous state on error
      setFollowStatus(prev => ({
        ...prev,
        [profileId]: wasFollowing
      }));
      
      setCoders(previousCoders);
      
      toast.error(`Failed to ${wasFollowing ? 'unfollow' : 'follow'} user`);
    }
  };

  // Fetch initial follow status for each coder
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
          
        if (!error && data) {
          const statusMap = data.reduce((acc, { following_id }) => ({
            ...acc,
            [following_id]: true
          }), {});
          
          setFollowStatus(prev => ({
            ...prev,
            ...statusMap
          }));
        }
      } catch (error) {
        console.error('Error fetching follow status:', error);
      }
    };
    
    fetchFollowStatus();
  }, [user]);

  const CoderCard = ({ coder }: { coder: Profile & { user_skills?: any[] } }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={coder.avatar_url} />
              <AvatarFallback>{coder.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{coder.full_name}</CardTitle>
              <div className="flex items-center space-x-2 text-sm text-foreground-muted">
                {coder.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span>{coder.location}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3" />
                  <span>{coder.xp} XP</span>
                </div>
              </div>
            </div>
          </div>
          {coder.is_verified && (
            <Badge variant="secondary" className="text-xs">
              Verified
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {coder.bio && (
          <p className="text-sm text-foreground-muted line-clamp-2">{coder.bio}</p>
        )}
        
        <div className="flex flex-wrap gap-2">
          {coder.user_skills?.slice(0, 3).map((userSkill: any) => (
            <Badge key={userSkill.skills.name} variant="outline" className="text-xs">
              {userSkill.skills.name}
            </Badge>
          ))}
          {coder.user_skills?.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{coder.user_skills.length - 3} more
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{coder.followers_count} followers</span>
            </div>
            {coder.hourly_rate && (
              <div className="text-primary font-medium">
                ${(coder.hourly_rate / 100).toFixed(0)}/hr
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant={followStatus[coder.id] ? "default" : "outline"} 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleFollow(coder.id);
            }}
            disabled={!user}
          >
            {followStatus[coder.id] ? (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Follow
              </>
            )}
          </Button>
          <Button 
            size="sm" 
            className="flex-1" 
            variant="outline"
            disabled={!user}
            onClick={(e) => {
              e.stopPropagation();
              startChat(coder.id);
            }}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const TeamCard = ({ team }: { team: Team }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={team.logo_url} />
              <AvatarFallback>{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              <div className="flex items-center space-x-2 text-sm text-foreground-muted">
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span>{team.team_members?.length || 0} members</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Active {new Date(team.created_at).getFullYear()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {team.description && (
          <p className="text-sm text-foreground-muted line-clamp-2">{team.description}</p>
        )}
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Led by:</span>
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={team.owner?.avatar_url} />
              <AvatarFallback>{team.owner?.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{team.owner?.full_name}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button size="sm" className="flex-1" disabled={!user}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Contact Team
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-jakarta font-bold mb-2">Browse Coders & Teams</h1>
          <p className="text-foreground-muted">Discover talented coders and professional teams ready to build your ideas</p>
        </div>

        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
              <Input
                placeholder="Search by name, skills, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="nodejs">Node.js</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="design">Design</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="coders" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="coders">Individual Coders</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          <TabsContent value="coders">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coders
                .filter(coder => {
                  // Search term filter
                  const matchesSearch = 
                    coder.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    coder.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    coder.location?.toLowerCase().includes(searchTerm.toLowerCase());
                  
                  // Skill filter
                  const matchesSkill = skillFilter === 'all' || 
                    coder.user_skills?.some(skill => 
                      skill.skills.name.toLowerCase() === skillFilter.toLowerCase()
                    );
                  
                  return matchesSearch && matchesSkill;
                })
                // Sort by XP (descending) and then by followers count (descending)
                .sort((a, b) => {
                  // If XP is different, sort by XP (higher first)
                  if (b.xp !== a.xp) {
                    return (b.xp || 0) - (a.xp || 0);
                  }
                  // If XP is the same, sort by followers count (higher first)
                  return (b.followers_count || 0) - (a.followers_count || 0);
                })
                .map((coder) => (
                  <CoderCard key={coder.id} coder={coder} />
                ))}
            </div>
            
            {coders.length === 0 && (
              <div className="text-center py-12">
                <div className="text-foreground-muted">No coders found. Be the first to join as a coder!</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="teams">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams
                .filter(team => 
                  searchTerm === '' || 
                  team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  team.description?.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
            </div>
            
            {teams.length === 0 && (
              <div className="text-center py-12">
                <div className="text-foreground-muted">No teams found. Create your team and start collaborating!</div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Browse;