import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import { Edit, MapPin, Star, Users, Code, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type PortfolioItem = Database['public']['Tables']['portfolio_items']['Row'];
type UserSkill = Database['public']['Tables']['user_skills']['Row'] & {
  skills: Database['public']['Tables']['skills']['Row'];
};

const Profile = () => {
  const { user, profile } = useAuth();
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    location: '',
    hourly_rate: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfileData();
      fetchPortfolio();
      fetchUserSkills();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setProfileData(profile);
      setEditForm({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        hourly_rate: profile.hourly_rate?.toString() || ''
      });
    }
  }, [profile]);

  const fetchProfileData = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfileData(data);
  };

  const fetchPortfolio = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching portfolio:', error);
      return;
    }

    setPortfolio(data || []);
  };

  const fetchUserSkills = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_skills')
      .select(`
        *,
        skills(*)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user skills:', error);
      return;
    }

    setUserSkills(data as UserSkill[] || []);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editForm.full_name,
        bio: editForm.bio,
        location: editForm.location,
        hourly_rate: editForm.hourly_rate ? parseInt(editForm.hourly_rate) : null
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      return;
    }

    toast.success('Profile updated successfully');
    setIsEditing(false);
    fetchProfileData();
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-warning text-warning-foreground';
      case 'intermediate': return 'bg-primary text-primary-foreground';
      case 'advanced': return 'bg-success text-success-foreground';
      case 'expert': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-start space-x-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileData?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {profileData?.full_name?.slice(0, 2).toUpperCase() || user.email?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={editForm.location}
                            onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                          <Input
                            id="hourly_rate"
                            type="number"
                            value={editForm.hourly_rate}
                            onChange={(e) => setEditForm({...editForm, hourly_rate: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={handleUpdateProfile}>Save Changes</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h1 className="text-2xl font-bold">{profileData?.full_name || user.email}</h1>
                          <div className="flex items-center space-x-4 text-foreground-muted">
                            <Badge variant="secondary">{profileData?.role === 'coder' ? 'Coder' : 'Hirer'}</Badge>
                            {profileData?.location && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-4 h-4" />
                                <span>{profileData.location}</span>
                              </div>
                            )}
                            {profileData?.hourly_rate && (
                              <div className="flex items-center space-x-1">
                                <span>${profileData.hourly_rate}/hr</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                      </div>
                      
                      {profileData?.bio && (
                        <p className="text-foreground-muted mb-4">{profileData.bio}</p>
                      )}
                      
                      <div className="flex items-center space-x-6 text-sm text-foreground-muted">
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4" />
                          <span>{profileData?.xp || 0} XP</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{profileData?.followers_count || 0} followers</span>
                        </div>
                        {profileData?.is_verified && (
                          <Badge variant="secondary">Verified</Badge>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Content */}
          <Tabs defaultValue="skills" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="skills" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Code className="w-5 h-5" />
                    <span>Skills & Expertise</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userSkills.length === 0 ? (
                    <p className="text-foreground-muted">No skills added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userSkills.map((userSkill) => (
                        <div key={userSkill.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{userSkill.skills.name}</p>
                            <p className="text-xs text-foreground-muted">{userSkill.skills.category}</p>
                          </div>
                          <Badge className={getSkillLevelColor(userSkill.level)}>
                            {userSkill.level}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="portfolio" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Briefcase className="w-5 h-5" />
                    <span>Portfolio</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolio.length === 0 ? (
                    <p className="text-foreground-muted">No portfolio items yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {portfolio.map((item) => (
                        <Card key={item.id} className="hover-lift">
                          {item.image_url && (
                            <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                              <img 
                                src={item.image_url} 
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className="p-4">
                            <h3 className="font-semibold mb-2">{item.title}</h3>
                            {item.description && (
                              <p className="text-sm text-foreground-muted mb-3">{item.description}</p>
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground-muted">No recent activity to display.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Profile;