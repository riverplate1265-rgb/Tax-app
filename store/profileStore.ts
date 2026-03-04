/**
 * profileStore.ts
 * 設定タブで保存したプロフィール情報を計算タブに自動反映するためのストア
 * AsyncStorage で永続化する
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_STORAGE_KEY = "@tax_app_profile";

export interface ChildInfo {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
}

export interface ProfileData {
  // 本人情報
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  workClass: string;
  prefecture: string;
  // 配偶者
  hasSpouse: boolean;
  spouseBirthYear: string;
  spouseBirthMonth: string;
  spouseBirthDay: string;
  // 子供
  childrenCount: number;
  children: ChildInfo[];
  // 年次データ
  annualIncome: string;
  idecoMonthly: string;
  furusatoAmount: string;
  housingLoanBalance: string;
  savedAt: string;
}

// インメモリキャッシュ
let _cachedProfile: ProfileData | null = null;
let _listeners: Array<() => void> = [];

/** プロフィールを保存する */
export async function saveProfile(profile: ProfileData): Promise<void> {
  _cachedProfile = { ...profile, savedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(_cachedProfile));
  } catch (e) {
    console.warn("[profileStore] save failed:", e);
  }
  _listeners.forEach((fn) => fn());
}

/** 保存済みのプロフィールを取得する */
export async function loadProfile(): Promise<ProfileData | null> {
  if (_cachedProfile) return _cachedProfile;
  try {
    const json = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (json) _cachedProfile = JSON.parse(json);
  } catch (e) {
    console.warn("[profileStore] load failed:", e);
  }
  return _cachedProfile;
}

/** 変更リスナーを登録する */
export function subscribeToProfileStore(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((fn) => fn !== listener);
  };
}

/** インメモリキャッシュを直接取得する（同期版） */
export function getProfileSync(): ProfileData | null {
  return _cachedProfile;
}
