import { describe, it, expect } from "vitest";
import { calculateTax, formatManYen, formatYen } from "../lib/taxCalculator";

describe("calculateTax", () => {
  // 基本テスト: 東京都在住、年収500万円、独身、扶養なし
  it("年収500万円・独身・東京都の計算が正常に動作する", () => {
    const result = calculateTax({
      birthDate: new Date(1985, 0, 1), // 1985年1月1日生まれ（40歳）
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });

    // 年収が正しく変換されている
    expect(result.annualIncome).toBe(5_000_000);

    // 社会保険料が正の値
    expect(result.totalSocialInsurance).toBeGreaterThan(0);

    // 所得税が正の値
    expect(result.incomeTax).toBeGreaterThan(0);

    // 住民税が正の値
    expect(result.residentTax).toBeGreaterThan(0);

    // 手取りが年収より少ない
    expect(result.takeHome).toBeLessThan(result.annualIncome);

    // 手取りが正の値
    expect(result.takeHome).toBeGreaterThan(0);

    // 手取り割合が0〜100の範囲
    expect(result.takeHomeRatio).toBeGreaterThan(0);
    expect(result.takeHomeRatio).toBeLessThan(100);

    // 内訳の合計が年収と一致（端数誤差許容）
    const total = result.totalSocialInsurance + result.totalTax + result.takeHome;
    expect(Math.abs(total - result.annualIncome)).toBeLessThan(100);
  });

  // 賞与の社会保険料が正しく計算されているか
  it("賞与分の社会保険料が月給分に上乗せされている", () => {
    const result = calculateTax({
      birthDate: new Date(1990, 0, 1), // 35歳
      annualIncome: 600,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });

    // 月収 = 600万 / 16 = 37.5万円
    // 標準報酬月額（健康保険）= 380,000円
    // 月給分健康保険料（東京4.925%）= 380,000 × 0.04925 × 12 = 約224,580円
    // 賞与1回あたり = 37.5万 × 2 = 75万円 → 標準賞与額 = 750,000円
    // 賞与分健康保険料 = 750,000 × 0.04925 × 2 = 約73,875円
    // 合計健康保険料 > 月給のみの計算
    const monthlyHealthOnly = Math.floor(380_000 * 0.04925) * 12;
    expect(result.healthInsurance).toBeGreaterThan(monthlyHealthOnly);

    // 標準賞与額が設定されている
    expect(result.standardBonusRemunerationKenpo).toBeGreaterThan(0);
  });

  // 40歳以上は介護保険料が発生する（賞与分も含む）
  it("40歳以上の場合、介護保険料が発生する（賞与分含む）", () => {
    const result40 = calculateTax({
      birthDate: new Date(1985, 0, 1), // 40歳
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    expect(result40.nursingInsurance).toBeGreaterThan(0);
  });

  // 39歳以下は介護保険料が発生しない
  it("39歳以下の場合、介護保険料が発生しない", () => {
    const result39 = calculateTax({
      birthDate: new Date(1990, 0, 1), // 35歳
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    expect(result39.nursingInsurance).toBe(0);
  });

  // 子ども・子育て支援金が計算される（令和8年度新設）
  it("子ども・子育て支援金が計算される（令和8年度）", () => {
    const result = calculateTax({
      birthDate: new Date(1990, 0, 1), // 35歳
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    expect(result.kodomoKosodate).toBeGreaterThan(0);
  });

  // 社会保険料合計の整合性チェック
  it("社会保険料合計 = 健康保険 + 介護保険 + 子育て支援金 + 厚生年金 + 雇用保険", () => {
    const result = calculateTax({
      birthDate: new Date(1985, 0, 1), // 40歳（介護保険あり）
      annualIncome: 600,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    const expected =
      result.healthInsurance +
      result.nursingInsurance +
      result.kodomoKosodate +
      result.pensionInsurance +
      result.employmentInsurance;
    expect(result.totalSocialInsurance).toBe(expected);
  });

  // 配偶者控除ありの場合、税金が少なくなる
  it("配偶者控除ありの場合、税金が少なくなる", () => {
    const withoutSpouse = calculateTax({
      birthDate: new Date(1985, 0, 1),
      annualIncome: 600,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    const withSpouse = calculateTax({
      birthDate: new Date(1985, 0, 1),
      annualIncome: 600,
      hasSpouseDeduction: true,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    expect(withSpouse.totalTax).toBeLessThan(withoutSpouse.totalTax);
    expect(withSpouse.takeHome).toBeGreaterThan(withoutSpouse.takeHome);
  });

  // 子供の扶養控除が機能する
  it("子供の扶養控除が税金を減らす", () => {
    const withoutChild = calculateTax({
      birthDate: new Date(1985, 0, 1),
      annualIncome: 700,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    const withChild = calculateTax({
      birthDate: new Date(1985, 0, 1),
      annualIncome: 700,
      hasSpouseDeduction: false,
      childrenUnder19: 1,
      childrenUnder23: 1,
      prefecture: "東京都",
    });
    expect(withChild.totalTax).toBeLessThan(withoutChild.totalTax);
  });

  // 都道府県によって健康保険料が異なる
  it("都道府県によって健康保険料が異なる（佐賀県が最高、新潟県が最低）", () => {
    const saga = calculateTax({
      birthDate: new Date(1990, 0, 1),
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "佐賀県", // 10.55%（最高）
    });
    const niigata = calculateTax({
      birthDate: new Date(1990, 0, 1),
      annualIncome: 500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "新潟県", // 9.21%（最低）
    });
    // 佐賀県の健康保険料は新潟県より高い
    expect(saga.healthInsurance).toBeGreaterThan(niigata.healthInsurance);
  });

  // 年収が高いほど手取り割合が下がる傾向
  it("年収が高いほど手取り割合が低くなる傾向がある", () => {
    const low = calculateTax({
      birthDate: new Date(1990, 0, 1),
      annualIncome: 300,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    const high = calculateTax({
      birthDate: new Date(1990, 0, 1),
      annualIncome: 1500,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    expect(high.takeHomeRatio).toBeLessThan(low.takeHomeRatio);
  });

  // 厚生年金の標準賞与額上限（150万円）が適用される
  it("厚生年金の標準賞与額は1回あたり150万円が上限", () => {
    // 年収3000万円: 月収 = 3000万/16 = 187.5万円、賞与1回 = 375万円
    // 厚生年金の標準賞与額は150万円が上限
    const result = calculateTax({
      birthDate: new Date(1980, 0, 1),
      annualIncome: 3000,
      hasSpouseDeduction: false,
      childrenUnder19: 0,
      childrenUnder23: 0,
      prefecture: "東京都",
    });
    // 標準賞与額が150万円上限を超えないことを確認
    expect(result.standardBonusRemunerationNenkin).toBeLessThanOrEqual(1_500_000);
  });
});

describe("formatManYen", () => {
  it("正しく万円形式にフォーマットする", () => {
    expect(formatManYen(5_000_000)).toBe("500万円");
    expect(formatManYen(3_500_000)).toBe("350万円");
    expect(formatManYen(10_000)).toBe("1万円");
  });
});

describe("formatYen", () => {
  it("正しく円形式にフォーマットする", () => {
    expect(formatYen(500_000)).toBe("500,000円");
    expect(formatYen(1_234_567)).toBe("1,234,567円");
  });
});
