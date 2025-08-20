import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/Header';
import { Plus, DollarSign, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  project_skills: Array<{
    skills: {
      name: string;
      category: string;
    };
  }>;
  hirer: {
    full_name: string;
    avatar_url: string | null;
  };
};

const Projects = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  interface ProjectApplication {
    id: string;
    message: string;
    status: string;
    created_at: string;
    coder_id: string;
    project_id: string;
    profiles: {
      id: string;
      full_name: string;
      email: string;
      avatar_url: string | null;
      bio: string | null;
    } | null;
  }

  const [projectApplications, setProjectApplications] = useState<ProjectApplication[]>([]);

  // Function to update application status and send notification
  const updateApplicationStatus = async (applicationId: string, status: 'accepted' | 'rejected') => {
    try {
      // Update the application status
      const { data, error } = await supabase
        .from('project_applications')
        .update({ status })
        .eq('id', applicationId)
        .select()
        .single();

      if (error) throw error;
      
      // Get the application details for notification
      const { data: appWithDetails } = await supabase
        .from('project_applications')
        .select('*, projects!inner(title)')
        .eq('id', applicationId)
        .single();

      if (appWithDetails) {
        try {
          console.log('App with details:', appWithDetails);
          
          // First, verify we have the required data
          if (!appWithDetails.coder_id) {
            throw new Error('Missing coder_id in application');
          }
          if (!appWithDetails.project_id) {
            throw new Error('Missing project_id in application');
          }
          
          // Get project title
          const projectTitle = appWithDetails.projects?.title || 'a project';
          const notificationTitle = `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`;
          const notificationMessage = `Your application for project "${projectTitle}" has been ${status}.`;
          
          console.log('Sending notification with:', {
            user_id: appWithDetails.coder_id,
            title: notificationTitle,
            message: notificationMessage,
            type: status
          });
          
          // Use the database function to send notification
          const { data, error } = await supabase.rpc('send_notification', {
            p_user_id: appWithDetails.coder_id,
            p_title: notificationTitle,
            p_message: notificationMessage,
            p_type: status,
            p_related_id: appWithDetails.project_id
          });
          
          if (error) {
            console.error('Database function error:', error);
            throw error;
          }
          
          if (!data?.success) {
            console.error('Notification function returned error:', data);
            throw new Error(data?.error || 'Failed to send notification');
          }
          
          console.log('Notification sent successfully:', data);
          
        } catch (notifErr) {
          console.error('Error in notification process:', notifErr);
          // Don't fail the whole operation if notification fails
          toast.error('Application updated, but there was an issue sending the notification');
        }
      }

      // Refresh the applications list
      if (selectedProject) {
        const updatedApplications = await fetchProjectApplications(selectedProject.id);
        setProjectApplications(updatedApplications);
      }

      toast.success(`Application ${status} successfully`);
      return data;
    } catch (error) {
      console.error(`Error ${status}ing application:`, error);
      toast.error(`Failed to ${status} application`);
      return null;
    }
  };

  // Function to handle accepting an application
  const handleAcceptApplication = async (applicationId: string) => {
    return updateApplicationStatus(applicationId, 'accepted');
  };

  // Function to handle rejecting an application
  const handleRejectApplication = async (applicationId: string) => {
    return updateApplicationStatus(applicationId, 'rejected');
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
      if (profile?.role === 'hirer') {
        fetchMyProjects();
      } else if (profile?.role === 'coder') {
        fetchMyApplications();
      }
    }
  }, [user, profile]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_skills(
          skills(name, category)
        ),
        hirer:profiles!projects_hirer_id_fkey(full_name, avatar_url)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
      return;
    }

    setProjects(data as Project[]);
    setLoading(false);
  };

  const fetchMyProjects = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_skills(
          skills(name, category)
        ),
        hirer:profiles!projects_hirer_id_fkey(full_name, avatar_url)
      `)
      .eq('hirer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my projects:', error);
      return;
    }

    setMyProjects(data as Project[]);
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Budget not specified';
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    if (max) return `Up to $${max}`;
    return 'Budget not specified';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const ProjectCard = ({ project, showActions = false }: { project: Project; showActions?: boolean }) => (
    <Card className="hover-lift">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{project.title}</CardTitle>
            <p className="text-sm text-foreground-muted">by {project.hirer.full_name}</p>
          </div>
          <Badge className={getStatusColor(project.status)}>
            {project.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground-muted mb-4 line-clamp-3">{project.description}</p>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-4 text-sm text-foreground-muted">
            <div className="flex items-center space-x-1">
              <DollarSign className="w-4 h-4" />
              <span>{formatBudget(project.budget_min, project.budget_max)}</span>
            </div>
            {project.timeline && (
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{project.timeline}</span>
              </div>
            )}
          </div>

          {project.project_skills && project.project_skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {project.project_skills.slice(0, 4).map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill.skills.name}
                </Badge>
              ))}
              {project.project_skills.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{project.project_skills.length - 4} more
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-foreground-muted">
              Posted {new Date(project.created_at).toLocaleDateString()}
            </span>
            <div className="flex space-x-2">
              {showActions && (
                <Button size="sm" variant="outline" onClick={async () => {
                  setSelectedProject(project);
                  setIsDetailsOpen(true);
                  const apps = await fetchProjectApplications(project.id);
                  setProjectApplications(apps);
                }}>
                  View Applications
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={async () => {
                  if (profile?.role === 'coder') {
                    handleApplyToProject(project.id);
                  } else {
                    setSelectedProject(project);
                    setIsDetailsOpen(true);
                    const apps = await fetchProjectApplications(project.id);
                    setProjectApplications(apps);
                  }
                }}
              >
                {profile?.role === 'coder' ? 'Apply' : 'View Details'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const handleApplyToProject = async (projectId: string) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    console.log('Applying to project:', projectId, 'for user:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('project_applications')
        .insert({
          project_id: projectId,
          coder_id: user.id,
          message: 'I would like to apply for this project.',
          status: 'pending'  // Ensure status is set
        })
        .select()
        .single();

      if (error) {
        console.error('Error applying to project:', error);
        if (error.code === '23505') {
          toast.error('You have already applied to this project');
        } else {
          toast.error('Failed to apply to project');
        }
        return;
      }

      console.log('Application successful, data:', data);
      toast.success('Application submitted successfully');
      
      // Refresh both projects and applications
      await Promise.all([
        fetchProjects(),
        fetchMyApplications()
      ]);
      
    } catch (err) {
      console.error('Unexpected error in handleApply:', err);
      toast.error('An error occurred while applying');
    }
  };

  const fetchMyApplications = async () => {
    if (!user) {
      console.log('No user found, cannot fetch applications');
      return;
    }

    console.log('=== START: Fetching applications for user:', user.id);
    
    try {
      // First, verify the user exists in the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('Error fetching user profile:', profileError);
        toast.error('Error loading your profile');
        return;
      }

      console.log('User profile found:', profileData);

      // First, get all applications for the user
      console.log('Fetching applications from database...');
      const { data: applications, error: appsError } = await supabase
        .from('project_applications')
        .select('*')
        .eq('coder_id', user.id)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        throw appsError;
      }

      if (!applications || applications.length === 0) {
        console.log('No applications found for user');
        setApplications([]);
        return;
      }

      // Get unique project IDs from applications
      const projectIds = [...new Set(applications.map(app => app.project_id))];
      
      // Fetch project details for these applications
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          hirer:profiles!projects_hirer_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .in('id', projectIds);

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        throw projectsError;
      }

      // Combine the data
      const combinedData = applications.map(app => {
        const project = projectsData?.find(p => p.id === app.project_id);
        return {
          ...app,
          projects: project || null
        };
      });

      console.log('Successfully fetched and combined application data:', combinedData);
      setApplications(combinedData);
      
    } catch (err) {
      console.error('Unexpected error in fetchMyApplications:', err);
      toast.error('An error occurred while loading your applications');
    } finally {
      console.log('=== END: Finished fetching applications ===');
    }
  };

  const fetchProjectApplications = async (projectId: string) => {
    try {
      console.log('Fetching applications for project:', projectId);
      
      // First, get the applications
      const { data: applications, error: appsError } = await supabase
        .from('project_applications')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        throw appsError;
      }

      if (!applications?.length) {
        console.log('No applications found for project:', projectId);
        return [];
      }

      console.log('Found applications:', applications);

      // Get unique coder IDs from applications
      const coderIds = [...new Set(applications.map(app => app.coder_id))];
      console.log('Fetching profiles for coder IDs:', coderIds);

      // Get profiles in batches if needed (Supabase has a limit on IN clause)
      const batchSize = 50;
      let allProfiles: any[] = [];
      
      for (let i = 0; i < coderIds.length; i += batchSize) {
        const batch = coderIds.slice(i, i + batchSize);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', batch);

        if (profilesError) {
          console.error('Error fetching profiles batch:', profilesError);
          throw profilesError;
        }

        if (profiles) {
          allProfiles = [...allProfiles, ...profiles];
        }
      }

      console.log('Found profiles:', allProfiles);

      // Combine the data
      const result = applications.map(app => {
        const profile = allProfiles.find(p => p.id === app.coder_id) || null;
        return {
          ...app,
          profiles: profile ? {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            bio: profile.bio
          } : null
        };
      });

      console.log('Final result:', result);
      return result;

    } catch (error) {
      console.error('Error in fetchProjectApplications:', error);
      toast.error('Failed to load applications. Please try again.');
      return [];
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-foreground-muted">Please log in to view projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Project Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProject && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{selectedProject.title}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                  <div className="lg:col-span-2 space-y-4">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2">Description</h3>
                        <p className="whitespace-pre-line text-foreground-muted">{selectedProject.description}</p>
                      </CardContent>
                    </Card>
                    {selectedProject.project_skills && selectedProject.project_skills.length > 0 && (
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold mb-2">Required Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedProject.project_skills.map((s: any, i: number) => (
                              <Badge key={i} variant="secondary">{s.skills.name}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2">Budget & Timeline</h3>
                        <div className="text-sm text-foreground-muted space-y-1">
                          <div>Budget: {formatBudget(selectedProject.budget_min, selectedProject.budget_max)}</div>
                          {selectedProject.timeline && (<div>Timeline: {selectedProject.timeline}</div>)}
                          <div>Status: {selectedProject.status.replace('_',' ')}</div>
                        </div>
                      </CardContent>
                    </Card>
                    {profile?.role === 'hirer' && (
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold mb-2">Applications ({projectApplications.length})</h3>
                          <div className="space-y-3">
                            {projectApplications.length === 0 ? (
                              <p className="text-sm text-foreground-muted">No applications yet.</p>
                            ) : (
                              projectApplications.map((app) => {
                                const profile = app.profiles as any; // Temporary type assertion
                                return (
                                  <div key={app.id} className="space-y-2 p-4 border rounded-lg">
                                    <div className="flex items-center space-x-3">
                                      <Avatar className="h-10 w-10">
                                        <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                                        <AvatarFallback>{profile?.full_name?.[0] || 'U'}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <h4 className="font-medium">{profile?.full_name || 'Unknown User'}</h4>
                                        <p className="text-sm text-muted-foreground">{profile?.email}</p>
                                      </div>
                                    </div>
                                    {app.message && (
                                      <div className="mt-2 p-3 bg-muted/50 rounded-md">
                                        <p className="text-sm">{app.message}</p>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center mt-2">
                                      <div className="flex items-center space-x-2">
                                        <Badge variant={app.status === 'pending' ? 'outline' : app.status === 'accepted' ? 'default' : 'destructive'}>
                                          {app.status}
                                        </Badge>
                                        {app.status === 'pending' && (
                                          <div className="flex space-x-2">
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-7 text-xs"
                                              onClick={() => handleAcceptApplication(app.id)}
                                            >
                                              Accept
                                            </Button>
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-7 text-xs"
                                              variant="destructive"
                                              onClick={() => handleRejectApplication(app.id)}
                                            >
                                              Reject
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(app.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-foreground-muted">
              {profile?.role === 'coder' 
                ? 'Find exciting projects to work on' 
                : 'Manage your projects and find talented coders'
              }
            </p>
          </div>
          {profile?.role === 'hirer' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Post Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Post a New Project</DialogTitle>
                </DialogHeader>
                <ProjectForm 
                  onSuccess={() => {
                    setIsCreateDialogOpen(false);
                    fetchMyProjects();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="browse" className="w-full">
          <TabsList className={`grid w-full ${profile?.role === 'hirer' ? 'grid-cols-2' : profile?.role === 'coder' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="browse">Browse Projects</TabsTrigger>
            {profile?.role === 'hirer' && (
              <TabsTrigger value="my-projects">My Projects</TabsTrigger>
            )}
            {profile?.role === 'coder' && (
              <TabsTrigger value="my-applications">My Applications</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="browse" className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-5/6"></div>
                        <div className="h-3 bg-muted rounded w-4/6"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-foreground-muted mb-4">No projects available at the moment.</p>
                {profile?.role === 'hirer' && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post the First Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </TabsContent>

          {profile?.role === 'hirer' && (
            <TabsContent value="my-projects" className="mt-6">
              {myProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-foreground-muted mb-4">You haven't posted any projects yet.</p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post Your First Project
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} showActions />
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {profile?.role === 'coder' && (
            <TabsContent value="my-applications" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">My Applications</h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchMyApplications}
                >
                  Refresh
                </Button>
              </div>
              
              {applications.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <p className="text-foreground-muted mb-4">You haven't applied to any projects yet.</p>
                  <Button onClick={() => document.querySelector('[value="browse"]')?.click()}>
                    Browse Projects
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((application) => {
                    const project = application.projects;
                    if (!project) {
                      console.warn('Missing project data for application:', application.id);
                      return null;
                    }
                    
                    return (
                      <Card key={application.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">
                                {project.title || 'Untitled Project'}
                              </h3>
                              {project.hirer && (
                                <div className="flex items-center text-sm text-foreground-muted mb-2">
                                  <span>by {project.hirer.full_name || 'Unknown'}</span>
                                </div>
                              )}
                              {application.message && (
                                <div className="bg-muted/50 p-3 rounded-md mb-3">
                                  <p className="text-foreground">{application.message}</p>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-foreground-muted">
                                  Applied on {new Date(application.created_at).toLocaleDateString()}
                                </p>
                                <Badge 
                                  variant={
                                    application.status === 'pending' ? 'secondary' :
                                    application.status === 'accepted' ? 'default' : 'destructive'
                                  }
                                  className="ml-2"
                                >
                                  {application.status}
                                </Badge>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const projectId = project.id;
                                if (projectId) {
                                  // Find and select the project to view details
                                  const proj = projects.find(p => p.id === projectId);
                                  if (proj) {
                                    setSelectedProject(proj);
                                    setIsDetailsOpen(true);
                                  }
                                }
                              }}
                            >
                              View Project
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Projects;