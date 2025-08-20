-- Create project_applications table
CREATE TABLE public.project_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  coder_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, coder_id)
);

-- Enable RLS
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_applications
CREATE POLICY "Coders can create applications" 
ON public.project_applications 
FOR INSERT 
WITH CHECK (auth.uid() = coder_id);

CREATE POLICY "Coders can view own applications" 
ON public.project_applications 
FOR SELECT 
USING (auth.uid() = coder_id);

CREATE POLICY "Hirers can view applications for their projects" 
ON public.project_applications 
FOR SELECT 
USING (auth.uid() IN (
  SELECT hirer_id FROM projects WHERE id = project_applications.project_id
));

CREATE POLICY "Hirers can update applications for their projects" 
ON public.project_applications 
FOR UPDATE 
USING (auth.uid() IN (
  SELECT hirer_id FROM projects WHERE id = project_applications.project_id
));

-- Add trigger for updated_at
CREATE TRIGGER update_project_applications_updated_at
  BEFORE UPDATE ON public.project_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();