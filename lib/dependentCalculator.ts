/**
 * lib/dependentCalculator.ts
 * 子供・配偶者の生年月日から扶養区分を自動判定するユーティリティ
 *
 * 扶養区分（年末時点の年齢で判定）:
 * - 年少扶養親族（0〜15歳）: 控除なし（児童手当の対象）
 * - 一般扶養親族（16〜18歳）: 38万円控除
 * - 特定扶養親族（19〜22歳）: 63万円控除
 * - 一般扶養親族（23〜69歳）: 38万円控除
 * - 老人扶養親族（70歳以上）: 48万円控除（同居の場合58万円）
 *
 * 配偶者控除:
 * - 配偶者の年収 103万円以下: 配偶者控除（最大38万円）
 * - 配偶者の年収 103万円超〜201万円以下: 配偶者特別控除（段階的に減額）
 */

export type DependentCategory =
  | "young"        // 年少扶養（0〜15歳）: 控除なし
  | "general"      // 一般扶養（16〜18歳 / 23〜69歳）: 38万円
  | "specific"     // 特定扶養（19〜22歳）: 63万円
  | "elderly"      // 老人扶養（70歳以上）: 48万円
  | "none";        // 対象外

export interface DependentInfo {
  ageAtYearEnd: number;
  category: DependentCategory;
  deductionAmount: number;  // 控除額（円）
  label: string;
}

/**
 * 年末時点の年齢を計算する
 * @param birthYear - 生年
 * @param birthMonth - 生月
 * @param birthDay - 生日
 * @param targetYear - 対象年（デフォルト: 今年）
 */
export function calcAgeAtYearEnd(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  targetYear?: number
): number {
  const year = targetYear ?? new Date().getFullYear();
  const yearEnd = new Date(year, 11, 31); // 12月31日
  const birth = new Date(birthYear, birthMonth - 1, birthDay);
  let age = yearEnd.getFullYear() - birth.getFullYear();
  const monthDiff = yearEnd.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && yearEnd.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * 年齢から扶養区分を判定する
 */
export function getDependentCategory(ageAtYearEnd: number): DependentCategory {
  if (ageAtYearEnd < 0) return "none";
  if (ageAtYearEnd <= 15) return "young";
  if (ageAtYearEnd <= 18) return "general";
  if (ageAtYearEnd <= 22) return "specific";
  if (ageAtYearEnd <= 69) return "general";
  return "elderly";
}

/**
 * 扶養区分から控除額を返す（円）
 */
export function getDependentDeduction(category: DependentCategory): number {
  switch (category) {
    case "young":    return 0;
    case "general":  return 380_000;
    case "specific": return 630_000;
    case "elderly":  return 480_000;
    default:         return 0;
  }
}

/**
 * 扶養区分のラベルを返す
 */
export function getDependentLabel(category: DependentCategory, age: number): string {
  switch (category) {
    case "young":    return `年少扶養（${age}歳）`;
    case "general":  return `一般扶養（${age}歳）`;
    case "specific": return `特定扶養（${age}歳）`;
    case "elderly":  return `老人扶養（${age}歳）`;
    default:         return `扶養対象外（${age}歳）`;
  }
}

/**
 * 子供の生年月日リストから扶養情報を一括計算する
 */
export function calcChildrenDependents(
  children: Array<{ birthYear: string; birthMonth: string; birthDay: string }>,
  targetYear?: number
): DependentInfo[] {
  return children
    .filter((c) => c.birthYear && c.birthMonth && c.birthDay)
    .map((c) => {
      const by = parseInt(c.birthYear, 10);
      const bm = parseInt(c.birthMonth, 10);
      const bd = parseInt(c.birthDay, 10);
      if (isNaN(by) || isNaN(bm) || isNaN(bd)) {
        return null;
      }
      const age = calcAgeAtYearEnd(by, bm, bd, targetYear);
      const category = getDependentCategory(age);
      const deductionAmount = getDependentDeduction(category);
      return {
        ageAtYearEnd: age,
        category,
        deductionAmount,
        label: getDependentLabel(category, age),
      };
    })
    .filter(Boolean) as DependentInfo[];
}

/**
 * 扶養情報のサマリーを計算する（計算タブへの反映用）
 * @returns {
 *   dependentsCount: 一般扶養の人数（16歳以上）
 *   specificDependentsCount: 特定扶養の人数（19〜22歳）
 *   totalDependentDeduction: 扶養控除の合計額（円）
 * }
 */
export function calcDependentSummary(
  children: Array<{ birthYear: string; birthMonth: string; birthDay: string }>,
  targetYear?: number
): {
  dependentsCount: number;
  specificDependentsCount: number;
  totalDependentDeduction: number;
  details: DependentInfo[];
} {
  const details = calcChildrenDependents(children, targetYear);
  const dependentsCount = details.filter(
    (d) => d.category === "general" || d.category === "elderly"
  ).length;
  const specificDependentsCount = details.filter(
    (d) => d.category === "specific"
  ).length;
  const totalDependentDeduction = details.reduce(
    (sum, d) => sum + d.deductionAmount,
    0
  );
  return {
    dependentsCount,
    specificDependentsCount,
    totalDependentDeduction,
    details,
  };
}

/**
 * 配偶者控除額を計算する
 * @param taxpayerIncome - 納税者の合計所得金額（万円）
 * @param spouseIncome - 配偶者の年収（万円）
 * @returns 配偶者控除額（円）
 */
export function calcSpouseDeduction(
  taxpayerIncome: number,
  spouseIncome: number
): number {
  // 配偶者の年収が103万円以下 → 配偶者控除
  if (spouseIncome <= 103) {
    // 納税者の合計所得金額によって控除額が変わる
    if (taxpayerIncome <= 900) return 380_000;
    if (taxpayerIncome <= 950) return 260_000;
    if (taxpayerIncome <= 1000) return 130_000;
    return 0;
  }

  // 配偶者の年収が103万円超〜201万円以下 → 配偶者特別控除
  if (spouseIncome <= 201) {
    // 配偶者の所得（年収 - 給与所得控除）
    const spouseGrossIncome = spouseIncome * 10_000; // 円に変換
    let spouseEarnedIncome = 0;
    if (spouseGrossIncome <= 1_625_000) {
      spouseEarnedIncome = 550_000;
    } else if (spouseGrossIncome <= 1_800_000) {
      spouseEarnedIncome = spouseGrossIncome * 0.4 - 100_000;
    } else if (spouseGrossIncome <= 3_600_000) {
      spouseEarnedIncome = spouseGrossIncome * 0.3 + 80_000;
    } else if (spouseGrossIncome <= 6_600_000) {
      spouseEarnedIncome = spouseGrossIncome * 0.2 + 440_000;
    } else {
      spouseEarnedIncome = spouseGrossIncome * 0.1 + 1_100_000;
    }
    const spouseNetIncome = spouseGrossIncome - spouseEarnedIncome;

    // 配偶者特別控除額（納税者の合計所得 900万円以下の場合）
    if (taxpayerIncome > 1000) return 0;

    if (spouseNetIncome <= 500_000) return 380_000;
    if (spouseNetIncome <= 600_000) return 360_000;
    if (spouseNetIncome <= 700_000) return 310_000;
    if (spouseNetIncome <= 800_000) return 260_000;
    if (spouseNetIncome <= 900_000) return 210_000;
    if (spouseNetIncome <= 1_000_000) return 160_000;
    if (spouseNetIncome <= 1_100_000) return 110_000;
    if (spouseNetIncome <= 1_200_000) return 60_000;
    if (spouseNetIncome <= 1_330_000) return 30_000;
    return 0;
  }

  return 0;
}
