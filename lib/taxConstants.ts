/**
 * 年度別税制・社会保険料定数
 *
 * 来年以降に法令改正があった場合は、新しい年度のエントリを追加するだけで対応できます。
 * 計算エンジン（taxCalculator.ts）は getTaxConstants(year) で年度別定数を取得します。
 *
 * 追加方法：
 *   1. 下記 TAX_CONSTANTS_BY_YEAR に新年度のキーを追加
 *   2. 変更された料率・控除額のみ前年度から差分で更新
 *   3. 都道府県別健康保険料率が変わる場合は kenpoHealthRates を更新
 */

import { KENPO_HEALTH_RATES as RATES_2026 } from "./constants";

export interface TaxConstants {
  /** 年度 */
  year: number;
  /** 協会けんぽ 健康保険料率（都道府県別・被保険者負担分 %） */
  kenpoHealthRates: Record<string, number>;
  /** 介護保険料率（被保険者負担分 %）40歳以上65歳未満 */
  kaigoRate: number;
  /** 子ども・子育て支援金料率（被保険者負担分 %）*/
  kodomoKosodateRate: number;
  /** 厚生年金保険料率（被保険者負担分 %）*/
  kouseiNenkinRate: number;
  /** 雇用保険料率（被保険者負担分 %）一般事業 */
  koyoHokenRate: number;
  /** 給与所得控除の最低保障額（円）*/
  kyuyoShotokuKojoMin: number;
  /** 基礎控除額（円）合計所得2400万円以下の場合 */
  kihonKojoBase: number;
  /** 住民税基礎控除額（円）*/
  kihonKojoJuminBase: number;
  /** 備考（法令改正の概要） */
  notes?: string;
}

/**
 * 2025年度（令和7年分）定数
 * - 給与所得控除最低保障額：65万円（令和7年分まで本則）
 * - 基礎控除：48万円
 * - 介護保険料率：1.60%（被保険者負担0.80%）
 * - 雇用保険料率：0.6%（令和7年度）
 * - 子ども・子育て支援金：2025年度は徴収なし（令和8年4月開始）
 */
const CONSTANTS_2025: TaxConstants = {
  year: 2025,
  kenpoHealthRates: {
    "北海道":  5.10,
    "青森県":  4.90,
    "岩手県":  4.75,
    "宮城県":  5.00,
    "秋田県":  4.97,
    "山形県":  4.86,
    "福島県":  4.73,
    "茨城県":  4.74,
    "栃木県":  4.89,
    "群馬県":  4.82,
    "埼玉県":  4.79,
    "千葉県":  4.84,
    "東京都":  4.90,
    "神奈川県": 4.93,
    "新潟県":  4.58,
    "富山県":  4.77,
    "石川県":  4.82,
    "福井県":  4.84,
    "山梨県":  4.76,
    "長野県":  4.79,
    "岐阜県":  4.88,
    "静岡県":  4.78,
    "愛知県":  4.95,
    "三重県":  4.87,
    "滋賀県":  4.92,
    "京都府":  4.93,
    "大阪府":  5.04,
    "兵庫県":  5.03,
    "奈良県":  4.94,
    "和歌山県": 5.01,
    "鳥取県":  4.91,
    "島根県":  4.95,
    "岡山県":  5.00,
    "広島県":  4.87,
    "山口県":  5.06,
    "徳島県":  5.10,
    "香川県":  4.99,
    "愛媛県":  4.97,
    "高知県":  5.00,
    "福岡県":  5.03,
    "佐賀県":  5.25,
    "長崎県":  5.01,
    "熊本県":  5.02,
    "大分県":  5.02,
    "宮崎県":  4.87,
    "鹿児島県": 5.04,
    "沖縄県":  4.70,
  },
  kaigoRate: 0.80,           // 1.60% / 2（令和7年度）
  kodomoKosodateRate: 0.0,   // 令和8年4月開始のため2025年度は0
  kouseiNenkinRate: 9.15,    // 18.3% / 2（平成29年以降固定）
  koyoHokenRate: 0.6,        // 令和7年度
  kyuyoShotokuKojoMin: 650_000,  // 令和7年分まで：65万円
  kihonKojoBase: 480_000,        // 令和7年分まで：48万円
  kihonKojoJuminBase: 430_000,   // 令和7年分まで：43万円
  notes: "令和7年分。給与所得控除最低保障額65万円、基礎控除48万円。子ども・子育て支援金は未徴収。",
};

/**
 * 2026年度（令和8年分）定数
 * - 給与所得控除最低保障額：74万円（令和8年度改正・特例5万円上乗せ）
 * - 基礎控除：58万円（令和8年度改正・10万円引き上げ）
 * - 住民税基礎控除：53万円（令和8年度改正）
 * - 介護保険料率：1.62%（被保険者負担0.81%）
 * - 子ども・子育て支援金：0.23%（被保険者負担0.115%）令和8年4月開始
 * - 雇用保険料率：0.6%（令和7年度継続）
 */
const CONSTANTS_2026: TaxConstants = {
  year: 2026,
  kenpoHealthRates: RATES_2026,
  kaigoRate: 0.81,           // 1.62% / 2（令和8年3月改定）
  kodomoKosodateRate: 0.115, // 0.23% / 2（令和8年4月開始）
  kouseiNenkinRate: 9.15,    // 18.3% / 2（固定）
  koyoHokenRate: 0.6,        // 令和7年度継続
  kyuyoShotokuKojoMin: 740_000,  // 令和8年分：74万円（特例）
  kihonKojoBase: 580_000,        // 令和8年分：58万円（改正）
  kihonKojoJuminBase: 530_000,   // 令和8年分：53万円（改正）
  notes: "令和8年分。給与所得控除最低保障額74万円、基礎控除58万円に引き上げ。子ども・子育て支援金0.23%開始。",
};

/**
 * 年度別定数マップ
 * ここに新年度のエントリを追加するだけで計算エンジンが対応します
 */
const TAX_CONSTANTS_BY_YEAR: Record<number, TaxConstants> = {
  2025: CONSTANTS_2025,
  2026: CONSTANTS_2026,
  // 2027: CONSTANTS_2027, ← 来年度改正時にここに追加
};

/**
 * 指定年度の税制定数を取得する
 * 対応していない年度は最新年度の定数を使用
 */
export function getTaxConstants(year: number): TaxConstants {
  if (TAX_CONSTANTS_BY_YEAR[year]) {
    return TAX_CONSTANTS_BY_YEAR[year];
  }
  // 対応年度外は最新年度を使用
  const years = Object.keys(TAX_CONSTANTS_BY_YEAR).map(Number).sort((a, b) => b - a);
  return TAX_CONSTANTS_BY_YEAR[years[0]];
}

/**
 * 対応している年度リストを返す
 */
export function getSupportedYears(): number[] {
  return Object.keys(TAX_CONSTANTS_BY_YEAR).map(Number).sort((a, b) => a - b);
}
