-- Create a function to get conversations for a user
create or replace function public.get_user_conversations(user_id uuid)
returns table (
  id uuid,
  project_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  last_message text,
  last_message_at timestamptz
) 
language sql
security definer
as $$
  select 
    c.id,
    c.project_id,
    c.created_at,
    c.updated_at,
    p.user_id as other_user_id,
    pr.full_name as other_user_name,
    pr.avatar_url as other_user_avatar,
    m.content as last_message,
    m.created_at as last_message_at
  from 
    public.conversations c
    join public.conversation_participants cp on c.id = cp.conversation_id
    join public.conversation_participants p on c.id = p.conversation_id and p.user_id != user_id
    join public.profiles pr on p.user_id = pr.id
    left join lateral (
      select content, created_at
      from public.messages m
      where m.conversation_id = c.id
      order by created_at desc
      limit 1
    ) m on true
  where 
    cp.user_id = user_id
  order by 
    coalesce(m.created_at, c.updated_at) desc;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_user_conversations to authenticated;

-- Update RLS policies for conversations
create or replace policy "Users can view conversations they participate in" 
on public.conversations for select 
using (
  exists (
    select 1 from public.conversation_participants 
    where conversation_id = conversations.id and user_id = auth.uid()
  )
);

-- Ensure conversation_participants has the correct RLS policy
create or replace policy "Users can view participants of their conversations"
on public.conversation_participants for select
using (
  auth.uid() in (
    select user_id from public.conversation_participants cp2
    where cp2.conversation_id = conversation_participants.conversation_id
  )
);

-- Ensure messages can be viewed by conversation participants
create or replace policy "Users can view messages in their conversations"
on public.messages for select
using (
  auth.uid() in (
    select user_id from public.conversation_participants 
    where conversation_id = messages.conversation_id
  )
);
