/**
 * calculationStore.ts
 * 計算結果をアプリ全体で共有するための軽量グローバルストア
 * AsyncStorage で永続化し、分析タブが最新の計算結果を参照できるようにする
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { type TaxResult } from "@/lib/taxCalculator";

const STORAGE_KEY = "@tax_app_last_result";
const INPUT_STORAGE_KEY = "@tax_app_last_input";

export interface StoredCalculationInput {
  annualIncome: number; // 万円
  age: number;
  prefecture: string;
  hasSpouseDeduction: boolean;
  childrenUnder19: number;
  childrenUnder23: number;
  mode: "simple" | "detailed";
  idecoMonthly?: number;
  furusatoAmount?: number;
  housingLoanBalance?: number;
  lifeInsurancePremium?: number;
  medicalExpenses?: number;
  calculatedAt: string; // ISO8601
}

// インメモリキャッシュ（同セッション内の高速アクセス用）
let _cachedResult: TaxResult | null = null;
let _cachedInput: StoredCalculationInput | null = null;
let _listeners: Array<() => void> = [];

/** 計算結果とその入力を保存する */
export async function saveCalculationResult(
  result: TaxResult,
  input: StoredCalculationInput
): Promise<void> {
  _cachedResult = result;
  _cachedInput = input;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    await AsyncStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(input));
  } catch (e) {
    console.warn("[calculationStore] save failed:", e);
  }
  // リスナーに変更を通知
  _listeners.forEach((fn) => fn());
}

/** 保存済みの計算結果を取得する */
export async function loadCalculationResult(): Promise<{
  result: TaxResult | null;
  input: StoredCalculationInput | null;
}> {
  // インメモリキャッシュがあればそれを返す
  if (_cachedResult && _cachedInput) {
    return { result: _cachedResult, input: _cachedInput };
  }
  try {
    const resultJson = await AsyncStorage.getItem(STORAGE_KEY);
    const inputJson = await AsyncStorage.getItem(INPUT_STORAGE_KEY);
    if (resultJson) _cachedResult = JSON.parse(resultJson);
    if (inputJson) _cachedInput = JSON.parse(inputJson);
  } catch (e) {
    console.warn("[calculationStore] load failed:", e);
  }
  return { result: _cachedResult, input: _cachedInput };
}

/** 変更リスナーを登録する（分析タブが計算タブの結果変更を検知するため） */
export function subscribeToCalculationStore(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((fn) => fn !== listener);
  };
}

/** インメモリキャッシュを直接取得する（同期版、初期レンダリング用） */
export function getCalculationResultSync(): {
  result: TaxResult | null;
  input: StoredCalculationInput | null;
} {
  return { result: _cachedResult, input: _cachedInput };
}
