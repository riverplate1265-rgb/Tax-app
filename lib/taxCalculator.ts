import {
  HYOJUN_HOSHU_TABLE,
  NENKIN_HYOJUN_TABLE,
  KENPO_HEALTH_RATES,
  KAIGO_RATE,
  KODOMO_KOSODATE_RATE,
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
 * 給与所得控除額を計算する
 * 令和8年度（2026年分）改正後：最低保障額74万円
 * 出典: 令和8年度税制改正大綱（令和7年12月26日閣議決定）
 */
function calcKyuyoShotokuKojo(annualIncome: number): number {
  // 令和8・9年分：最低保障額74万円（本則69万円 + 特例5万円）
  if (annualIncome <= 1_625_000) return 740_000;
  if (annualIncome <= 1_800_000) return Math.floor(annualIncome * 0.4) - 100_000;
  if (annualIncome <= 3_600_000) return Math.floor(annualIncome * 0.3) + 80_000;
  if (annualIncome <= 6_600_000) return Math.floor(annualIncome * 0.2) + 440_000;
  if (annualIncome <= 8_500_000) return Math.floor(annualIncome * 0.1) + 1_100_000;
  return 1_950_000;
}

/**
 * 令和8年度（2026年分）基礎控除額を計算する
 * 合計所得金額に応じて段階的に変化
 * 出典: 令和8年度税制改正大綱
 *
 * 令和8・9年分の特例：
 * - 合計所得489万円以下：本則62万円 + 特例加算42万円 = 104万円
 * - 合計所得489万円超～689万円以下：段階的に縮小
 * - 合計所得689万円超～889万円以下：さらに縮小
 * - 合計所得889万円超～2,350万円以下：62万円（本則のみ）
 * - 合計所得2,350万円超：0円
 */
function calcKihonKojo(totalIncome: number): number {
  if (totalIncome <= 4_890_000) return 1_040_000;
  if (totalIncome <= 5_390_000) {
    // 489万円超～539万円以下：104万円から段階的に縮小（20万円ずつ）
    // 489万円超：84万円、509万円超：64万円
    if (totalIncome <= 5_090_000) return 840_000;
    return 640_000;
  }
  if (totalIncome <= 6_890_000) {
    // 539万円超～689万円以下：段階的に縮小
    if (totalIncome <= 5_890_000) return 420_000;
    return 200_000; // 589万円超～689万円以下
  }
  if (totalIncome <= 8_890_000) {
    // 689万円超～889万円以下：段階的に縮小
    if (totalIncome <= 7_390_000) return 160_000;
    if (totalIncome <= 7_890_000) return 120_000;
    if (totalIncome <= 8_390_000) return 80_000;
    return 40_000;
  }
  if (totalIncome <= 23_500_000) return 620_000; // 本則のみ
  return 0;
}

/**
 * 住民税の基礎控除額を計算する
 * 令和8年度：住民税の基礎控除は43万円のまま変更なし
 */
function calcKihonKojoJumin(totalIncome: number): number {
  if (totalIncome <= 24_000_000) return 430_000;
  if (totalIncome <= 24_500_000) return 290_000;
  if (totalIncome <= 25_000_000) return 150_000;
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
 * 税金・社会保険料の計算メイン関数
 * 適用法令: 令和8年度（2026年3月1日現在）
 */
export function calculateTax(input: TaxInput): TaxResult {
  const currentYear = new Date().getFullYear();
  const age = calcAge(input.birthDate, currentYear);
  const annualIncome = input.annualIncome * 10_000; // 万円→円

  // ===== 月収・賞与の分割 =====
  // 賞与は月収×4ヶ月分。年収 = 月収×12 + 月収×4 = 月収×16
  const monthlyIncome = Math.round(annualIncome / 16);
  // 賞与は年2回（夏・冬）を想定し、1回あたり月収×2ヶ月分
  const bonusPerPayment = monthlyIncome * 2;
  const bonusPayments = 2;

  // ===== 標準報酬月額（月給分）=====
  const hyojunHoshuKenpo = getHyojunHoshu(monthlyIncome);
  const hyojunHoshuNenkin = getNenkinHyojunHoshu(monthlyIncome);

  // ===== 標準賞与額（賞与分）=====
  const hyojunShoyoKenpo = getHyojunShoyo(bonusPerPayment, "kenpo");
  const hyojunShoyoNenkin = getHyojunShoyo(bonusPerPayment, "nenkin");

  // ===== 健康保険料 =====
  const healthRate = KENPO_HEALTH_RATES[input.prefecture] ?? 4.925; // デフォルト東京
  const monthlyHealthInsurance = Math.floor(hyojunHoshuKenpo * (healthRate / 100));
  const annualHealthFromSalary = monthlyHealthInsurance * 12;
  const bonusHealthInsurance = Math.floor(hyojunShoyoKenpo * (healthRate / 100)) * bonusPayments;
  const annualHealthInsurance = annualHealthFromSalary + bonusHealthInsurance;

  // ===== 介護保険料（40歳以上65歳未満のみ）=====
  // 令和8年3月分から：1.62%（被保険者負担0.81%）
  let annualNursingInsurance = 0;
  if (age >= 40 && age < 65) {
    const monthlyNursing = Math.floor(hyojunHoshuKenpo * (KAIGO_RATE / 100));
    const annualNursingFromSalary = monthlyNursing * 12;
    const bonusNursing = Math.floor(hyojunShoyoKenpo * (KAIGO_RATE / 100)) * bonusPayments;
    annualNursingInsurance = annualNursingFromSalary + bonusNursing;
  }

  // ===== 子ども・子育て支援金 =====
  // 令和8年4月分（5月納付分）から徴収開始：0.23%（被保険者負担0.115%）
  // 標準報酬月額・標準賞与額に対して計算
  const monthlyKodomo = Math.floor(hyojunHoshuKenpo * (KODOMO_KOSODATE_RATE / 100));
  // 4月分から9ヶ月分（4〜12月）を年間として計算
  // 簡易診断では年間全額として計算（前提条件に記載）
  const annualKodomoFromSalary = monthlyKodomo * 12;
  const bonusKodomo = Math.floor(hyojunShoyoKenpo * (KODOMO_KOSODATE_RATE / 100)) * bonusPayments;
  const annualKodomoKosodate = annualKodomoFromSalary + bonusKodomo;

  // ===== 厚生年金保険料 =====
  const monthlyPension = Math.floor(hyojunHoshuNenkin * (KOUSEI_NENKIN_RATE / 100));
  const annualPensionFromSalary = monthlyPension * 12;
  const bonusPension = Math.floor(hyojunShoyoNenkin * (KOUSEI_NENKIN_RATE / 100)) * bonusPayments;
  const annualPension = annualPensionFromSalary + bonusPension;

  // ===== 雇用保険料 =====
  const annualEmployment = Math.floor(annualIncome * (KOYO_HOKEN_RATE / 100));

  // ===== 社会保険料合計 =====
  const totalSocialInsurance =
    annualHealthInsurance + annualNursingInsurance + annualKodomoKosodate +
    annualPension + annualEmployment;

  // ===== 所得税の計算（令和8年分）=====
  // 給与所得（令和8年度改正後の給与所得控除を適用）
  const kyuyoShotokuKojo = calcKyuyoShotokuKojo(annualIncome);
  const kyuyoShotoku = Math.max(0, annualIncome - kyuyoShotokuKojo);

  // 合計所得金額（給与所得のみの場合は給与所得と同額）
  const totalIncome = kyuyoShotoku;

  // 基礎控除（令和8年度改正後）
  const kihonKojo = calcKihonKojo(totalIncome);

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
  // 復興特別所得税（2.1%上乗せ）※令和8年分は継続
  const incomeTax = Math.floor(Math.max(0, incomeTaxBeforeRestore) * 1.021);

  // ===== 住民税の計算 =====
  // 前年所得と同水準として計算
  // 住民税の基礎控除は令和8年度も43万円のまま変更なし
  const kihonKojoJumin = calcKihonKojoJumin(totalIncome);
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
