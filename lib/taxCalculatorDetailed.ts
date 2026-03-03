/**
 * taxCalculatorDetailed.ts
 * 詳細モード専用の税金計算モジュール
 * iDeCo・ふるさと納税・住宅ローン控除・生命保険料控除などを含む精密計算
 * 適用法令: 令和8年度（2026年）
 */

import { calculateTax, type TaxInput, type TaxResult } from "./taxCalculator";

/**
 * 詳細モード用の追加入力
 */
export interface DetailedTaxInput extends TaxInput {
  // 月収・賞与の明示的な指定（オプション）
  monthlyIncome?: number;   // 月収（万円）
  bonusAmount?: number;     // 賞与合計（万円）
  commutingAllowance?: number; // 通勤手当（年間・万円）

  // 節税関連の控除
  idecoMonthly?: number;    // iDeCo月額掛金（円）
  furusatoNouzei?: number;  // ふるさと納税寄附金額（年間・円）
  housingLoanBalance?: number; // 住宅ローン残高（円）
  lifeInsurancePremium?: number; // 生命保険料（年間・円）
  earthquakeInsurancePremium?: number; // 地震保険料（年間・円）
  medicalExpenses?: number; // 医療費（年間・円）
}

/**
 * 詳細モード用の計算結果（TaxResultを拡張）
 */
export interface DetailedTaxResult extends TaxResult {
  // 節税効果
  idecoDeduction: number;          // iDeCo控除額（年間・円）
  furusatoTaxCredit: number;       // ふるさと納税税額控除（円）
  housingLoanDeduction: number;    // 住宅ローン控除（円）
  lifeInsuranceDeduction: number;  // 生命保険料控除（円）
  earthquakeInsuranceDeduction: number; // 地震保険料控除（円）
  medicalExpenseDeduction: number; // 医療費控除（円）

  // 節税後の実質手取り
  effectiveTakeHome: number;       // 節税効果を含む実質手取り（円）
  taxSavings: number;              // 節税効果合計（円）

  // iDeCo節税提案
  idecoMaxMonthly: number;         // iDeCo最大掛金（月額・円）
  idecoOptimalMonthly: number;     // iDeCo最適掛金（月額・円）
  idecoMaxSavings: number;         // iDeCo最大節税効果（年間・円）

  // ふるさと納税節税提案
  furusatoOptimalAmount: number;   // ふるさと納税最適額（円）
}

/**
 * iDeCoの上限掛金を計算する
 * 職種区分によって上限が異なる
 */
export function calcIdecoMax(workClassification: string): number {
  switch (workClassification) {
    case "会社員（企業年金なし）":
      return 23_000; // 月額2.3万円
    case "会社員（企業年金あり）":
      return 12_000; // 月額1.2万円
    case "公務員":
      return 12_000; // 月額1.2万円
    case "自営業・フリーランス":
      return 68_000; // 月額6.8万円
    default:
      return 23_000; // デフォルト: 会社員（企業年金なし）
  }
}

/**
 * ふるさと納税の目安上限額を計算する
 * 住民税所得割の20%が控除上限（ワンストップ特例の場合）
 * 簡易計算: 年収と家族構成から概算
 */
export function calcFurusatoOptimal(
  annualIncome: number, // 円
  hasSpouseDeduction: boolean,
  childrenCount: number
): number {
  // 住民税所得割の概算（年収の約10%から控除を引いた額の10%）
  // 参考: 総務省「ふるさと納税ポータルサイト」控除額の目安
  const baseAmount = annualIncome * 0.10 * 0.20;
  const spouseReduction = hasSpouseDeduction ? 5_000 : 0;
  const childrenReduction = childrenCount * 3_000;
  return Math.max(0, Math.round(baseAmount - spouseReduction - childrenReduction));
}

/**
 * 生命保険料控除額を計算する（所得税）
 * 令和8年度: 新契約（2012年以降）の場合
 * 一般生命保険料・介護医療保険料・個人年金保険料それぞれ最大4万円、合計最大12万円
 */
function calcLifeInsuranceDeduction(premium: number): number {
  if (premium <= 20_000) return premium;
  if (premium <= 40_000) return Math.floor(premium / 2) + 10_000;
  if (premium <= 80_000) return Math.floor(premium / 4) + 20_000;
  return 40_000; // 上限4万円
}

/**
 * 地震保険料控除額を計算する（所得税）
 * 地震保険料: 全額控除（上限5万円）
 */
function calcEarthquakeInsuranceDeduction(premium: number): number {
  return Math.min(premium, 50_000);
}

/**
 * 医療費控除額を計算する（所得税）
 * 医療費 - 10万円（または所得の5%のいずれか低い方）= 控除額（上限200万円）
 */
function calcMedicalExpenseDeduction(expenses: number, totalIncome: number): number {
  const threshold = Math.min(100_000, totalIncome * 0.05);
  return Math.max(0, Math.min(expenses - threshold, 2_000_000));
}

/**
 * 住宅ローン控除額を計算する
 * 令和8年度: 年末残高の0.7%（上限あり）
 * 新築・認定住宅の場合: 上限35万円
 */
function calcHousingLoanDeduction(loanBalance: number): number {
  const deduction = Math.floor(loanBalance * 0.007);
  return Math.min(deduction, 350_000);
}

/**
 * ふるさと納税の税額控除を計算する（ワンストップ特例）
 * 寄附金 - 2,000円 が住民税から控除される（上限: 住民税所得割の20%）
 */
function calcFurusatoTaxCredit(
  donation: number,
  residentTaxShotokuWari: number
): number {
  const maxCredit = Math.floor(residentTaxShotokuWari * 0.20);
  const credit = Math.max(0, donation - 2_000);
  return Math.min(credit, maxCredit);
}

/**
 * 詳細モードの税金計算メイン関数
 */
export function calculateDetailedTax(input: DetailedTaxInput): DetailedTaxResult {
  // まず基本計算を実行（簡易モードと同じロジック）
  const baseResult = calculateTax(input);

  const annualIncome = input.annualIncome * 10_000;
  const totalIncome = baseResult.annualIncome - 
    (annualIncome <= 1_625_000 ? 740_000 :
     annualIncome <= 1_800_000 ? Math.floor(annualIncome * 0.4) - 100_000 :
     annualIncome <= 3_600_000 ? Math.floor(annualIncome * 0.3) + 80_000 :
     annualIncome <= 6_600_000 ? Math.floor(annualIncome * 0.2) + 440_000 :
     annualIncome <= 8_500_000 ? Math.floor(annualIncome * 0.1) + 1_100_000 :
     1_950_000);

  // ===== iDeCo控除 =====
  const idecoMonthly = input.idecoMonthly ?? 0;
  const idecoAnnual = idecoMonthly * 12;
  const idecoDeduction = idecoAnnual; // 全額所得控除

  // ===== 生命保険料控除 =====
  const lifeInsuranceDeduction = calcLifeInsuranceDeduction(
    input.lifeInsurancePremium ?? 0
  );

  // ===== 地震保険料控除 =====
  const earthquakeInsuranceDeduction = calcEarthquakeInsuranceDeduction(
    input.earthquakeInsurancePremium ?? 0
  );

  // ===== 医療費控除 =====
  const medicalExpenseDeduction = calcMedicalExpenseDeduction(
    input.medicalExpenses ?? 0,
    totalIncome
  );

  // ===== 住宅ローン控除 =====
  const housingLoanDeduction = calcHousingLoanDeduction(
    input.housingLoanBalance ?? 0
  );

  // ===== 追加控除による節税効果の計算 =====
  const additionalDeductions = idecoDeduction + lifeInsuranceDeduction + 
    earthquakeInsuranceDeduction + medicalExpenseDeduction;

  // 追加控除による所得税の節税効果（概算: 限界税率 × 追加控除額）
  const incomeTaxRate = baseResult.incomeTax > 0 ? 
    (baseResult.incomeTax / baseResult.annualIncome) * 1.5 : 0.05;
  const incomeTaxSavings = Math.floor(additionalDeductions * Math.min(incomeTaxRate, 0.45));

  // 住民税の節税効果（10%）
  const residentTaxSavings = Math.floor(additionalDeductions * 0.10);

  // ふるさと納税の税額控除
  const residentTaxShotokuWari = Math.floor(
    Math.max(0, totalIncome - 430_000 - baseResult.totalSocialInsurance) * 0.10
  );
  const furusatoTaxCredit = calcFurusatoTaxCredit(
    input.furusatoNouzei ?? 0,
    residentTaxShotokuWari
  );

  // 節税効果合計
  const taxSavings = incomeTaxSavings + residentTaxSavings + 
    furusatoTaxCredit + housingLoanDeduction;

  // 実質手取り（節税効果を加算）
  const effectiveTakeHome = baseResult.takeHome + taxSavings;

  // ===== iDeCo節税提案 =====
  const workClass = (input as any).workClassification ?? "会社員（企業年金なし）";
  const idecoMaxMonthly = calcIdecoMax(workClass);
  const idecoMaxAnnual = idecoMaxMonthly * 12;
  const idecoMaxSavings = Math.floor(idecoMaxAnnual * (incomeTaxRate + 0.10));
  // 現在の掛金が最大に達していない場合、最大額を推奨
  const idecoOptimalMonthly = idecoMonthly < idecoMaxMonthly ? idecoMaxMonthly : idecoMonthly;

  // ===== ふるさと納税最適額 =====
  const furusatoOptimalAmount = calcFurusatoOptimal(
    annualIncome,
    input.hasSpouseDeduction,
    input.childrenUnder19 + input.childrenUnder23
  );

  return {
    ...baseResult,
    idecoDeduction,
    furusatoTaxCredit,
    housingLoanDeduction,
    lifeInsuranceDeduction,
    earthquakeInsuranceDeduction,
    medicalExpenseDeduction,
    effectiveTakeHome,
    taxSavings,
    idecoMaxMonthly,
    idecoOptimalMonthly,
    idecoMaxSavings,
    furusatoOptimalAmount,
  };
}

/**
 * 将来の手取り推移をシミュレーションする
 * @param currentAge 現在の年齢
 * @param currentIncome 現在の年収（万円）
 * @param annualGrowthRate 年収上昇率（デフォルト: 2%）
 * @param retirementAge 退職年齢（デフォルト: 65歳）
 */
export function simulateFutureIncome(
  currentAge: number,
  currentIncome: number,
  annualGrowthRate: number = 0.02,
  retirementAge: number = 65
): Array<{ age: number; annualIncome: number; takeHome: number; savings: number }> {
  const results = [];
  let income = currentIncome;

  for (let age = currentAge; age <= retirementAge; age++) {
    const birthDate = new Date(
      new Date().getFullYear() - age,
      new Date().getMonth(),
      new Date().getDate()
    );
    const taxResult = calculateTax({
      birthDate,
      annualIncome: income,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });

    const takeHomeMan = Math.round(taxResult.takeHome / 10_000);
    // 生活費を手取りの60%と仮定、残りを貯蓄
    const savingsMan = Math.round(takeHomeMan * 0.40);

    results.push({
      age,
      annualIncome: Math.round(income),
      takeHome: takeHomeMan,
      savings: savingsMan,
    });

    income = income * (1 + annualGrowthRate);
  }

  return results;
}

/**
 * 税の使い道を計算する（概算）
 * 納税額を主要な用途別に按分
 */
export function calcTaxUsage(totalTax: number): Array<{ label: string; amount: number; ratio: number }> {
  // 国の一般会計歳出の概算比率（令和8年度予算ベース）
  const categories = [
    { label: "社会保障", ratio: 0.335 },
    { label: "国債費", ratio: 0.234 },
    { label: "地方交付税", ratio: 0.154 },
    { label: "公共事業", ratio: 0.059 },
    { label: "文教・科学", ratio: 0.053 },
    { label: "防衛", ratio: 0.062 },
    { label: "その他", ratio: 0.103 },
  ];

  return categories.map(({ label, ratio }) => ({
    label,
    amount: Math.round(totalTax * ratio),
    ratio: Math.round(ratio * 1000) / 10,
  }));
}
