import {
  HYOJUN_HOSHU_TABLE,
  NENKIN_HYOJUN_TABLE,
  KENPO_HEALTH_RATES,
  KAIGO_RATE,
  KOUSEI_NENKIN_RATE,
  KOYO_HOKEN_RATE,
} from "./constants";

export interface TaxInput {
  birthDate: Date;
  annualIncome: number; // 万円単位
  hasSpouseDeduction: boolean;
  childrenUnder19: number; // 16歳以上19歳未満
  childrenUnder23: number; // 19歳以上22歳以下
  prefecture: string;
}

export interface TaxResult {
  annualIncome: number;         // 年収（円）
  standardMonthlyRemuneration: number; // 標準報酬月額（円）
  healthInsurance: number;      // 健康保険料（年間・円）
  nursingInsurance: number;     // 介護保険料（年間・円）
  pensionInsurance: number;     // 厚生年金保険料（年間・円）
  employmentInsurance: number;  // 雇用保険料（年間・円）
  totalSocialInsurance: number; // 社会保険料合計（年間・円）
  incomeTax: number;            // 所得税（年間・円）
  residentTax: number;          // 住民税（年間・円）
  totalTax: number;             // 税金合計（年間・円）
  takeHome: number;             // 手取り（年間・円）
  takeHomeRatio: number;        // 手取り割合（%）
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
 * 給与所得控除額を計算する
 * 2020年度以降の制度
 */
function calcKyuyoShotokuKojo(annualIncome: number): number {
  if (annualIncome <= 1_625_000) return 550_000;
  if (annualIncome <= 1_800_000) return Math.floor(annualIncome * 0.4) - 100_000;
  if (annualIncome <= 3_600_000) return Math.floor(annualIncome * 0.3) + 80_000;
  if (annualIncome <= 6_600_000) return Math.floor(annualIncome * 0.2) + 440_000;
  if (annualIncome <= 8_500_000) return Math.floor(annualIncome * 0.1) + 1_100_000;
  return 1_950_000;
}

/**
 * 所得税の税率と控除額を返す
 * 課税所得に対する超過累進税率
 */
function getIncomeTaxRate(taxableIncome: number): { rate: number; deduction: number } {
  if (taxableIncome <= 1_950_000)   return { rate: 0.05, deduction: 0 };
  if (taxableIncome <= 3_300_000)   return { rate: 0.10, deduction: 97_500 };
  if (taxableIncome <= 6_950_000)   return { rate: 0.20, deduction: 427_500 };
  if (taxableIncome <= 9_000_000)   return { rate: 0.23, deduction: 636_000 };
  if (taxableIncome <= 18_000_000)  return { rate: 0.33, deduction: 1_536_000 };
  if (taxableIncome <= 40_000_000)  return { rate: 0.40, deduction: 2_796_000 };
  return { rate: 0.45, deduction: 4_796_000 };
}

/**
 * 税金・社会保険料の計算メイン関数
 */
export function calculateTax(input: TaxInput): TaxResult {
  const currentYear = new Date().getFullYear();
  const age = calcAge(input.birthDate, currentYear);
  const annualIncome = input.annualIncome * 10_000; // 万円→円

  // ===== 月収・賞与の分割 =====
  // 賞与は月収×4ヶ月分。年収 = 月収×12 + 月収×4 = 月収×16
  const monthlyIncome = Math.round(annualIncome / 16);
  const bonusIncome = monthlyIncome * 4; // 賞与合計（年間）

  // ===== 標準報酬月額 =====
  const hyojunHoshuKenpo = getHyojunHoshu(monthlyIncome);
  const hyojunHoshuNenkin = getNenkinHyojunHoshu(monthlyIncome);

  // ===== 健康保険料 =====
  const healthRate = KENPO_HEALTH_RATES[input.prefecture] ?? 4.99;
  const monthlyHealthInsurance = Math.floor(hyojunHoshuKenpo * (healthRate / 100));
  const annualHealthInsurance = monthlyHealthInsurance * 12;

  // ===== 介護保険料（40歳以上65歳未満のみ）=====
  let annualNursingInsurance = 0;
  if (age >= 40 && age < 65) {
    const monthlyNursing = Math.floor(hyojunHoshuKenpo * (KAIGO_RATE / 100));
    annualNursingInsurance = monthlyNursing * 12;
  }

  // ===== 厚生年金保険料 =====
  const monthlyPension = Math.floor(hyojunHoshuNenkin * (KOUSEI_NENKIN_RATE / 100));
  const annualPension = monthlyPension * 12;

  // ===== 雇用保険料 =====
  const annualEmployment = Math.floor(annualIncome * (KOYO_HOKEN_RATE / 100));

  // ===== 社会保険料合計 =====
  const totalSocialInsurance =
    annualHealthInsurance + annualNursingInsurance + annualPension + annualEmployment;

  // ===== 所得税の計算 =====
  // 給与所得
  const kyuyoShotoku = annualIncome - calcKyuyoShotokuKojo(annualIncome);

  // 所得控除の計算
  const kihonKojo = 480_000; // 基礎控除（2020年以降）

  // 社会保険料控除（全額控除）
  const shakaihokenKojo = totalSocialInsurance;

  // 配偶者控除（満額：38万円）
  const haiguushaKojo = input.hasSpouseDeduction ? 380_000 : 0;

  // 扶養控除
  // 特定扶養親族（19歳以上22歳以下）: 63万円
  // 一般扶養親族（16歳以上19歳未満）: 38万円
  const fuyoKojo =
    input.childrenUnder19 * 380_000 + input.childrenUnder23 * 630_000;

  // 課税所得
  const taxableIncome = Math.max(
    0,
    kyuyoShotoku - kihonKojo - shakaihokenKojo - haiguushaKojo - fuyoKojo
  );

  // 所得税額（千円未満切り捨て）
  const { rate, deduction } = getIncomeTaxRate(taxableIncome);
  const incomeTaxBase = Math.floor(taxableIncome / 1000) * 1000;
  const incomeTaxBeforeRestore = Math.floor(incomeTaxBase * rate - deduction);
  // 復興特別所得税（2.1%上乗せ）
  const incomeTax = Math.floor(Math.max(0, incomeTaxBeforeRestore) * 1.021);

  // ===== 住民税の計算 =====
  // 前年所得と同水準として計算
  // 課税所得（住民税用）
  const kihonKojoJumin = 430_000; // 住民税の基礎控除
  const taxableIncomeJumin = Math.max(
    0,
    kyuyoShotoku - kihonKojoJumin - shakaihokenKojo - haiguushaKojo - fuyoKojo
  );

  // 所得割（標準税率10%）
  const shotokuWari = Math.floor(taxableIncomeJumin * 0.10);

  // 均等割（標準: 5,000円/年）
  const kintouWari = taxableIncomeJumin > 0 ? 5_000 : 0;

  const residentTax = shotokuWari + kintouWari;

  // ===== 手取り計算 =====
  const totalTax = incomeTax + residentTax;
  const takeHome = annualIncome - totalSocialInsurance - totalTax;
  const takeHomeRatio = Math.round((takeHome / annualIncome) * 1000) / 10;

  return {
    annualIncome,
    standardMonthlyRemuneration: hyojunHoshuKenpo,
    healthInsurance: annualHealthInsurance,
    nursingInsurance: annualNursingInsurance,
    pensionInsurance: annualPension,
    employmentInsurance: annualEmployment,
    totalSocialInsurance,
    incomeTax,
    residentTax,
    totalTax,
    takeHome,
    takeHomeRatio,
  };
}

/**
 * 金額を「◯◯万円」形式にフォーマット
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
