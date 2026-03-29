-- HedgeKit: Initial Schema
-- Run this in your Supabase SQL Editor

-- Sagas: multi-leg hedge execution
create table if not exists sagas (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'PENDING',
  total_cost_usd numeric,
  spending_cap_usd numeric default 25,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Saga legs: individual orders within a saga
create table if not exists saga_legs (
  id uuid primary key default gen_random_uuid(),
  saga_id uuid references sagas(id) on delete cascade,
  platform text not null,
  market_id text not null,
  market_title text,
  side text not null,
  size numeric not null,
  price numeric,
  fill_price numeric,
  status text not null default 'PENDING',
  simulated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Saga events: audit trail for all state transitions
create table if not exists saga_events (
  id uuid primary key default gen_random_uuid(),
  saga_id uuid references sagas(id) on delete cascade,
  event_type text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- Market cache: cached market data with TTL
create table if not exists market_cache (
  id text primary key,
  platform text not null,
  data jsonb not null,
  fetched_at timestamptz default now()
);

-- Hedge recommendations: log of all recommendations served
create table if not exists hedge_recommendations (
  id uuid primary key default gen_random_uuid(),
  input_description text,
  input_type text,
  recommendations jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_saga_legs_saga_id on saga_legs(saga_id);
create index if not exists idx_saga_events_saga_id on saga_events(saga_id);
create index if not exists idx_sagas_status on sagas(status);
create index if not exists idx_market_cache_platform on market_cache(platform);
