/**
 * hooks/use-annual-settings.ts
 * annual_settings テーブルへの保存・取得・状態管理フック
 *
 * 設計方針:
 * - Supabase が未設定の場合は AsyncStorage にローカル保存（ゲストモード）
 * - 認証後は Supabase に自動同期
 * - Zustand でグローバル状態管理
 */
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAnnualSettings,
  getAllAnnualSettings,
  upsertAnnualSettings,
  cacheCalculationResult,
} from "@/lib/supabaseDb";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { AnnualSettings, AnnualSettingsUpdate } from "@/lib/supabase.types";

const GUEST_SETTINGS_KEY = (year: number) => `@tax_app:annual_settings:${year}`;
const GUEST_ALL_YEARS_KEY = "@tax_app:annual_settings:years";

// ===== Zustand Store =====

interface AnnualSettingsState {
  // 現在の年度設定
  currentYear: number;
  settings: Partial<AnnualSettings> | null;
  allSettings: AnnualSettings[];
  // ローディング状態
  loading: boolean;
  saving: boolean;
  error: string | null;
  // アクション
  setCurrentYear: (year: number) => void;
  setSettings: (settings: Partial<AnnualSettings> | null) => void;
  setAllSettings: (settings: AnnualSettings[]) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAnnualSettingsStore = create<AnnualSettingsState>((set) => ({
  currentYear: new Date().getFullYear(),
  settings: null,
  allSettings: [],
  loading: false,
  saving: false,
  error: null,
  setCurrentYear: (year) => set({ currentYear: year }),
  setSettings: (settings) => set({ settings }),
  setAllSettings: (allSettings) => set({ allSettings }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),
}));

// ===== ゲストモード用ローカルストレージ操作 =====

async function loadGuestSettings(year: number): Promise<Partial<AnnualSettings> | null> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_SETTINGS_KEY(year));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveGuestSettings(
  year: number,
  settings: Partial<AnnualSettings>
): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_SETTINGS_KEY(year), JSON.stringify(settings));
    // 年度リストを更新
    const yearsRaw = await AsyncStorage.getItem(GUEST_ALL_YEARS_KEY);
    const years: number[] = yearsRaw ? JSON.parse(yearsRaw) : [];
    if (!years.includes(year)) {
      years.push(year);
      await AsyncStorage.setItem(GUEST_ALL_YEARS_KEY, JSON.stringify(years));
    }
  } catch (err) {
    console.error("[GuestStorage] saveGuestSettings error:", err);
  }
}

async function loadAllGuestSettings(): Promise<Partial<AnnualSettings>[]> {
  try {
    const yearsRaw = await AsyncStorage.getItem(GUEST_ALL_YEARS_KEY);
    if (!yearsRaw) return [];
    const years: number[] = JSON.parse(yearsRaw);
    const results = await Promise.all(years.map((y) => loadGuestSettings(y)));
    return results.filter(Boolean) as Partial<AnnualSettings>[];
  } catch {
    return [];
  }
}

/**
 * ゲストの全設定を取得する（移行処理用）
 */
export async function getGuestAllSettings(): Promise<Partial<AnnualSettings>[]> {
  return loadAllGuestSettings();
}

// ===== メインフック =====

interface UseAnnualSettingsOptions {
  userId?: string | null;
  year?: number;
  autoLoad?: boolean;
}

export function useAnnualSettings(options: UseAnnualSettingsOptions = {}) {
  const { userId, year: yearProp, autoLoad = true } = options;
  const store = useAnnualSettingsStore();
  const year = yearProp ?? store.currentYear;
  const loadedRef = useRef<string | null>(null);

  /**
   * 設定を読み込む
   */
  const load = useCallback(async () => {
    const cacheKey = `${userId ?? "guest"}:${year}`;
    if (loadedRef.current === cacheKey) return; // 重複ロード防止

    store.setLoading(true);
    store.setError(null);
    try {
      if (userId && isSupabaseConfigured()) {
        // Supabase から取得
        const data = await getAnnualSettings(userId, year);
        store.setSettings(data);
        // 全年度データも取得
        const all = await getAllAnnualSettings(userId);
        store.setAllSettings(all);
      } else {
        // ゲストモード: AsyncStorage から取得
        const data = await loadGuestSettings(year);
        store.setSettings(data);
        const all = await loadAllGuestSettings();
        store.setAllSettings(all as AnnualSettings[]);
      }
      loadedRef.current = cacheKey;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "設定の読み込みに失敗しました";
      store.setError(msg);
      console.error("[useAnnualSettings] load error:", err);
    } finally {
      store.setLoading(false);
    }
  }, [userId, year]);

  /**
   * 設定を保存する
   */
  const save = useCallback(
    async (updates: AnnualSettingsUpdate): Promise<boolean> => {
      store.setSaving(true);
      store.setError(null);
      try {
        if (userId && isSupabaseConfigured()) {
          // Supabase に保存
          const saved = await upsertAnnualSettings(userId, year, updates);
          if (saved) {
            store.setSettings(saved);
            // allSettings を更新
            const all = await getAllAnnualSettings(userId);
            store.setAllSettings(all);
          }
          return Boolean(saved);
        } else {
          // ゲストモード: AsyncStorage に保存
          const current = store.settings ?? {};
          const merged = { ...current, ...updates, year };
          await saveGuestSettings(year, merged);
          store.setSettings(merged);
          const all = await loadAllGuestSettings();
          store.setAllSettings(all as AnnualSettings[]);
          return true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "設定の保存に失敗しました";
        store.setError(msg);
        console.error("[useAnnualSettings] save error:", err);
        return false;
      } finally {
        store.setSaving(false);
      }
    },
    [userId, year, store.settings]
  );

  /**
   * 計算結果をキャッシュとして保存する
   */
  const saveCalculationCache = useCallback(
    async (result: {
      cached_take_home: number;
      cached_total_tax: number;
      cached_social_insurance: number;
    }): Promise<void> => {
      if (userId && isSupabaseConfigured()) {
        await cacheCalculationResult(userId, year, result);
      } else {
        // ゲストモード: ローカルに保存
        const current = store.settings ?? {};
        await saveGuestSettings(year, { ...current, ...result, year });
        store.setSettings({ ...current, ...result, year });
      }
    },
    [userId, year, store.settings]
  );

  // 自動ロード
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);

  return {
    settings: store.settings,
    allSettings: store.allSettings,
    loading: store.loading,
    saving: store.saving,
    error: store.error,
    currentYear: store.currentYear,
    setCurrentYear: store.setCurrentYear,
    load,
    save,
    saveCalculationCache,
  };
}
