import {
  HYOJUN_HOSHU_TABLE,
  NENKIN_HYOJUN_TABLE,
} from "./constants";
import { getTaxConstants } from "./taxConstants";

export interface TaxInput {
  birthDate: Date;
  annualIncome: number; // 万円単位
  /** 計算対象年度（省略時は現在年度） */
  targetYear?: number;
  hasSpouseDeduction: boolean;
  spouseDeductionOverride?: number; // 配偶者控除額のオーバーライド（年収から自動計算時に使用）
  childrenUnder19: number; // 16歳以19歳未満
  childrenUnder23: number; // 19歳以22歳以下
  prefecture: string;
  disabilityType?: "none" | "general" | "special" | "cohabiting_special"; // 障害者区分
  // 詳細モード専用（オプショナル）
  idecoMonthly?: number;          // iDeCo月額掛金（円）
  furusatoAmount?: number;        // ふるさと納税寄付金額（年間・円）
  housingLoanBalance?: number;    // 住宅ローン年末残高（円）
  lifeInsurancePremium?: number;  // 生命保険料（年間・円）
  medicalExpenses?: number;       // 医療費（年間・円）
  // 社会保険料算出パターン
  socialInsuranceMode?: "auto" | "hyojun" | "actual" | "manual";
  hyojunHoshu?: number;           // 標準報酬月額（円）：モード2
  actualAprilSalary?: number;     // 4月実績給与（円）：モード3
  actualMaySalary?: number;       // 5月実績給与（円）：モード3
  actualJuneSalary?: number;      // 6月実績給与（円）：モード3
  manualSocialInsurance?: number; // 保険料直接入力（年額円）：モード4
}

export interface TaxResult {
  annualIncome: number;                   // 年収（円）
  standardMonthlyRemuneration: number;    // 標準報酬月額（健康保険用・円）
  standardBonusRemunerationKenpo: number; // 標準賞与額・健康保険用（1回あたり・円）
  standardBonusRemunerationNenkin: number;// 標準賞与額・厚生年金用（1回あたり・円）
  healthInsurance: number;                // 健康保険料（年間・円）
  nursingInsurance: number;               // 介護保険料（年間・円）
  kodomoKosodate: number;                 // 子ども・子育て支援金（年間・円）
  pensionInsurance: number;               // 厚生年金保険料（年間・円）
  employmentInsurance: number;            // 雇用保険料（年間・円）
  totalSocialInsurance: number;           // 社会保険料合計（年間・円）
  incomeTax: number;                      // 所得税（年間・円）
  residentTax: number;                    // 住民税（年間・円）
  totalTax: number;                       // 税金合計（年間・円）
  takeHome: number;                       // 手取り（年間・円）
  takeHomeRatio: number;                  // 手取り割合（%）
  // 詳細モード追加情報
  idecoDeduction?: number;               // iDeCo控除額（年間・円）
  furusatoTaxCredit?: number;            // ふるさと納税税額控除額（円）
  housingLoanDeductionApplied?: number;  // 適用された住宅ローン控除額（円）
  lifeInsuranceDeduction?: number;       // 生命保険料控除額（円）
  medicalExpenseDeduction?: number;      // 医療費控除額（円）
  totalDeductions?: number;              // 詳細控除合計（円）
  taxSavings?: number;                   // 節税効果（簡易モード比較・円）
}

/**
 * 年齢を計算する（計算基準日: 当年の1月1日）
 */
function calcAge(birthDate: Date, referenceYear: number): number {
  const jan1 = new Date(referenceYear, 0, 1);
  let age = jan1.getFullYear() - birthDate.getFullYear();
  const m = jan1.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && jan1.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * 標準報酬月額を求める（健康保険用）
 */
function getHyojunHoshu(monthlyRemuneration: number): number {
  for (const [, lower, upper, standard] of HYOJUN_HOSHU_TABLE) {
    if (monthlyRemuneration >= lower && monthlyRemuneration < upper) {
      return standard;
    }
  }
  return HYOJUN_HOSHU_TABLE[HYOJUN_HOSHU_TABLE.length - 1][3];
}

/**
 * 標準報酬月額を求める（厚生年金用）
 */
function getNenkinHyojunHoshu(monthlyRemuneration: number): number {
  for (const [, lower, upper, standard] of NENKIN_HYOJUN_TABLE) {
    if (monthlyRemuneration >= lower && monthlyRemuneration < upper) {
      return standard;
    }
  }
  return NENKIN_HYOJUN_TABLE[NENKIN_HYOJUN_TABLE.length - 1][3];
}

/**
 * 標準賞与額を求める
 * 健康保険: 上限573万円（年間累計）
 * 厚生年金: 上限150万円（1回あたり）
 * 端数処理: 1,000円未満切り捨て
 */
function getHyojunShoyo(bonusAmount: number, type: "kenpo" | "nenkin"): number {
  const truncated = Math.floor(bonusAmount / 1000) * 1000;
  if (type === "kenpo") {
    return Math.min(truncated, 5_730_000);
  } else {
    return Math.min(truncated, 1_500_000);
  }
}

/**
 * 給与所得控除額を計算する（年度別最低保障額を受取）
 * @param annualIncome 年収（円）
 * @param minAmount 最低保障額（年度別定数から取得）
 */
export function calcKyuyoShotokuKojoByYear(annualIncome: number, minAmount: number): number {
  if (annualIncome <= 1_625_000) return minAmount;
  if (annualIncome <= 1_800_000) return Math.floor(annualIncome * 0.4) - 100_000;
  if (annualIncome <= 3_600_000) return Math.floor(annualIncome * 0.3) + 80_000;
  if (annualIncome <= 6_600_000) return Math.floor(annualIncome * 0.2) + 440_000;
  if (annualIncome <= 8_500_000) return Math.floor(annualIncome * 0.1) + 1_100_000;
  return 1_950_000;
}

/**
 * 給与所得控除額を計算する（互換性のためのラッパー・現在年度を使用）
 */
export function calcKyuyoShotokuKojo(annualIncome: number): number {
  const currentYear = new Date().getFullYear();
  const tc = getTaxConstants(currentYear);
  return calcKyuyoShotokuKojoByYear(annualIncome, tc.kyuyoShotokuKojoMin);
}

/**
 * 基礎控除額を計算する（年度別基本額を受取）
 * 年度別の定数（kihonKojoBase）に応じて段階的に変化
 */
function calcKihonKojoByYear(totalIncome: number, baseAmount: number): number {
  // 令和8年度：58万円・令和7年度以前：48万円
  // 逃減間の山は共通（合計所得に応じて段階的に縮小）
  const base = baseAmount;
  if (totalIncome <= 24_000_000) return base;
  if (totalIncome <= 24_500_000) return Math.round(base * 2 / 3);
  if (totalIncome <= 25_000_000) return Math.round(base / 3);
  return 0;
}

/**
 * 住民税の基礎控除額を計算する（年度別基本額を受取）
 */
function calcKihonKojoJuminByYear(totalIncome: number, baseAmount: number): number {
  if (totalIncome <= 24_000_000) return baseAmount;
  if (totalIncome <= 24_500_000) return Math.round(baseAmount * 2 / 3);
  if (totalIncome <= 25_000_000) return Math.round(baseAmount / 3);
  return 0;
}

/**
 * 所得税の税率と控除額を返す（超過累進税率）
 * 令和8年分：税率自体は変更なし（5%〜45%の7段階）
 */
function getIncomeTaxRate(taxableIncome: number): { rate: number; deduction: number } {
  if (taxableIncome <= 1_950_000)  return { rate: 0.05, deduction: 0 };
  if (taxableIncome <= 3_300_000)  return { rate: 0.10, deduction: 97_500 };
  if (taxableIncome <= 6_950_000)  return { rate: 0.20, deduction: 427_500 };
  if (taxableIncome <= 9_000_000)  return { rate: 0.23, deduction: 636_000 };
  if (taxableIncome <= 18_000_000) return { rate: 0.33, deduction: 1_536_000 };
  if (taxableIncome <= 40_000_000) return { rate: 0.40, deduction: 2_796_000 };
  return { rate: 0.45, deduction: 4_796_000 };
}

/**
 * iDeCo控除額を計算する
 * 拠出額は全額小規模企業共済等掛金控除として所得控除
 * 上限: 会社員（企業型DCなし）= 月2.3万円 = 年27.6万円
 */
export function calcIdecoDeduction(idecoMonthly: number): number {
  const annual = idecoMonthly * 12;
  // 上限: 月2.3万円（会社員・企業型DCなし）
  return Math.min(annual, 276_000);
}

/**
 * 生命保険料控除額を計算する（所得税）
 * 新制度（平成24年以降の契約）
 * 一般生命保険料・介護医療保険料・個人年金保険料それぞれ最大4万円、合計最大12万円
 * 簡易計算：年間保険料から控除額を算出（一般生命保険料のみとして計算）
 */
export function calcLifeInsuranceDeduction(annualPremium: number): number {
  // 新制度の控除額計算（一般生命保険料として計算）
  if (annualPremium <= 20_000) return annualPremium;
  if (annualPremium <= 40_000) return Math.floor(annualPremium / 2) + 10_000;
  if (annualPremium <= 80_000) return Math.floor(annualPremium / 4) + 20_000;
  return 40_000; // 上限4万円
}

/**
 * 医療費控除額を計算する
 * 控除額 = 実際の医療費 - 保険金等で補填された金額 - 10万円（または総所得の5%の低い方）
 * 上限: 200万円
 */
export function calcMedicalExpenseDeduction(medicalExpenses: number, totalIncome: number): number {
  const threshold = Math.min(100_000, totalIncome * 0.05);
  const deduction = Math.max(0, medicalExpenses - threshold);
  return Math.min(deduction, 2_000_000);
}

/**
 * 住宅ローン控除額を計算する（令和8年度）
 * 控除額 = 年末残高 × 0.7%（令和4年以降の入居）
 * 上限: 新築認定住宅 35万円、新築ZEH水準 31.5万円、新築省エネ基準 28万円、その他 21万円
 * 簡易計算として年末残高 × 0.7%、上限35万円で計算
 */
export function calcHousingLoanDeduction(loanBalance: number): number {
  const deduction = Math.floor(loanBalance * 0.007);
  return Math.min(deduction, 350_000);
}

/**
 * ふるさと納税の税額控除額を計算する
 * 所得税：(寄付金額 - 2,000円) × 所得税率 × 1.021（復興税）
 * 住民税（基本分）：(寄付金額 - 2,000円) × 10%
 * 住民税（特例分）：(寄付金額 - 2,000円) × (90% - 所得税率 × 1.021)
 * 合計で (寄付金額 - 2,000円) の実質全額が控除される（ワンストップ特例または確定申告）
 * ただし住民税特例分の上限: 住民税所得割額 × 20%
 */
function calcFurusatoTaxCredit(
  furusatoAmount: number,
  taxableIncome: number,
  taxableIncomeJumin: number
): { incomeTaxCredit: number; residentTaxCredit: number; total: number } {
  if (furusatoAmount <= 2_000) return { incomeTaxCredit: 0, residentTaxCredit: 0, total: 0 };
  const base = furusatoAmount - 2_000;
  const { rate } = getIncomeTaxRate(taxableIncome);
  // 所得税控除（確定申告の場合）
  const incomeTaxCredit = Math.floor(base * rate * 1.021);
  // 住民税（基本分）
  const residentTaxBasic = Math.floor(base * 0.10);
  // 住民税（特例分）
  const specialRate = Math.max(0, 0.90 - rate * 1.021);
  const residentTaxSpecial = Math.floor(base * specialRate);
  // 住民税特例分の上限チェック（住民税所得割の20%）
  const residentTaxShotokuWari = Math.floor(taxableIncomeJumin * 0.10);
  const residentTaxSpecialCapped = Math.min(residentTaxSpecial, Math.floor(residentTaxShotokuWari * 0.20));
  const residentTaxCredit = residentTaxBasic + residentTaxSpecialCapped;
  const total = incomeTaxCredit + residentTaxCredit;
  return { incomeTaxCredit, residentTaxCredit, total };
}

/**
 * 税金・社会保険料の計算メイン関数
 * targetYearを指定すると年度別の税制定数で計算される
 */
export function calculateTax(input: TaxInput): TaxResult {
  const currentYear = new Date().getFullYear();
  const targetYear = input.targetYear ?? currentYear;
  const age = calcAge(input.birthDate, targetYear);
  const annualIncome = input.annualIncome * 10_000; // 万円→円

  // 年度別税制定数を取得
  const tc = getTaxConstants(targetYear);

  // ===== 月収・賞与の分割 =====
  // 賞与は月収×4ヶ月分。年収 = 月収×12 + 月収×4 = 月収×16
  const monthlyIncome = Math.round(annualIncome / 16);
  // 賞与は年2回（夏・冬）を想定し、1回あたり月収×2ヶ月分
  const bonusPerPayment = monthlyIncome * 2;
  const bonusPayments = 2;

  // ===== 社会保険料算出パターン =====
  const siMode = input.socialInsuranceMode ?? "auto";

  // 標準報酬月額の決定（モード1：自動推定、モード2：直接指定、モード3：4〜6月実績）
  let effectiveMonthlyIncome = monthlyIncome;
  if (siMode === "hyojun" && input.hyojunHoshu && input.hyojunHoshu > 0) {
    effectiveMonthlyIncome = input.hyojunHoshu;
  } else if (siMode === "actual" &&
    input.actualAprilSalary && input.actualMaySalary && input.actualJuneSalary) {
    // 4・5・6月の平均から標準報酬月額を判定
    const avgSalary = (input.actualAprilSalary + input.actualMaySalary + input.actualJuneSalary) / 3;
    effectiveMonthlyIncome = avgSalary;
  }

  // ===== 標準報酬月額（月給分）=====
  const hyojunHoshuKenpo = getHyojunHoshu(effectiveMonthlyIncome);
  const hyojunHoshuNenkin = getNenkinHyojunHoshu(effectiveMonthlyIncome);

  // ===== 標準賞与額（賞与分）=====
  const hyojunShoyoKenpo = getHyojunShoyo(bonusPerPayment, "kenpo");
  const hyojunShoyoNenkin = getHyojunShoyo(bonusPerPayment, "nenkin");

  // ===== 健康保険料 =====
  const healthRate = tc.kenpoHealthRates[input.prefecture] ?? tc.kenpoHealthRates["東京都"] ?? 4.925;
  const monthlyHealthInsurance = Math.floor(hyojunHoshuKenpo * (healthRate / 100));
  const annualHealthFromSalary = monthlyHealthInsurance * 12;
  const bonusHealthInsurance = Math.floor(hyojunShoyoKenpo * (healthRate / 100)) * bonusPayments;
  const annualHealthInsurance = annualHealthFromSalary + bonusHealthInsurance;

  // ===== 介護保険料（40歳以上65歳未満のみ）=====
  let annualNursingInsurance = 0;
  if (age >= 40 && age < 65) {
    const monthlyNursing = Math.floor(hyojunHoshuKenpo * (tc.kaigoRate / 100));
    const annualNursingFromSalary = monthlyNursing * 12;
    const bonusNursing = Math.floor(hyojunShoyoKenpo * (tc.kaigoRate / 100)) * bonusPayments;
    annualNursingInsurance = annualNursingFromSalary + bonusNursing;
  }

  // ===== 子ども・子育て支援金 =====
  const monthlyKodomo = Math.floor(hyojunHoshuKenpo * (tc.kodomoKosodateRate / 100));
  const annualKodomoFromSalary = monthlyKodomo * 12;
  const bonusKodomo = Math.floor(hyojunShoyoKenpo * (tc.kodomoKosodateRate / 100)) * bonusPayments;
  const annualKodomoKosodate = annualKodomoFromSalary + bonusKodomo;

  // ===== 年金保険料 =====
  const monthlyPension = Math.floor(hyojunHoshuNenkin * (tc.kouseiNenkinRate / 100));
  const annualPensionFromSalary = monthlyPension * 12;
  const bonusPension = Math.floor(hyojunShoyoNenkin * (tc.kouseiNenkinRate / 100)) * bonusPayments;
  const annualPension = annualPensionFromSalary + bonusPension;

  // ===== 雇用保険料 =====
  const annualEmployment = Math.floor(annualIncome * (tc.koyoHokenRate / 100));

  // ===== 社会保険料合計 =====
  let totalSocialInsurance: number;
  if (siMode === "manual" && input.manualSocialInsurance && input.manualSocialInsurance > 0) {
    // モード4：直接入力値を使用
    totalSocialInsurance = input.manualSocialInsurance;
  } else {
    totalSocialInsurance =
      annualHealthInsurance + annualNursingInsurance + annualKodomoKosodate +
      annualPension + annualEmployment;
  }

  // ===== 所得税の計算 =====
  // 給与所得（年度別給与所得控除を適用）
  const kyuyoShotokuKojo = calcKyuyoShotokuKojoByYear(annualIncome, tc.kyuyoShotokuKojoMin);
  const kyuyoShotoku = Math.max(0, annualIncome - kyuyoShotokuKojo);

  // 合計所得金額（給与所得のみの場合は給与所得と同額）
  const totalIncome = kyuyoShotoku;

  // 基礎控除（年度別定数を使用）
  const kihonKojo = calcKihonKojoByYear(totalIncome, tc.kihonKojoBase);

  // 社会保険料控除（全額控除）
  const shakaihokenKojo = totalSocialInsurance;

  // 配偶者控除（年収から自動計算された場合はその値を使用、それ以外は満額38万円）
  const haiguushaKojo = input.hasSpouseDeduction
    ? (input.spouseDeductionOverride ?? 380_000)
    : 0;

  // 扶養控除
  // 特定扶養親族（19歳以上22歳以下）: 63万円
  // 一般扶養親族（16歳以上19歳未満）: 38万円
  const fuyoKojo =
    input.childrenUnder19 * 380_000 + input.childrenUnder23 * 630_000;

  // ===== 詳細モード：追加控除の計算 =====
  let idecoDeduction = 0;
  let lifeInsuranceDeduction = 0;
  let medicalExpenseDeduction = 0;

  if (input.idecoMonthly && input.idecoMonthly > 0) {
    idecoDeduction = calcIdecoDeduction(input.idecoMonthly);
  }
  if (input.lifeInsurancePremium && input.lifeInsurancePremium > 0) {
    lifeInsuranceDeduction = calcLifeInsuranceDeduction(input.lifeInsurancePremium);
  }
  if (input.medicalExpenses && input.medicalExpenses > 0) {
    medicalExpenseDeduction = calcMedicalExpenseDeduction(input.medicalExpenses, totalIncome);
  }

  // 障害者控除
  const disabilityDeduction = input.disabilityType && input.disabilityType !== "none"
    ? calcDisabilityDeduction(input.disabilityType)
    : 0;

  // 課税所得（詳細モード：iDeCo・生命保険・医療費控除を追加）
  const taxableIncome = Math.max(
    0,
    kyuyoShotoku - kihonKojo - shakaihokenKojo - haiguushaKojo - fuyoKojo
    - idecoDeduction - lifeInsuranceDeduction - medicalExpenseDeduction
    - disabilityDeduction
  );

  // 所得税額（千円未満切り捨て）
  const { rate, deduction } = getIncomeTaxRate(taxableIncome);
  const incomeTaxBase = Math.floor(taxableIncome / 1000) * 1000;
  const incomeTaxBeforeRestore = Math.floor(incomeTaxBase * rate - deduction);
  // 復興特別所得税（2.1%上乗せ）※令和8年分は継続
  let incomeTax = Math.floor(Math.max(0, incomeTaxBeforeRestore) * 1.021);

  // ===== 住民税の計算 =====
  // 前年所得と同水準として計算
  const kihonKojoJumin = calcKihonKojoJuminByYear(totalIncome, tc.kihonKojoJuminBase);
  const taxableIncomeJumin = Math.max(
    0,
    kyuyoShotoku - kihonKojoJumin - shakaihokenKojo - haiguushaKojo - fuyoKojo
    - idecoDeduction - lifeInsuranceDeduction - medicalExpenseDeduction
    - disabilityDeduction
  );

  // 所得割（標準税率10%）
  const shotokuWari = Math.floor(taxableIncomeJumin * 0.10);

  // 均等割（標準: 5,000円/年）
  const kintouWari = taxableIncomeJumin > 0 ? 5_000 : 0;

  let residentTax = shotokuWari + kintouWari;

  // ===== 詳細モード：住宅ローン控除（税額控除）=====
  let housingLoanDeductionApplied = 0;
  if (input.housingLoanBalance && input.housingLoanBalance > 0) {
    const rawDeduction = calcHousingLoanDeduction(input.housingLoanBalance);
    // まず所得税から控除
    const incomeTaxReduction = Math.min(rawDeduction, incomeTax);
    incomeTax = incomeTax - incomeTaxReduction;
    // 残りは住民税から控除（上限: 所得税の課税総所得金額等の5%、最大97,500円）
    const remaining = rawDeduction - incomeTaxReduction;
    const residentTaxLimit = Math.min(97_500, Math.floor(taxableIncome * 0.05));
    const residentTaxReduction = Math.min(remaining, residentTaxLimit);
    residentTax = Math.max(0, residentTax - residentTaxReduction);
    housingLoanDeductionApplied = incomeTaxReduction + residentTaxReduction;
  }

  // ===== 詳細モード：ふるさと納税税額控除 =====
  let furusatoTaxCredit = 0;
  if (input.furusatoAmount && input.furusatoAmount > 2_000) {
    const furusato = calcFurusatoTaxCredit(input.furusatoAmount, taxableIncome, taxableIncomeJumin);
    // 所得税・住民税から税額控除
    const itReduction = Math.min(furusato.incomeTaxCredit, incomeTax);
    incomeTax = incomeTax - itReduction;
    const rtReduction = Math.min(furusato.residentTaxCredit, residentTax);
    residentTax = Math.max(0, residentTax - rtReduction);
    furusatoTaxCredit = itReduction + rtReduction;
  }

  // ===== 手取り計算 =====
  const totalTax = incomeTax + residentTax;
  const takeHome = annualIncome - totalSocialInsurance - totalTax;
  const takeHomeRatio = Math.round((takeHome / annualIncome) * 1000) / 10;

  // ===== 詳細モード：節税効果の計算 =====
  const hasDetailedInput = (input.idecoMonthly ?? 0) > 0 ||
    (input.furusatoAmount ?? 0) > 0 ||
    (input.housingLoanBalance ?? 0) > 0 ||
    (input.lifeInsurancePremium ?? 0) > 0 ||
    (input.medicalExpenses ?? 0) > 0;

  let taxSavings: number | undefined;
  let totalDeductions: number | undefined;

  if (hasDetailedInput) {
    totalDeductions = idecoDeduction + lifeInsuranceDeduction + medicalExpenseDeduction;
    // 節税効果 = 詳細控除による税金減少分 + 税額控除分
    const deductionTaxSaving = Math.floor(totalDeductions * rate * 1.021);
    taxSavings = deductionTaxSaving + housingLoanDeductionApplied + furusatoTaxCredit;
  }

  return {
    annualIncome,
    standardMonthlyRemuneration: hyojunHoshuKenpo,
    standardBonusRemunerationKenpo: hyojunShoyoKenpo,
    standardBonusRemunerationNenkin: hyojunShoyoNenkin,
    healthInsurance: annualHealthInsurance,
    nursingInsurance: annualNursingInsurance,
    kodomoKosodate: annualKodomoKosodate,
    pensionInsurance: annualPension,
    employmentInsurance: annualEmployment,
    totalSocialInsurance,
    incomeTax,
    residentTax,
    totalTax,
    takeHome,
    takeHomeRatio,
    // 詳細モード情報（詳細入力がある場合のみ）
    ...(hasDetailedInput && {
      idecoDeduction: idecoDeduction > 0 ? idecoDeduction : undefined,
      furusatoTaxCredit: furusatoTaxCredit > 0 ? furusatoTaxCredit : undefined,
      housingLoanDeductionApplied: housingLoanDeductionApplied > 0 ? housingLoanDeductionApplied : undefined,
      lifeInsuranceDeduction: lifeInsuranceDeduction > 0 ? lifeInsuranceDeduction : undefined,
      medicalExpenseDeduction: medicalExpenseDeduction > 0 ? medicalExpenseDeduction : undefined,
      totalDeductions,
      taxSavings,
    }),
  };
}

/**
 * 障害者控除額を計算する
 * general: 障害者 27万円, special: 特別障害者 40万円, cohabiting_special: 同居特別障害者 75万円
 */
export function calcDisabilityDeduction(disabilityType: "none" | "general" | "special" | "cohabiting_special"): number {
  switch (disabilityType) {
    case "general": return 270_000;
    case "special": return 400_000;
    case "cohabiting_special": return 750_000;
    default: return 0;
  }
}

/**
 * 金額を「○○万円」形式にフォーマット
 */
export function formatManYen(yen: number): string {
  const man = Math.round(yen / 10_000);
  return `${man.toLocaleString()}万円`;
}

/**
 * 金額を「◯◯,◯◯◯円」形式にフォーマット
 */
export function formatYen(yen: number): string {
  return `${Math.round(yen).toLocaleString()}円`;
}
