-- Supabase/PostgreSQL スキーマ定義
-- ユーザープロフィール情報を格納するテーブル
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  birth_date date,
  work_classification text,
  has_spouse boolean DEFAULT false,
  children_count integer DEFAULT 0,
  is_premium boolean DEFAULT false NOT NULL,
  subscription_status text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ユーザーごとの年次設定を格納するテーブル
CREATE TABLE public.annual_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  annual_income integer,
  monthly_income integer,
  bonus_amount integer,
  commuting_allowance integer,
  previous_year_income integer,
  living_expenses integer,
  ideco_contribution integer,
  furusato_nouzei_donation integer,
  housing_loan_deduction integer,
  life_insurance_deduction integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, year) -- ユーザーIDと年で一意性を担保
);
ALTER TABLE public.annual_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own annual settings." ON public.annual_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own annual settings." ON public.annual_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own annual settings." ON public.annual_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own annual settings." ON public.annual_settings FOR DELETE USING (auth.uid() = user_id);

-- リアルタイム更新のためのトリガー関数
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_annual_settings_updated
  BEFORE UPDATE ON public.annual_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
