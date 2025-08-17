-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create user roles enum
create type public.user_role as enum ('coder', 'hirer');

-- Create skill level enum  
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced', 'expert');

-- Create project status enum
create type public.project_status as enum ('draft', 'open', 'in_progress', 'completed', 'cancelled');

-- Create profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  avatar_url text,
  role user_role not null,
  bio text,
  location text,
  hourly_rate integer, -- in cents
  xp integer default 0,
  followers_count integer default 0,
  following_count integer default 0,
  is_verified boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create skills table
create table public.skills (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  category text not null,
  created_at timestamp with time zone default now()
);

-- Create user_skills junction table
create table public.user_skills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  level skill_level not null default 'intermediate',
  unique(user_id, skill_id)
);

-- Create teams table
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  logo_url text,
  owner_id uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create team_members table
create table public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamp with time zone default now(),
  unique(team_id, user_id)
);

-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  budget_min integer, -- in cents
  budget_max integer, -- in cents
  timeline text,
  status project_status default 'draft',
  hirer_id uuid references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create project_skills junction table
create table public.project_skills (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  unique(project_id, skill_id)
);

-- Create portfolio_items table
create table public.portfolio_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  project_url text,
  display_order integer default 0,
  created_at timestamp with time zone default now()
);

-- Create follows table
create table public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(follower_id, following_id)
);

-- Create conversations table
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create conversation_participants table
create table public.conversation_participants (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(conversation_id, user_id)
);

-- Create messages table
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  message_type text default 'text',
  created_at timestamp with time zone default now()
);

-- Create notifications table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read boolean default false,
  related_id uuid, -- can reference projects, users, etc
  created_at timestamp with time zone default now()
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_skills enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies for profiles
create policy "Public profiles are viewable by everyone" 
on public.profiles for select 
using (true);

create policy "Users can update own profile" 
on public.profiles for update 
using (auth.uid() = id);

create policy "Users can insert own profile" 
on public.profiles for insert 
with check (auth.uid() = id);

-- RLS Policies for skills (public read)
create policy "Skills are viewable by everyone" 
on public.skills for select 
using (true);

-- RLS Policies for user_skills
create policy "User skills are viewable by everyone" 
on public.user_skills for select 
using (true);

create policy "Users can manage own skills" 
on public.user_skills for all 
using (auth.uid() = user_id);

-- RLS Policies for teams
create policy "Teams are viewable by everyone" 
on public.teams for select 
using (true);

create policy "Team owners can update teams" 
on public.teams for update 
using (auth.uid() = owner_id);

create policy "Authenticated users can create teams" 
on public.teams for insert 
with check (auth.uid() = owner_id);

-- RLS Policies for team_members
create policy "Team members are viewable by everyone" 
on public.team_members for select 
using (true);

create policy "Team owners and members can manage membership" 
on public.team_members for all 
using (
  auth.uid() = user_id or 
  auth.uid() in (select owner_id from public.teams where id = team_id)
);

-- RLS Policies for projects
create policy "Projects are viewable by everyone" 
on public.projects for select 
using (true);

create policy "Hirers can manage own projects" 
on public.projects for all 
using (auth.uid() = hirer_id);

-- RLS Policies for project_skills
create policy "Project skills are viewable by everyone" 
on public.project_skills for select 
using (true);

create policy "Project owners can manage project skills" 
on public.project_skills for all 
using (
  auth.uid() in (select hirer_id from public.projects where id = project_id)
);

-- RLS Policies for portfolio_items
create policy "Portfolio items are viewable by everyone" 
on public.portfolio_items for select 
using (true);

create policy "Users can manage own portfolio" 
on public.portfolio_items for all 
using (auth.uid() = user_id);

-- RLS Policies for follows
create policy "Follows are viewable by everyone" 
on public.follows for select 
using (true);

create policy "Users can manage own follows" 
on public.follows for all 
using (auth.uid() = follower_id);

-- RLS Policies for conversations
create policy "Users can view conversations they participate in" 
on public.conversations for select 
using (
  auth.uid() in (
    select user_id from public.conversation_participants 
    where conversation_id = id
  )
);

create policy "Authenticated users can create conversations" 
on public.conversations for insert 
with check (auth.uid() is not null);

-- RLS Policies for conversation_participants
create policy "Users can view participants of conversations they're in" 
on public.conversation_participants for select 
using (
  auth.uid() in (
    select user_id from public.conversation_participants cp2 
    where cp2.conversation_id = conversation_id
  )
);

create policy "Users can join conversations" 
on public.conversation_participants for insert 
with check (auth.uid() = user_id);

-- RLS Policies for messages
create policy "Users can view messages in conversations they participate in" 
on public.messages for select 
using (
  auth.uid() in (
    select user_id from public.conversation_participants 
    where conversation_id = messages.conversation_id
  )
);

create policy "Users can send messages to conversations they participate in" 
on public.messages for insert 
with check (
  auth.uid() = sender_id and
  auth.uid() in (
    select user_id from public.conversation_participants 
    where conversation_id = messages.conversation_id
  )
);

-- RLS Policies for notifications
create policy "Users can view own notifications" 
on public.notifications for select 
using (auth.uid() = user_id);

create policy "Users can update own notifications" 
on public.notifications for update 
using (auth.uid() = user_id);

-- Functions and triggers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'coder')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add updated_at triggers
create trigger handle_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.teams
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.projects
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.conversations
  for each row execute procedure public.handle_updated_at();

-- Function to update follower counts
create or replace function public.update_follow_counts()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    -- Increment follower count for following_id
    update public.profiles 
    set followers_count = followers_count + 1 
    where id = new.following_id;
    
    -- Increment following count for follower_id
    update public.profiles 
    set following_count = following_count + 1 
    where id = new.follower_id;
    
    return new;
  elsif TG_OP = 'DELETE' then
    -- Decrement follower count for following_id
    update public.profiles 
    set followers_count = followers_count - 1 
    where id = old.following_id;
    
    -- Decrement following count for follower_id
    update public.profiles 
    set following_count = following_count - 1 
    where id = old.follower_id;
    
    return old;
  end if;
  return null;
end;
$$;

create trigger update_follow_counts_trigger
  after insert or delete on public.follows
  for each row execute procedure public.update_follow_counts();

-- Enable realtime for key tables
alter table public.messages replica identity full;
alter table public.notifications replica identity full;
alter table public.conversations replica identity full;

-- Add tables to realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.conversations;