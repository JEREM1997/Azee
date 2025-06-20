/*
  # Store Management Schema Setup

  1. New Tables
    - `stores`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `donut_varieties`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
    - `donut_forms`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
    - `box_configurations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `capacity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create stores table
CREATE TABLE IF NOT EXISTS public.stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create donut varieties table
CREATE TABLE IF NOT EXISTS public.donut_varieties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Create donut forms table
CREATE TABLE IF NOT EXISTS public.donut_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Create box configurations table
CREATE TABLE IF NOT EXISTS public.box_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    capacity integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read stores"
    ON public.stores
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read donut varieties"
    ON public.donut_varieties
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read donut forms"
    ON public.donut_forms
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read box configurations"
    ON public.box_configurations
    FOR SELECT
    TO authenticated
    USING (true);

-- Add some initial data for testing
INSERT INTO public.stores (name, address) VALUES
    ('Downtown Store', '123 Main St'),
    ('Mall Location', '456 Shopping Center Ave');

INSERT INTO public.donut_varieties (name, description) VALUES
    ('Glazed', 'Classic glazed donut'),
    ('Chocolate', 'Rich chocolate frosted donut');

INSERT INTO public.donut_forms (name, description) VALUES
    ('Ring', 'Traditional ring-shaped donut'),
    ('Filled', 'Filled donut with various fillings');

INSERT INTO public.box_configurations (name, capacity) VALUES
    ('Small Box', 6),
    ('Medium Box', 12),
    ('Large Box', 24);