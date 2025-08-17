-- Fix security definer functions to have proper search path
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.update_follow_counts()
returns trigger
language plpgsql
security definer set search_path = public
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