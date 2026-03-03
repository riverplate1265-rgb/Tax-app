/**
 * hooks/use-auth-link.ts
 * 匿名認証 → SNS ログイン時のデータ移行・アカウントリンクフック
 *
 * フロー:
 * 1. アプリ起動時に匿名認証でゲストセッションを作成
 * 2. ゲストとして計算・設定データを保存（AsyncStorage or Supabase 匿名ユーザー）
 * 3. SNS ログイン時に linkIdentity() でアカウントを統合
 * 4. ゲストデータを認証ユーザーに移行（migrateGuestDataToUser）
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { migrateGuestDataToUser, upsertProfile } from "@/lib/supabaseDb";
import { getGuestAllSettings } from "@/hooks/use-annual-settings";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User, Session } from "@supabase/supabase-js";

const GUEST_USER_ID_KEY = "@tax_app:guest_user_id";
const MIGRATION_DONE_KEY = "@tax_app:migration_done";

export type AuthLinkState =
  | "idle"
  | "signing_in_anonymous"
  | "linking"
  | "migrating"
  | "done"
  | "error";

interface UseAuthLinkReturn {
  supabaseUser: User | null;
  session: Session | null;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  linkState: AuthLinkState;
  linkError: string | null;
  migratedCount: number;
  // アクション
  signInAnonymously: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  linkWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export function useAuthLink(): UseAuthLinkReturn {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [linkState, setLinkState] = useState<AuthLinkState>("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [migratedCount, setMigratedCount] = useState(0);

  const isAnonymous = Boolean(
    supabaseUser && supabaseUser.is_anonymous === true
  );
  const isAuthenticated = Boolean(supabaseUser && !isAnonymous);

  // ===== セッション監視 =====
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // 現在のセッションを取得
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSupabaseUser(data.session?.user ?? null);
    });

    // セッション変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("[AuthLink] Auth state change:", event);
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        // SNS ログイン完了時にデータ移行を実行
        if (event === "SIGNED_IN" && newSession?.user && !newSession.user.is_anonymous) {
          const migrationDone = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
          if (!migrationDone) {
            await performMigration(newSession.user.id);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ===== 匿名サインイン =====
  const signInAnonymously = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      console.log("[AuthLink] Supabase not configured, using local guest mode");
      return;
    }
    if (supabaseUser) return; // 既にセッションあり

    setLinkState("signing_in_anonymous");
    setLinkError(null);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      if (data.user) {
        // ゲストユーザーIDを保存（移行時に参照）
        await AsyncStorage.setItem(GUEST_USER_ID_KEY, data.user.id);
        // プロフィールの初期レコードを作成
        await upsertProfile(data.user.id, {
          is_premium: false,
          subscription_status: "none",
          has_spouse: false,
          children_count: 0,
        });
        console.log("[AuthLink] Anonymous sign-in successful:", data.user.id);
      }
      setLinkState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "匿名認証に失敗しました";
      setLinkError(msg);
      setLinkState("error");
      console.error("[AuthLink] signInAnonymously error:", err);
    }
  }, [supabaseUser]);

  // ===== データ移行処理 =====
  const performMigration = useCallback(async (newUserId: string) => {
    setLinkState("migrating");
    try {
      // ゲストユーザーIDを取得
      const guestUserId = await AsyncStorage.getItem(GUEST_USER_ID_KEY);

      if (guestUserId && guestUserId !== newUserId) {
        // Supabase 上のゲストデータを移行
        const result = await migrateGuestDataToUser(guestUserId, newUserId);
        setMigratedCount(result.migratedSettings);
        console.log(`[AuthLink] Migration: ${result.migratedSettings} settings migrated`);
      }

      // AsyncStorage のゲストデータも移行（Supabase 未設定時のローカルデータ）
      const guestSettings = await getGuestAllSettings();
      if (guestSettings.length > 0) {
        console.log(`[AuthLink] Local guest settings found: ${guestSettings.length} years`);
        // ローカルデータは Supabase への同期は use-annual-settings フックが担当
      }

      // 移行完了フラグを設定
      await AsyncStorage.setItem(MIGRATION_DONE_KEY, "true");
      // ゲストIDをクリア
      await AsyncStorage.removeItem(GUEST_USER_ID_KEY);

      setLinkState("done");
    } catch (err) {
      console.error("[AuthLink] performMigration error:", err);
      setLinkState("error");
      setLinkError("データ移行中にエラーが発生しました");
    }
  }, []);

  // ===== Google でリンク =====
  const linkWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLinkState("linking");
    setLinkError(null);
    try {
      if (isAnonymous && supabaseUser) {
        // 匿名ユーザーに Google アカウントをリンク
        const { error } = await supabase.auth.linkIdentity({
          provider: "google",
          options: {
            redirectTo: `${process.env.EXPO_PUBLIC_APP_URL ?? ""}/oauth/callback`,
          },
        });
        if (error) throw error;
      } else {
        // 新規 Google ログイン
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${process.env.EXPO_PUBLIC_APP_URL ?? ""}/oauth/callback`,
          },
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google ログインに失敗しました";
      setLinkError(msg);
      setLinkState("error");
      console.error("[AuthLink] linkWithGoogle error:", err);
    }
  }, [isAnonymous, supabaseUser]);

  // ===== Apple でリンク =====
  const linkWithApple = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLinkState("linking");
    setLinkError(null);
    try {
      if (isAnonymous && supabaseUser) {
        const { error } = await supabase.auth.linkIdentity({
          provider: "apple",
          options: {
            redirectTo: `${process.env.EXPO_PUBLIC_APP_URL ?? ""}/oauth/callback`,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: {
            redirectTo: `${process.env.EXPO_PUBLIC_APP_URL ?? ""}/oauth/callback`,
          },
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Apple ログインに失敗しました";
      setLinkError(msg);
      setLinkState("error");
      console.error("[AuthLink] linkWithApple error:", err);
    }
  }, [isAnonymous, supabaseUser]);

  // ===== サインアウト =====
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
    // 移行フラグをリセット（再ログイン時に再移行できるよう）
    await AsyncStorage.removeItem(MIGRATION_DONE_KEY);
    setSupabaseUser(null);
    setSession(null);
    setLinkState("idle");
  }, []);

  // ===== セッションリフレッシュ =====
  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    setSupabaseUser(data.session?.user ?? null);
  }, []);

  return {
    supabaseUser,
    session,
    isAnonymous,
    isAuthenticated,
    linkState,
    linkError,
    migratedCount,
    signInAnonymously,
    linkWithGoogle,
    linkWithApple,
    signOut,
    refreshSession,
  };
}
