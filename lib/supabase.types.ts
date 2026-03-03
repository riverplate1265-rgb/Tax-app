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
// Supabase実テーブル: id, birth_date, work_classification, has_spouse, children_count, is_premium, subscription_status, created_at, updated_at
export interface Profile {
  id: string;                                    // UUID (auth.users.id と同一)
  birth_date: string | null;                     // 生年月日 (YYYY-MM-DD)
  work_classification: WorkClassification | null;
  has_spouse: boolean;
  children_count: number;
  is_premium: boolean;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export type WorkClassification =
  | "会社員（企業年金なし）"
  | "会社員（企業年金あり）"
  | "公務員"
  | "自営業・フリーランス";

export type SubscriptionStatus = "none" | "active" | "expired" | "trial";

// ===== annual_settings テーブル =====
// Supabase実テーブル: id, user_id, year, annual_income, monthly_income, bonus_amount,
//   commuting_allowance, previous_year_income, living_expenses,
//   ideco_contribution, furusato_nouzei_donation, housing_loan_deduction,
//   life_insurance_deduction, created_at, updated_at
export interface AnnualSettings {
  id: string;
  user_id: string;
  year: number;
  // 収入
  annual_income: number | null;              // 年収（万円）
  monthly_income: number | null;             // 月収（万円）
  bonus_amount: number | null;               // 賞与合計（万円）
  commuting_allowance: number | null;        // 通勤手当（年間・万円）
  previous_year_income: number | null;       // 前年年収（万円）
  // 生活費
  living_expenses: number | null;            // 月間生活費（万円）
  // 節税控除（Supabaseスキーマのカラム名に合わせる）
  ideco_contribution: number | null;         // iDeCo月額掛金（円）
  furusato_nouzei_donation: number | null;   // ふるさと納税（年間・円）
  housing_loan_deduction: number | null;     // 住宅ローン控除額（円）
  life_insurance_deduction: number | null;   // 生命保険料控除（円）
  prefecture: string | null;                 // 勤務地（都道府県） ※ローカルのみ保存、Supabaseにはない
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
