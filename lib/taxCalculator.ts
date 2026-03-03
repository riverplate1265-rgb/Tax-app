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
  // 詳細モード専用（オプショナル）
  idecoMonthly?: number;          // iDeCo月額掛金（円）
  furusatoAmount?: number;        // ふるさと納税寄付金額（年間・円）
  housingLoanBalance?: number;    // 住宅ローン年末残高（円）
  lifeInsurancePremium?: number;  // 生命保険料（年間・円）
  medicalExpenses?: number;       // 医療費（年間・円）
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
 * iDeCo控除額を計算する
 * 拠出額は全額小規模企業共済等掛金控除として所得控除
 * 上限: 会社員（企業型DCなし）= 月2.3万円 = 年27.6万円
 */
function calcIdecoDeduction(idecoMonthly: number): number {
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
function calcLifeInsuranceDeduction(annualPremium: number): number {
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
function calcMedicalExpenseDeduction(medicalExpenses: number, totalIncome: number): number {
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
function calcHousingLoanDeduction(loanBalance: number): number {
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

  // 課税所得（詳細モード：iDeCo・生命保険・医療費控除を追加）
  const taxableIncome = Math.max(
    0,
    kyuyoShotoku - kihonKojo - shakaihokenKojo - haiguushaKojo - fuyoKojo
    - idecoDeduction - lifeInsuranceDeduction - medicalExpenseDeduction
  );

  // 所得税額（千円未満切り捨て）
  const { rate, deduction } = getIncomeTaxRate(taxableIncome);
  const incomeTaxBase = Math.floor(taxableIncome / 1000) * 1000;
  const incomeTaxBeforeRestore = Math.floor(incomeTaxBase * rate - deduction);
  // 復興特別所得税（2.1%上乗せ）※令和8年分は継続
  let incomeTax = Math.floor(Math.max(0, incomeTaxBeforeRestore) * 1.021);

  // ===== 住民税の計算 =====
  // 前年所得と同水準として計算
  // 住民税の基礎控除は令和8年度も43万円のまま変更なし
  const kihonKojoJumin = calcKihonKojoJumin(totalIncome);
  const taxableIncomeJumin = Math.max(
    0,
    kyuyoShotoku - kihonKojoJumin - shakaihokenKojo - haiguushaKojo - fuyoKojo
    - idecoDeduction - lifeInsuranceDeduction - medicalExpenseDeduction
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
