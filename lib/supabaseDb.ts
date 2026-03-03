/**
 * lib/supabaseDb.ts
 * Supabase データアクセス層（DAL）
 * - profiles テーブルの CRUD
 * - annual_settings テーブルの CRUD
 * - ゲスト→認証ユーザーへのデータ移行
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import type {
  Profile,
  AnnualSettings,
  AnnualSettingsInsert,
  AnnualSettingsUpdate,
} from "./supabase.types";

// ===== Profiles =====

/**
 * プロフィールを取得する
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // 行が存在しない
    console.error("[DB] getProfile error:", error.message);
    return null;
  }
  return data;
}

/**
 * プロフィールを作成または更新する（upsert）
 */
export async function upsertProfile(
  userId: string,
  updates: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const payload = { id: userId, ...updates } as any;
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("[DB] upsertProfile error:", error.message);
    return null;
  }
  return data;
}

// ===== Annual Settings =====

/**
 * 指定年度の annual_settings を取得する
 */
export async function getAnnualSettings(
  userId: string,
  year: number
): Promise<AnnualSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("annual_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("year", year)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("[DB] getAnnualSettings error:", error.message);
    return null;
  }
  return data;
}

/**
 * 全年度の annual_settings を取得する（過年度比較用）
 */
export async function getAllAnnualSettings(
  userId: string
): Promise<AnnualSettings[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("annual_settings")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false });
  if (error) {
    console.error("[DB] getAllAnnualSettings error:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * annual_settings を保存または更新する（upsert）
 * user_id + year の複合ユニーク制約に基づく
 */
export async function upsertAnnualSettings(
  userId: string,
  year: number,
  settings: AnnualSettingsUpdate
): Promise<AnnualSettings | null> {
  if (!isSupabaseConfigured()) return null;
  const payload = {
    user_id: userId,
    year,
    ...settings,
  } as any;
  const { data, error } = await supabase
    .from("annual_settings")
    .upsert(payload, { onConflict: "user_id,year" })
    .select()
    .single();
  if (error) {
    console.error("[DB] upsertAnnualSettings error:", error.message);
    return null;
  }
  return data;
}

/**
 * 計算結果をキャッシュとして保存する
 * ※ Supabaseスキーマにキャッシュカラムがないため、現時点ではログのみ
 */
export async function cacheCalculationResult(
  userId: string,
  year: number,
  result: {
    cached_take_home?: number;
    cached_total_tax?: number;
    cached_social_insurance?: number;
  }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // 将来的にスキーマにキャッシュカラムを追加する場合はここで upsertAnnualSettings を呼び出す
  console.log('[DB] cacheCalculationResult:', { userId, year, result });
}

// ===== ゲスト → 認証ユーザーへのデータ移行 =====

/**
 * ゲストユーザーのデータを認証ユーザーに移行する
 * 匿名認証 → SNSログイン時に呼び出す
 *
 * @param guestUserId - 匿名ユーザーの UUID
 * @param authenticatedUserId - SNS認証後のユーザー UUID
 */
export async function migrateGuestDataToUser(
  guestUserId: string,
  authenticatedUserId: string
): Promise<{ migratedSettings: number; success: boolean }> {
  if (!isSupabaseConfigured()) {
    return { migratedSettings: 0, success: false };
  }

  try {
    // 1. ゲストの annual_settings を取得
    const guestSettings = await getAllAnnualSettings(guestUserId);
    if (guestSettings.length === 0) {
      return { migratedSettings: 0, success: true };
    }

    // 2. 認証ユーザーに既存のデータがあるか確認
    const existingYears = new Set(
      (await getAllAnnualSettings(authenticatedUserId)).map((s) => s.year)
    );

    // 3. 重複しない年度のデータを移行（認証ユーザーのデータを優先）
    let migratedCount = 0;
    for (const setting of guestSettings) {
      if (!existingYears.has(setting.year)) {
        const { id: _id, user_id: _uid, created_at: _ca, updated_at: _ua, ...rest } = setting;
        const result = await upsertAnnualSettings(authenticatedUserId, setting.year, rest);
        if (result) migratedCount++;
      }
    }

    // 4. ゲストのプロフィールを取得して認証ユーザーにマージ
    const guestProfile = await getProfile(guestUserId);
    if (guestProfile) {
      const authProfile = await getProfile(authenticatedUserId);
      if (!authProfile) {
        // 認証ユーザーにプロフィールがなければゲストのものを移行
        const { id: _id, created_at: _ca, updated_at: _ua, ...profileRest } = guestProfile;
        await upsertProfile(authenticatedUserId, profileRest);
      }
    }

    console.log(`[DB] Migration complete: ${migratedCount} settings migrated`);
    return { migratedSettings: migratedCount, success: true };
  } catch (error) {
    console.error("[DB] migrateGuestDataToUser error:", error);
    return { migratedSettings: 0, success: false };
  }
}
