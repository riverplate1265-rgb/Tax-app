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
  id: string;                        // UUID (auth.users.id と同一)
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  work_classification: WorkClassification | null;
  has_spouse: boolean;
  children_count: number;
  is_premium: boolean;
  subscription_status: SubscriptionStatus;
  revenuecat_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkClassification =
  | "会社員（企業年金なし）"
  | "会社員（企業年金あり）"
  | "公務員"
  | "自営業・フリーランス"
  | "その他";

export type SubscriptionStatus = "none" | "active" | "expired" | "trial";

// ===== annual_settings テーブル =====
export interface AnnualSettings {
  id: string;
  user_id: string;
  year: number;
  // 収入
  annual_income: number | null;        // 年収（万円）
  monthly_income: number | null;       // 月収（万円）
  bonus_amount: number | null;         // 賞与合計（万円）
  commuting_allowance: number | null;  // 通勤手当（年間・万円）
  previous_year_income: number | null; // 前年年収（万円）
  // 生活費
  living_expenses: number | null;      // 月間生活費（万円）
  savings_target: number | null;       // 月間貯金目標（万円）
  // 節税控除
  ideco_monthly: number | null;        // iDeCo月額掛金（円）
  furusato_amount: number | null;      // ふるさと納税（年間・円）
  housing_loan_balance: number | null; // 住宅ローン残高（円）
  life_insurance_premium: number | null;      // 生命保険料（年間・円）
  earthquake_insurance_premium: number | null; // 地震保険料（年間・円）
  medical_expenses: number | null;     // 医療費（年間・円）
  // 計算結果キャッシュ（オプション）
  cached_take_home: number | null;     // 手取り計算結果キャッシュ（円）
  cached_total_tax: number | null;     // 税金合計キャッシュ（円）
  cached_social_insurance: number | null; // 社会保険料キャッシュ（円）
  prefecture: string | null;           // 勤務地（都道府県）
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
      work_classification: WorkClassification;
      subscription_status: SubscriptionStatus;
    };
  };
}
