/**
 * lib/supabase.ts
 * Supabase クライアント設定
 * - React Native (Expo) / Web 両対応
 * - AsyncStorage を使ったセッション永続化
 * - 匿名認証・SNS認証・アカウントリンクに対応
 */
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { Database } from "./supabase.types";

// 環境変数（.env / app.config.ts の extra 経由）
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase クライアントインスタンス
 * - Native: AsyncStorage でセッション永続化
 * - Web: localStorage でセッション永続化（Supabase デフォルト）
 * - 環境変数未設定時はダミーURLでクライアントを生成（オフラインモード）
 */
const _url = SUPABASE_URL || "https://placeholder.supabase.co";
const _key = SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient<Database>(_url, _key, {
  auth: {
    // React Native では AsyncStorage を使用
    storage: Platform.OS !== "web" ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

/**
 * 設定が有効かどうかを確認する
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
