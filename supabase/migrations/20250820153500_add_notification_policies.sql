-- Add RLS policies for notifications table

-- Allow users to view their own notifications
create policy "Users can view own notifications" 
on public.notifications for select 
using (auth.uid() = user_id);

-- Allow system to insert notifications for users
create policy "System can insert notifications" 
on public.notifications for insert 
with check (true);

-- Allow users to update read status of their notifications
create policy "Users can update own notifications" 
on public.notifications for update 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Create a function to safely send notifications
create or replace function public.send_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_related_id uuid default null
) returns jsonb as $$
declare
  v_notification_id uuid;
  v_result jsonb;
begin
  -- Insert the notification
  insert into public.notifications(
    user_id, 
    title, 
    message, 
    type, 
    related_id,
    read,
    created_at
  ) values (
    p_user_id, 
    p_title, 
    p_message, 
    p_type, 
    p_related_id,
    false,
    now()
  )
  returning id into v_notification_id;
  
  -- Return success response
  select jsonb_build_object(
    'success', true,
    'notification_id', v_notification_id
  ) into v_result;
  
  return v_result;
exception when others then
  -- Return error response
  select jsonb_build_object(
    'success', false,
    'error', SQLERRM
  ) into v_result;
  
  return v_result;
end;
$$ language plpgsql security definer;
