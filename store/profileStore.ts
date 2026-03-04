/**
 * profileStore.ts
 * 設定タブで保存したプロフィール情報を計算タブに自動反映するためのストア
 * AsyncStorage で永続化する
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_STORAGE_KEY = "@tax_app_profile";
const ANNUAL_DATA_STORAGE_KEY = "@tax_app_annual_data";

export type DisabilityType = "none" | "general" | "special" | "cohabiting_special";

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
  workPrefecture: string;   // 勤務都道府県
  // 障害者
  disabilityType: DisabilityType;  // none: なし, general: 障害者, special: 特別障害者, cohabiting_special: 同居特別障害者
  // 配偶者
  hasSpouse: boolean;
  spouseBirthYear: string;
  spouseBirthMonth: string;
  spouseBirthDay: string;
  // 子供
  childrenCount: number;
  children: ChildInfo[];
  savedAt: string;
}

export interface AnnualData {
  year: number;
  annualIncome: string;          // 年収（万円）
  spouseIncome: string;          // 配偶者の見込み年収（万円）
  commutingAllowance: string;    // 通勤手当（万円）
  idecoMonthly: string;          // iDeCo月額（円）
  furusatoAmount: string;        // ふるさと納税（円）
  housingLoanBalance: string;    // 住宅ローン年末残高（万円）
  lifeInsurance: string;         // 生命保険料（円）
  medicalExpenses: string;       // 医療費年間見込額（円）
  workPrefecture: string;        // 勤務都道府県（年次データ側）
  savedAt: string;
}

// 年次データの辞書型（year -> AnnualData）
export type AnnualDataMap = Record<number, AnnualData>;

// インメモリキャッシュ
let _cachedProfile: ProfileData | null = null;
let _cachedAnnualData: AnnualDataMap = {};
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

/** 年次データを保存する（年度別） */
export async function saveAnnualData(data: AnnualData): Promise<void> {
  await loadAllAnnualData(); // キャッシュを確保
  _cachedAnnualData[data.year] = { ...data, savedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(ANNUAL_DATA_STORAGE_KEY, JSON.stringify(_cachedAnnualData));
  } catch (e) {
    console.warn("[profileStore] saveAnnualData failed:", e);
  }
  _listeners.forEach((fn) => fn());
}

/** 全年次データを取得する */
export async function loadAllAnnualData(): Promise<AnnualDataMap> {
  if (Object.keys(_cachedAnnualData).length > 0) return _cachedAnnualData;
  try {
    const json = await AsyncStorage.getItem(ANNUAL_DATA_STORAGE_KEY);
    if (json) _cachedAnnualData = JSON.parse(json);
  } catch (e) {
    console.warn("[profileStore] loadAllAnnualData failed:", e);
  }
  return _cachedAnnualData;
}

/** 指定年度の年次データを取得する */
export async function loadAnnualData(year: number): Promise<AnnualData | null> {
  const all = await loadAllAnnualData();
  return all[year] ?? null;
}

/** 保存済み年度の一覧を取得する（降順） */
export async function getSavedYears(): Promise<number[]> {
  const all = await loadAllAnnualData();
  return Object.keys(all)
    .map(Number)
    .sort((a, b) => b - a);
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

/** 年次データのインメモリキャッシュを直接取得する（同期版） */
export function getAnnualDataSync(year: number): AnnualData | null {
  return _cachedAnnualData[year] ?? null;
}
