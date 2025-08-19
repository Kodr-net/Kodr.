import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Skill = Database['public']['Tables']['skills']['Row'];

interface ProjectFormProps {
  onSuccess: () => void;
}

export function ProjectForm({ onSuccess }: ProjectFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [timeline, setTimeline] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Error fetching skills:', error);
      return;
    }

    setAvailableSkills(data || []);
  };

  const addSkill = (skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    if (skill && !selectedSkills.find(s => s.id === skillId)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter(s => s.id !== skillId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          hirer_id: user.id,
          title,
          description,
          budget_min: budgetMin ? parseInt(budgetMin) : null,
          budget_max: budgetMax ? parseInt(budgetMax) : null,
          timeline: timeline || null,
          status: 'open'
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Add skills to the project
      if (selectedSkills.length > 0) {
        const projectSkills = selectedSkills.map(skill => ({
          project_id: project.id,
          skill_id: skill.id
        }));

        const { error: skillsError } = await supabase
          .from('project_skills')
          .insert(projectSkills);

        if (skillsError) throw skillsError;
      }

      toast.success('Project posted successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to post project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="title">Project Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter project title"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project requirements, goals, and expectations..."
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="budget-min">Minimum Budget ($)</Label>
          <Input
            id="budget-min"
            type="number"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            placeholder="Min budget"
          />
        </div>
        <div>
          <Label htmlFor="budget-max">Maximum Budget ($)</Label>
          <Input
            id="budget-max"
            type="number"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="Max budget"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="timeline">Timeline</Label>
        <Input
          id="timeline"
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="e.g., 2-3 weeks, 1 month"
        />
      </div>

      <div>
        <Label>Required Skills</Label>
        <Select onValueChange={addSkill}>
          <SelectTrigger>
            <SelectValue placeholder="Add a skill" />
          </SelectTrigger>
          <SelectContent>
            {availableSkills
              .filter(skill => !selectedSkills.find(s => s.id === skill.id))
              .map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name} ({skill.category})
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedSkills.map((skill) => (
              <Badge key={skill.id} variant="secondary" className="flex items-center gap-1">
                {skill.name}
                <button
                  type="button"
                  onClick={() => removeSkill(skill.id)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Posting...' : 'Post Project'}
        </Button>
      </div>
    </form>
  );
}