/**
 * use-calculation-result.ts
 * 計算結果をストアから取得し、変更を監視するカスタムフック
 */

import { useState, useEffect, useCallback } from "react";
import {
  loadCalculationResult,
  subscribeToCalculationStore,
  getCalculationResultSync,
  type StoredCalculationInput,
} from "@/store/calculationStore";
import { type TaxResult } from "@/lib/taxCalculator";

export interface UseCalculationResultReturn {
  result: TaxResult | null;
  input: StoredCalculationInput | null;
  isLoaded: boolean;
  hasData: boolean;
  reload: () => Promise<void>;
}

export function useCalculationResult(): UseCalculationResultReturn {
  // 同期的な初期値（インメモリキャッシュ）
  const syncData = getCalculationResultSync();
  const [result, setResult] = useState<TaxResult | null>(syncData.result);
  const [input, setInput] = useState<StoredCalculationInput | null>(syncData.input);
  const [isLoaded, setIsLoaded] = useState(syncData.result !== null);

  const reload = useCallback(async () => {
    const data = await loadCalculationResult();
    setResult(data.result);
    setInput(data.input);
    setIsLoaded(true);
  }, []);

  // 初回マウント時にAsyncStorageから読み込む
  useEffect(() => {
    reload();
  }, [reload]);

  // ストアの変更を監視（計算タブで計算するたびに更新）
  useEffect(() => {
    const unsubscribe = subscribeToCalculationStore(() => {
      const syncData = getCalculationResultSync();
      setResult(syncData.result);
      setInput(syncData.input);
      setIsLoaded(true);
    });
    return unsubscribe;
  }, []);

  return {
    result,
    input,
    isLoaded,
    hasData: result !== null,
    reload,
  };
}
