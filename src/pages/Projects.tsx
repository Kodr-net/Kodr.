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
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProjects();
      if (profile?.role === 'hirer') {
        fetchMyProjects();
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
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              )}
              <Button size="sm">
                {profile?.role === 'coder' ? 'Apply' : 'View Details'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse Projects</TabsTrigger>
            {profile?.role === 'hirer' && (
              <TabsTrigger value="my-projects">My Projects</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Projects;