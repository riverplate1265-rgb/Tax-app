/**
 * lib/supabase.types.ts
 * Supabase データベース型定義
 * supabase_schema.sql に対応する TypeScript 型
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ===== profiles テーブル =====
export interface Profile {
  id: string;                            // UUID (auth.users.id と同一)
  birth_date: string | null;             // 生年月日 (YYYY-MM-DD)
  work_prefecture: string | null;        // 勤務都道府県
  has_spouse: boolean;
  children_count: number;
  is_premium: boolean;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = "none" | "active" | "expired" | "trial";

// ===== annual_settings テーブル =====
export interface AnnualSettings {
  id: string;
  user_id: string;
  year: number;
  // 収入
  annual_income: number | null;              // 年収（万円）
  commuting_allowance: number | null;        // 通勤手当（年間・万円）
  previous_year_income: number | null;       // 前年年収（万円）
  spouse_income: number | null;              // 配偶者の見込み年収（万円）
  // 節税控除
  ideco_contribution: number | null;         // iDeCo月額掛金（円）
  furusato_nouzei_donation: number | null;   // ふるさと納税（年間・円）
  housing_loan_deduction: number | null;     // 住宅ローン年末残高（万円）
  life_insurance_deduction: number | null;   // 生命保険料（年間・円）
  medical_expenses: number | null;           // 医療費年間見込額（円）
  // 勤務地
  work_prefecture: string | null;            // 勤務都道府県
  created_at: string;
  updated_at: string;
}

export type AnnualSettingsInsert = Omit<AnnualSettings, "id" | "created_at" | "updated_at">;
export type AnnualSettingsUpdate = Partial<Omit<AnnualSettings, "id" | "user_id" | "year" | "created_at">>;

// ===== Database 型（Supabase クライアント用）=====
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      annual_settings: {
        Row: AnnualSettings;
        Insert: AnnualSettingsInsert;
        Update: AnnualSettingsUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_status: SubscriptionStatus;
    };
  };
}
