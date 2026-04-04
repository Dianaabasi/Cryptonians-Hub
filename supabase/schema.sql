-- ============================================
-- Cryptonians Hub - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Create a table for Public Profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  email text,
  username text unique not null,
  gender text check (gender in ('male', 'female')),
  country text,
  phone_number text,
  x_username text,
  heard_from text,
  referral_id text,
  role_in_space text,
  bio text,
  avatar_url text,
  wallet_address text,
  role text not null default 'member' check (role in ('admin', 'mod', 'member')),
  is_suspended boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS) for profiles
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);
create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- Function to auto-update updated_at timestamp
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on profiles
  for each row execute function handle_updated_at();

-- Helper function to check role
create or replace function auth_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$ language sql security definer;

-- ============================================
-- Niches & Memberships
-- ============================================
create table niches (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  description text,
  icon_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table niche_memberships (
  niche_id uuid references niches on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (niche_id, user_id)
);

alter table niches enable row level security;
alter table niche_memberships enable row level security;

create policy "Niches are viewable by everyone." on niches
  for select using (true);
create policy "Only admins can insert niches." on niches
  for insert with check (auth_user_role() = 'admin');

create policy "Niche memberships are viewable by everyone." on niche_memberships
  for select using (true);
create policy "Users can join niches." on niche_memberships
  for insert with check (auth.uid() = user_id);
create policy "Users can leave niches." on niche_memberships
  for delete using (auth.uid() = user_id);

-- ============================================
-- Posts, Comments, Likes
-- ============================================
create table posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references profiles(id) on delete cascade not null,
  niche_id uuid references niches(id) on delete cascade, -- null = global feed
  content text not null,
  image_url text,
  is_job_post boolean not null default false,
  is_announcement boolean default false, -- only admins/mods can set this
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create trigger on_post_updated
  before update on posts
  for each row execute function handle_updated_at();

create table comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create trigger on_comment_updated
  before update on comments
  for each row execute function handle_updated_at();

create table likes (
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (post_id, user_id)
);

alter table posts enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;

-- Posts Policies
create policy "Posts are viewable by everyone." on posts
  for select using (true);
create policy "Users can create normal posts." on posts
  for insert with check (
    auth.uid() = author_id and 
    (is_job_post = false or auth_user_role() in ('admin', 'mod'))
  );
create policy "Authors can update their posts." on posts
  for update using (auth.uid() = author_id);
create policy "Authors or admins can delete posts." on posts
  for delete using (auth.uid() = author_id or auth_user_role() in ('admin', 'mod'));

-- Comments Policies
create policy "Comments are viewable by everyone." on comments
  for select using (true);
create policy "Users can comment." on comments
  for insert with check (auth.uid() = author_id);
create policy "Authors or admins can delete comments." on comments
  for delete using (auth.uid() = author_id or auth_user_role() in ('admin', 'mod'));

-- Likes Policies
create policy "Likes are viewable by everyone." on likes
  for select using (true);
create policy "Users can like posts." on likes
  for insert with check (auth.uid() = user_id);
create policy "Users can unlike posts." on likes
  for delete using (auth.uid() = user_id);

-- ============================================
-- Support Tickets
-- ============================================
create table support_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create trigger on_support_ticket_updated
  before update on support_tickets
  for each row execute function handle_updated_at();

create table support_messages (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references support_tickets(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table support_tickets enable row level security;
alter table support_messages enable row level security;

-- Setup RLS so only the ticket owner OR an admin/mod can see it
create policy "Users can see their own tickets, admins/mods see all." on support_tickets
  for select using (auth.uid() = user_id or auth_user_role() in ('admin', 'mod'));
  
create policy "Users can create tickets." on support_tickets
  for insert with check (auth.uid() = user_id);

create policy "Users can close their tickets, admins/mods can update status." on support_tickets
  for update using (auth.uid() = user_id or auth_user_role() in ('admin', 'mod'));

create policy "Users see msgs on their tickets, admins see all." on support_messages
  for select using (
    exists (
      select 1 from support_tickets t 
      where t.id = ticket_id and (t.user_id = auth.uid() or auth_user_role() in ('admin', 'mod'))
    )
  );

create policy "Ticket owners and admins/mods can reply." on support_messages
  for insert with check (
    auth.uid() = sender_id and 
    exists (
      select 1 from support_tickets t 
      where t.id = ticket_id and (t.user_id = auth.uid() or auth_user_role() in ('admin', 'mod'))
    )
  );

-- ============================================
-- Chats & Messaging (Direct & Niche Groups)
-- ============================================
create table chat_rooms (
  id uuid default gen_random_uuid() primary key,
  niche_id uuid references niches(id) on delete cascade, -- null = P2P direct
  is_direct boolean not null default true,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table chat_participants (
  chat_id uuid references chat_rooms(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (chat_id, user_id)
);

create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chat_rooms(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table chat_rooms enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages enable row level security;

-- ============================================
-- RLS Recursion Breakers
-- ============================================
create or replace function is_chat_member(check_chat_id uuid)
returns boolean
language sql
security definer
as $$
  select exists(
    select 1 from chat_participants 
    where chat_id = check_chat_id 
    and user_id = auth.uid()
  );
$$;

create or replace function has_niche_access(check_niche_id uuid)
returns boolean
language sql
security definer
as $$
  select exists(
    select 1 from niche_memberships 
    where niche_id = check_niche_id 
    and user_id = auth.uid()
  );
$$;

-- Policies for Chat Rooms
create policy "Users can view chats they are in or Niche chats they belong to." on chat_rooms
  for select using (
    is_chat_member(id) or (niche_id is not null and has_niche_access(niche_id))
  );

create policy "Users can create chats." on chat_rooms
  for insert with check (true);

-- Policies for Chat Participants
create policy "Users can view participants of their chats." on chat_participants
  for select using (
    is_chat_member(chat_id)
    or
    exists (select 1 from chat_rooms cr join niche_memberships nm on cr.niche_id = nm.niche_id where cr.id = chat_participants.chat_id and nm.user_id = auth.uid())
  );

create policy "Users can join chats." on chat_participants
  for insert with check (auth.uid() = user_id);

-- Policies for Chat Messages
create policy "Users can view messages in their chats." on chat_messages
  for select using (
    is_chat_member(chat_id)
    or
    exists (select 1 from chat_rooms cr join niche_memberships nm on cr.niche_id = nm.niche_id where cr.id = chat_messages.chat_id and nm.user_id = auth.uid())
  );

create policy "Users can send messages to their chats." on chat_messages
  for insert with check (
    auth.uid() = sender_id and (
      is_chat_member(chat_id)
      or
      exists (select 1 from chat_rooms cr join niche_memberships nm on cr.niche_id = nm.niche_id where cr.id = chat_messages.chat_id and nm.user_id = auth.uid())
    )
  );

-- ============================================
-- Storage Bucket Policies
-- (Run these after creating the 'posts' and 'avatars' buckets)
-- ============================================

-- Posts Bucket
create policy "Public Access to Posts Images"
on storage.objects for select
using ( bucket_id = 'posts' );

create policy "Authenticated users can upload post images"
on storage.objects for insert
with check ( bucket_id = 'posts' and auth.role() = 'authenticated' );

-- Avatars Bucket
create policy "Public Access to Avatars"
on storage.objects for select
using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload avatars"
on storage.objects for insert
with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

create policy "Users can update their own avatars"
on storage.objects for update
using ( bucket_id = 'avatars' and auth.uid() = owner );
