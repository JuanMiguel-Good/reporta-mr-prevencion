
-- Step 1: Add user_id column (nullable initially) to all three tables
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Step 2: Assign existing categories rows to the super admin auth user
UPDATE public.categories
SET user_id = (SELECT id FROM auth.users WHERE email = 'admin@safetyreport.com' LIMIT 1)
WHERE user_id IS NULL;

-- Step 3: Drop all existing RLS policies on the three tables
DROP POLICY IF EXISTS "Users can view areas from their company" ON public.areas;
DROP POLICY IF EXISTS "Managers can insert areas" ON public.areas;
DROP POLICY IF EXISTS "Managers can update areas" ON public.areas;
DROP POLICY IF EXISTS "Managers can delete areas" ON public.areas;

DROP POLICY IF EXISTS "Users can view company categories" ON public.categories;
DROP POLICY IF EXISTS "Managers can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Managers can update categories" ON public.categories;
DROP POLICY IF EXISTS "Managers can delete categories" ON public.categories;
DROP POLICY IF EXISTS "authenticated_full_access_categories" ON public.categories;

DROP POLICY IF EXISTS "Users can view proyectos from their company" ON public.proyectos;
DROP POLICY IF EXISTS "Managers can insert proyectos" ON public.proyectos;
DROP POLICY IF EXISTS "Managers can update proyectos" ON public.proyectos;
DROP POLICY IF EXISTS "Managers can delete proyectos" ON public.proyectos;

-- Step 4: Enable RLS (may already be enabled, safe to re-run)
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;

-- Step 5: Create new per-user RLS policies for areas
CREATE POLICY "select_own_areas" ON public.areas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_areas" ON public.areas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_areas" ON public.areas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_areas" ON public.areas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Create new per-user RLS policies for categories
CREATE POLICY "select_own_categories" ON public.categories
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_categories" ON public.categories
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Step 7: Create new per-user RLS policies for proyectos
CREATE POLICY "select_own_proyectos" ON public.proyectos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_proyectos" ON public.proyectos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_proyectos" ON public.proyectos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_proyectos" ON public.proyectos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
