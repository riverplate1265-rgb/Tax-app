import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
  Pressable,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { PREFECTURES } from "@/lib/constants";
import { calculateTax, calcLifeInsuranceDeduction, calcMedicalExpenseDeduction, calcHousingLoanDeduction, calcIdecoDeduction, calcKyuyoShotokuKojo, calcDisabilityDeduction, type TaxInput } from "@/lib/taxCalculator";
import { useColors } from "@/hooks/use-colors";
import { useAnnualSettings } from "@/hooks/use-annual-settings";
import { useAuthLink } from "@/hooks/use-auth-link";
import { saveCalculationResult } from "@/store/calculationStore";
import {
  loadProfile,
  loadAllAnnualData,
  getSavedYears,
  subscribeToProfileStore,
  type AnnualData,
  type DisabilityType,
} from "@/store/profileStore";
import { calcDependentSummary, calcSpouseDeduction } from "@/lib/dependentCalculator";

// モード定義
type CalcMode = "simple" | "detailed";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();

  // 認証・データ永続化
  const { supabaseUser, signInAnonymously } = useAuthLink();
  const { settings, save, saveCalculationCache, saving } = useAnnualSettings({
    userId: supabaseUser?.id ?? null,
    year: new Date().getFullYear(),
  });

  // アプリ起動時に匿名認証を試みる
  useEffect(() => {
    signInAnonymously();
  }, []);

  // モード状態
  const [mode, setMode] = useState<CalcMode>("simple");

  // 入力状態（簡易モード）
  const [birthYear, setBirthYear] = useState("1990");
  const [birthMonth, setBirthMonth] = useState("1");
  const [birthDay, setBirthDay] = useState("1");
  const [annualIncome, setAnnualIncome] = useState("500");
  const [hasSpouseDeduction, setHasSpouseDeduction] = useState(false);
  const [childrenUnder19, setChildrenUnder19] = useState(0);
  const [childrenUnder23, setChildrenUnder23] = useState(0);
  const [prefecture, setPrefecture] = useState("東京都");
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 詳細モード専用の入力状態
  const [idecoMonthly, setIdecoMonthly] = useState("");
  const [furusatoAmount, setFurusatoAmount] = useState("");
  const [housingLoanBalance, setHousingLoanBalance] = useState("");
  const [lifeInsurancePremium, setLifeInsurancePremium] = useState("");
  const [medicalExpenses, setMedicalExpenses] = useState("");

  // 障害者情報（設定タブから取得）
  const [disabilityType, setDisabilityType] = useState<DisabilityType>("none");

  // 年次データ連携
  const [savedYears, setSavedYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showYearModal, setShowYearModal] = useState(false);
  const [dependentInfo, setDependentInfo] = useState<string>("");
  // 配偶者控除額（設定タブの配偶者年収から自動計算）
  const [spouseDeductionAmount, setSpouseDeductionAmount] = useState<number>(0);
  const [spouseDeductionLabel, setSpouseDeductionLabel] = useState<string>("");

  // 設定タブのデータを読み込んで詳細モードに反映
  useEffect(() => {
    if (settings) {
      if (settings.ideco_contribution) {
        setIdecoMonthly(String(settings.ideco_contribution));
      }
      if (settings.furusato_nouzei_donation) {
        setFurusatoAmount(String(settings.furusato_nouzei_donation));
      }
      if (settings.housing_loan_deduction) {
        setHousingLoanBalance(String(settings.housing_loan_deduction));
      }
      if (settings.life_insurance_deduction) {
        setLifeInsurancePremium(String(settings.life_insurance_deduction));
      }
    }
  }, [settings]);

  // profileStore からプロフィールを読み込んで基本情報に反映する関数
  const applyProfileToForm = useCallback(async () => {
    const profile = await loadProfile();
    if (!profile) return;

    if (profile.birthYear) setBirthYear(profile.birthYear);
    if (profile.birthMonth) setBirthMonth(profile.birthMonth);
    if (profile.birthDay) setBirthDay(profile.birthDay);
    if (profile.workPrefecture) setPrefecture(profile.workPrefecture);
    if (profile.hasSpouse !== undefined) setHasSpouseDeduction(profile.hasSpouse);
    if (profile.disabilityType) setDisabilityType(profile.disabilityType as DisabilityType);
    else setDisabilityType("none");

    // 子供の生年月日から扶養区分を自動判定
    if (profile.children && profile.children.length > 0) {
      const summary = calcDependentSummary(profile.children, selectedYear);
      setChildrenUnder19(summary.dependentsCount);
      setChildrenUnder23(summary.specificDependentsCount);

      // 扶養情報の説明テキストを生成
      if (summary.details.length > 0) {
        const infoText = summary.details
          .map((d, i) => `第${i + 1}子：${d.label}`)
          .join("、");
        setDependentInfo(infoText);
      }
    } else {
      setChildrenUnder19(0);
      setChildrenUnder23(0);
      setDependentInfo("");
    }

    // 配偶者控除額を自動計算（設定タブの配偶者年収と本人年収から）
    if (profile.hasSpouse) {
      const allData = await loadAllAnnualData();
      const yearData = allData[selectedYear];
      const spouseIncome = yearData?.spouseIncome ? parseFloat(yearData.spouseIncome) : 0;
      const myIncome = yearData?.annualIncome ? parseFloat(yearData.annualIncome) : parseFloat(annualIncome) || 0;
      if (spouseIncome > 0) {
        const deduction = calcSpouseDeduction(myIncome, spouseIncome);
        setSpouseDeductionAmount(deduction);
        if (deduction > 0) {
          if (spouseIncome <= 103) {
            setSpouseDeductionLabel(`配偶者控除 ${(deduction / 10000).toFixed(0)}万円（配偶者年収${spouseIncome}万円）`);
          } else {
            setSpouseDeductionLabel(`配偶者特別控除 ${(deduction / 10000).toFixed(0)}万円（配偶者年収${spouseIncome}万円）`);
          }
        } else {
          setSpouseDeductionLabel(`配偶者控除なし（配偶者年収${spouseIncome}万円）`);
        }
      } else {
        // 配偶者年収未入力の場合は満額38万円で計算
        setSpouseDeductionAmount(380_000);
        setSpouseDeductionLabel("配偶者控除 38万円（年収未入力のため満額適用）");
      }
    } else {
      setSpouseDeductionAmount(0);
      setSpouseDeductionLabel("");
    }

    // 保存済み年次データを読み込む
    const years = await getSavedYears();
    setSavedYears(years);

    // 選択中の年次データを反映
    const allData = await loadAllAnnualData();
    const yearData = allData[selectedYear];
    if (yearData) {
      applyAnnualDataToForm(yearData);
    }
  }, [selectedYear]);

  // 年次データをフォームに反映する
  const applyAnnualDataToForm = (data: AnnualData) => {
    if (data.annualIncome) setAnnualIncome(data.annualIncome);
    if (data.workPrefecture) setPrefecture(data.workPrefecture);
    if (data.idecoMonthly) setIdecoMonthly(data.idecoMonthly);
    if (data.furusatoAmount) setFurusatoAmount(data.furusatoAmount);
    if (data.housingLoanBalance) setHousingLoanBalance(data.housingLoanBalance);
    if (data.lifeInsurance) setLifeInsurancePremium(data.lifeInsurance);
    // 医療費は年次データから自動計算して反映
    if (data.medicalExpenses) {
      setMedicalExpenses(data.medicalExpenses);
    }
  };

  // 起動時にprofileStoreから読み込む
  useEffect(() => {
    applyProfileToForm();
    // 設定タブで保存されたとき（subscribeToProfileStore）に自動反映
    const unsubscribe = subscribeToProfileStore(() => {
      applyProfileToForm();
    });
    return unsubscribe;
  }, [applyProfileToForm]);

  // 年次データ選択時に自動反映
  const handleYearSelect = async (year: number) => {
    setSelectedYear(year);
    setShowYearModal(false);
    const allData = await loadAllAnnualData();
    const yearData = allData[year];
    if (yearData) {
      applyAnnualDataToForm(yearData);
      // 子供の扶養区分も再計算
      const profile = await loadProfile();
      if (profile?.children && profile.children.length > 0) {
        const summary = calcDependentSummary(profile.children, year);
        setChildrenUnder19(summary.dependentsCount);
        setChildrenUnder23(summary.specificDependentsCount);
        if (summary.details.length > 0) {
          const infoText = summary.details
            .map((d, i) => `第${i + 1}子：${d.label}`)
            .join("、");
          setDependentInfo(infoText);
        }
      }

      // 配偶者控除額を再計算
      if (profile?.hasSpouse) {
        const allData2 = await loadAllAnnualData();
        const yearData2 = allData2[year];
        const spouseIncome2 = yearData2?.spouseIncome ? parseFloat(yearData2.spouseIncome) : 0;
        const myIncome2 = yearData2?.annualIncome ? parseFloat(yearData2.annualIncome) : parseFloat(annualIncome) || 0;
        if (spouseIncome2 > 0) {
          const deduction2 = calcSpouseDeduction(myIncome2, spouseIncome2);
          setSpouseDeductionAmount(deduction2);
          if (deduction2 > 0) {
            if (spouseIncome2 <= 103) {
              setSpouseDeductionLabel(`配偶者控除 ${(deduction2 / 10000).toFixed(0)}万円（配偶者年収${spouseIncome2}万円）`);
            } else {
              setSpouseDeductionLabel(`配偶者特別控除 ${(deduction2 / 10000).toFixed(0)}万円（配偶者年収${spouseIncome2}万円）`);
            }
          } else {
            setSpouseDeductionLabel(`配偶者控除なし（配偶者年収${spouseIncome2}万円）`);
          }
        } else {
          setSpouseDeductionAmount(380_000);
          setSpouseDeductionLabel("配偶者控除 38万円（年収未入力のため満額適用）");
        }
      } else {
        setSpouseDeductionAmount(0);
        setSpouseDeductionLabel("");
      }
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleModeToggle = (isDetailed: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(isDetailed ? "detailed" : "simple");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 詳細モードでは生年月日は設定タブから自動取得するためバリデーションをスキップ
    if (mode === "simple") {
      const year = parseInt(birthYear, 10);
      const month = parseInt(birthMonth, 10);
      const day = parseInt(birthDay, 10);

      if (!birthYear || !birthMonth || !birthDay) {
        newErrors.birthDate = "生年月日を入力してください";
      } else if (
        isNaN(year) || isNaN(month) || isNaN(day) ||
        year < 1920 || year > new Date().getFullYear() - 15 ||
        month < 1 || month > 12 ||
        day < 1 || day > 31
      ) {
        newErrors.birthDate = "正しい生年月日を入力してください";
      }
    }

    const income = parseFloat(annualIncome);
    if (!annualIncome || isNaN(income) || income <= 0 || income > 100000) {
      newErrors.annualIncome = "年収を正しく入力してください（万円）";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = async () => {
    if (!validate()) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // 詳細モードでは生年月日が未入力の場合、デフォルト値（1980年1月1日）を使用
    const byear = parseInt(birthYear, 10) || 1980;
    const bmonth = parseInt(birthMonth, 10) || 1;
    const bday = parseInt(birthDay, 10) || 1;
    const birthDate = new Date(byear, bmonth - 1, bday);

    const input: TaxInput = {
      birthDate,
      annualIncome: parseFloat(annualIncome),
      // 簡易モード：トグル値を使用、詳細モード：設定タブから自動計算した値を使用
      hasSpouseDeduction: mode === "simple" ? hasSpouseDeduction : spouseDeductionAmount > 0,
      spouseDeductionOverride: mode === "detailed" && spouseDeductionAmount > 0 ? spouseDeductionAmount : undefined,
      childrenUnder19,
      childrenUnder23,
      prefecture,
      disabilityType: disabilityType !== "none" ? disabilityType : undefined,
      // 詳細モードの場合のみ追加フィールドを渡す
      ...(mode === "detailed" && {
        idecoMonthly: idecoMonthly ? parseInt(idecoMonthly, 10) : undefined,
        furusatoAmount: furusatoAmount ? parseInt(furusatoAmount, 10) : undefined,
        housingLoanBalance: housingLoanBalance ? parseInt(housingLoanBalance, 10) : undefined,
        lifeInsurancePremium: lifeInsurancePremium ? parseInt(lifeInsurancePremium, 10) : undefined,
        medicalExpenses: medicalExpenses ? parseInt(medicalExpenses, 10) : undefined,
      }),
    };

    const result = calculateTax(input);

    // 計算結果をキャッシュ保存（バックグラウンド）
    saveCalculationCache({
      cached_take_home: result.takeHome,
      cached_total_tax: result.totalTax,
      cached_social_insurance: result.totalSocialInsurance,
    }).catch((e) => console.warn("[HomeScreen] cache save failed:", e));

    // 入力設定を保存（バックグラウンド）
    // birth_date は annual_settings テーブルに存在しないため送信しない
    save({
      annual_income: parseFloat(annualIncome),
      work_prefecture: prefecture,
    } as any).catch((e) => console.warn("[HomeScreen] settings save failed:", e));

    // 計算結果をグローバルストアに保存（分析タブで参照するため）
    const age = new Date().getFullYear() - parseInt(birthYear, 10);
    saveCalculationResult(result, {
      annualIncome: parseFloat(annualIncome),
      age,
      prefecture,
      hasSpouseDeduction: mode === "simple" ? hasSpouseDeduction : spouseDeductionAmount > 0,
      childrenUnder19,
      childrenUnder23,
      mode,
      idecoMonthly: idecoMonthly ? parseInt(idecoMonthly, 10) : undefined,
      furusatoAmount: furusatoAmount ? parseInt(furusatoAmount, 10) : undefined,
      housingLoanBalance: housingLoanBalance ? parseInt(housingLoanBalance, 10) : undefined,
      lifeInsurancePremium: lifeInsurancePremium ? parseInt(lifeInsurancePremium, 10) : undefined,
      medicalExpenses: medicalExpenses ? parseInt(medicalExpenses, 10) : undefined,
      calculatedAt: new Date().toISOString(),
    }).catch((e) => console.warn("[HomeScreen] store save failed:", e));

    router.push({
      pathname: "/result",
      params: {
        result: JSON.stringify(result),
        annualIncomeInput: annualIncome,
        mode,
      },
    });
  };

  const adjustChildren = (
    type: "under19" | "under23",
    delta: number
  ) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (type === "under19") {
      setChildrenUnder19((v) => Math.max(0, Math.min(10, v + delta)));
    } else {
      setChildrenUnder23((v) => Math.max(0, Math.min(10, v + delta)));
    }
  };

  const styles = createStyles(colors);

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>手取り計算</Text>
            <Text style={styles.headerSubtitle}>令和8年度（2026年）最新法令対応</Text>
          </View>

          {/* 簡易 / 詳細 モード切替トグル */}
          <View style={styles.modeToggleContainer}>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                mode === "simple" && styles.modeToggleBtnActive,
              ]}
              onPress={() => handleModeToggle(false)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeToggleBtnText,
                  mode === "simple" && styles.modeToggleBtnTextActive,
                ]}
              >
                簡易
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                mode === "detailed" && styles.modeToggleBtnActive,
              ]}
              onPress={() => handleModeToggle(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.modeToggleBtnText,
                  mode === "detailed" && styles.modeToggleBtnTextActive,
                ]}
              >
                詳細
              </Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PRO</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 詳細モードの説明バナー */}
          {mode === "detailed" && (
            <View style={styles.detailBanner}>
              <Text style={styles.detailBannerIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailBannerTitle}>詳細モード：控除を反映</Text>
                <Text style={styles.detailBannerText}>
                  iDeCo・ふるさと納税・住宅ローン控除を加味した精密計算を行います。
                </Text>
              </View>
            </View>
          )}

          {/* フォームカード（共通：基本情報） */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>基本情報</Text>

            {/* 生年月日（簡易モードのみ表示） */}
            {mode === "simple" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>生年月日</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateInputWrap}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="1990"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={birthYear}
                    onChangeText={setBirthYear}
                    returnKeyType="next"
                  />
                  <Text style={styles.dateUnit}>年</Text>
                </View>
                <View style={styles.dateInputWrap}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                    returnKeyType="next"
                  />
                  <Text style={styles.dateUnit}>月</Text>
                </View>
                <View style={styles.dateInputWrap}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={birthDay}
                    onChangeText={setBirthDay}
                    returnKeyType="done"
                  />
                  <Text style={styles.dateUnit}>日</Text>
                </View>
              </View>
              {errors.birthDate && (
                <Text style={styles.errorText}>{errors.birthDate}</Text>
              )}
            </View>
            )}

            {mode === "simple" && <View style={styles.divider} />}

            {/* 年収 */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>年収</Text>
              <View style={styles.incomeRow}>
                <TextInput
                  style={styles.incomeInput}
                  placeholder="500"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={annualIncome}
                  onChangeText={setAnnualIncome}
                  returnKeyType="done"
                />
                <Text style={styles.incomeUnit}>万円</Text>
              </View>
              {errors.annualIncome && (
                <Text style={styles.errorText}>{errors.annualIncome}</Text>
              )}
            </View>

            {/* 給与所得控除（詳細モードのみ表示） */}
            {mode === "detailed" && annualIncome && parseFloat(annualIncome) > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>給与所得控除</Text>
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>💴</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>年収から自動計算（令和8年度改正後）</Text>
                      <Text style={styles.autoCalcText}>
                        年収 {parseFloat(annualIncome).toLocaleString()}万円
                        {" → "}控除額 {calcKyuyoShotokuKojo(parseFloat(annualIncome) * 10000).toLocaleString()}円
                      </Text>
                      <Text style={styles.autoCalcSub}>計算式：年収に応じた段階控除（最低保障74万円、上限195万円）</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            <View style={styles.divider} />

            {/* 配偶者の扶養（簡易：トグル式、詳細：自動計算） */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{mode === "detailed" ? "配偶者控除" : "配偶者の扶養"}</Text>
              {mode === "simple" ? (
                <View style={styles.switchRow}>
                  <Text style={styles.fieldHint}>配偶者控除（38万円）を適用する</Text>
                  <Switch
                    value={hasSpouseDeduction}
                    onValueChange={(v) => {
                      setHasSpouseDeduction(v);
                      if (Platform.OS !== "web") {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ) : (
                spouseDeductionLabel !== "" ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>💑</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブの配偶者年収から自動計算</Text>
                      <Text style={styles.autoCalcText}>{spouseDeductionLabel}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブで配偶者情報を入力すると自動計算されます</Text>
                )
              )}
            </View>

            <View style={styles.divider} />

            {/* 子供の扶養（簡易：ステッパー式、詳細：自動計算） */}
            {mode === "simple" ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>子供（16歳以上19歳未満）</Text>
                  <Text style={styles.fieldHint}>一般扶養親族：1人につき38万円控除</Text>
                  <View style={[styles.stepperRow, { marginTop: 8 }]}>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => adjustChildren("under19", -1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{childrenUnder19}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => adjustChildren("under19", 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.fieldHint}>人</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>子供（19歳以上22歳以下）</Text>
                  <Text style={styles.fieldHint}>特定扶養親族：1人につき63万円控除</Text>
                  <View style={[styles.stepperRow, { marginTop: 8 }]}>
                    <View style={styles.stepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => adjustChildren("under23", -1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{childrenUnder23}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => adjustChildren("under23", 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.fieldHint}>人</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>扶養控除額</Text>
                {dependentInfo !== "" ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>👶</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定の子供情報から自動判定</Text>
                      <Text style={styles.autoCalcText}>{dependentInfo}</Text>
                      {childrenUnder19 > 0 && (
                        <Text style={styles.autoCalcSub}>一般扶養：{childrenUnder19}人 × 38万円</Text>
                      )}
                      {childrenUnder23 > 0 && (
                        <Text style={styles.autoCalcSub}>特定扶養：{childrenUnder23}人 × 63万円</Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブで子供の生年月日を入力すると自動計算されます</Text>
                )}
              </View>
            )}

            {/* 障害者控除（詳細モードのみ表示） */}
            {mode === "detailed" && (
              <>
                <View style={styles.divider} />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>障害者控除</Text>
                  {disabilityType && disabilityType !== "none" ? (
                    <View style={styles.autoCalcBox}>
                      <Text style={styles.autoCalcIcon}>♿</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.autoCalcTitle}>設定タブの障害者情報から自動計算</Text>
                        <Text style={styles.autoCalcText}>
                          {disabilityType === "general" && "障害者"}
                          {disabilityType === "special" && "特別障害者"}
                          {disabilityType === "cohabiting_special" && "同居特別障害者"}
                          {" → "}控除額 {calcDisabilityDeduction(disabilityType).toLocaleString()}円
                        </Text>
                        <Text style={styles.autoCalcSub}>
                          {disabilityType === "general" && "障害者：27万円の所得控除"}
                          {disabilityType === "special" && "特別障害者：40万円の所得控除"}
                          {disabilityType === "cohabiting_special" && "同居特別障害者：75万円の所得控除"}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.fieldHint}>設定タブの「基本プロフィール」で障害者区分を設定すると自動計算されます</Text>
                  )}
                </View>
              </>
            )}

            {mode === "simple" && <View style={styles.divider} />}

            {/* 勤務地（簡易モードのみ表示） */}
            {mode === "simple" && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>勤務地（都道府県）</Text>
              <TouchableOpacity
                style={styles.prefSelector}
                onPress={() => setShowPrefModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.prefSelectorText}>{prefecture}</Text>
                <Text style={styles.prefChevron}>›</Text>
              </TouchableOpacity>
            </View>
            )}
          </View>

          {/* 詳細モード：控除フォーム */}
          {mode === "detailed" && (
            <View style={styles.card}>
              <View style={styles.detailHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardSectionTitle}>控除の入力</Text>
                  <Text style={styles.cardSectionSubtitle}>
                    入力した控除を加味して手取りを精密計算します
                  </Text>
                </View>
                {/* 年次データ選択プルダウン */}
                {savedYears.length > 0 && (
                  <TouchableOpacity
                    style={styles.yearSelector}
                    onPress={() => setShowYearModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.yearSelectorText}>{selectedYear}年</Text>
                    <Text style={styles.yearSelectorChevron}>▼</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 年次データ反映バナー */}
              {savedYears.includes(selectedYear) && (
                <View style={styles.annualDataBanner}>
                  <Text style={styles.annualDataBannerIcon}>📋</Text>
                  <Text style={styles.annualDataBannerText}>
                    {selectedYear}年の保存データを反映しています
                  </Text>
                </View>
              )}

              {/* iDeCo → 小規模企業共済等掛金控除（設定タブから自動計算） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>小規模企業共済等掛金控除</Text>
                {idecoMonthly ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>🏦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブのiDeCo掛金から自動計算</Text>
                      <Text style={styles.autoCalcText}>
                        月額掛金 {parseInt(idecoMonthly).toLocaleString()}円/月
                        {" → "}控除額 {calcIdecoDeduction(parseInt(idecoMonthly)).toLocaleString()}円/年
                      </Text>
                      <Text style={styles.autoCalcSub}>計算式：月額掛金 × 12か月（上限：27.6万円/年）、全額所得控除</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブの「年次データ」でiDeCo掛金を入力すると自動計算されます</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* ふるさと納税 → 寄付金控除（設定タブから自動計算） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>寄付金控除（ふるさと納税）</Text>
                {furusatoAmount ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>🌾</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブのふるさと納税寄付額から自動計算</Text>
                      <Text style={styles.autoCalcText}>
                        年間寄付額 {parseInt(furusatoAmount).toLocaleString()}円
                        {" → "}実質税額控除 {Math.max(0, parseInt(furusatoAmount) - 2000).toLocaleString()}円
                      </Text>
                      <Text style={styles.autoCalcSub}>計算式：寄付金額 - 2,000円（所得税控除 + 住民税控除の合計）</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブの「年次データ」でふるさと納税寄付額を入力すると自動計算されます</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* 住宅ローン控除（設定タブから自動計算） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>住宅ローン控除</Text>
                {housingLoanBalance ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>🏠</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブの年末残高から自動計算</Text>
                      <Text style={styles.autoCalcText}>
                        年末残高 {parseInt(housingLoanBalance).toLocaleString()}円
                        {" → "}税額控除 {calcHousingLoanDeduction(parseInt(housingLoanBalance)).toLocaleString()}円
                      </Text>
                      <Text style={styles.autoCalcSub}>計算式：年末残高 × 0.7%（上限：35万円）</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブの「年次データ」で住宅ローン残高を入力すると自動計算されます</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* 生命保険料控除額（設定タブから自動計算） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>生命保険料控除額</Text>
                {lifeInsurancePremium ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>📊</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブの年間支払額から自動計算</Text>
                      <Text style={styles.autoCalcText}>
                        年間支払額 {parseInt(lifeInsurancePremium).toLocaleString()}円
                        {" → "}控除額 {calcLifeInsuranceDeduction(parseInt(lifeInsurancePremium)).toLocaleString()}円
                      </Text>
                      <Text style={styles.autoCalcSub}>新制度：一般生命保険料として計算（上限：4万円）</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブの「年次データ」で生命保険料を入力すると自動計算されます</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* 医療費控除額（設定タブから自動計算） */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>医療費控除額</Text>

                {medicalExpenses ? (
                  <View style={styles.autoCalcBox}>
                    <Text style={styles.autoCalcIcon}>🏥</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.autoCalcTitle}>設定タブの年間見込額から自動計算</Text>
                      <Text style={styles.autoCalcText}>
                        年間医療費 {parseInt(medicalExpenses).toLocaleString()}円
                        {" → "}控除額 {calcMedicalExpenseDeduction(parseInt(medicalExpenses), parseFloat(annualIncome) * 10000).toLocaleString()}円
                      </Text>
                      {parseInt(medicalExpenses) <= 100000 && (
                        <Text style={styles.autoCalcSub}>❗ 10万円以下のため控除なし（超過分のみ控除対象）</Text>
                      )}
                      {parseInt(medicalExpenses) > 100000 && (
                        <Text style={styles.autoCalcSub}>計算式：{parseInt(medicalExpenses).toLocaleString()}円 - 100,000円 = {(parseInt(medicalExpenses) - 100000).toLocaleString()}円</Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.fieldHint}>設定タブの「年次データ」で医療費年間見込額を入力すると自動計算されます</Text>
                )}
              </View>

              {/* 有料バナー */}
              <View style={styles.premiumBanner}>
                <Text style={styles.premiumBannerIcon}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumBannerTitle}>有料版で精密計算できるようになります</Text>
                  <Text style={styles.premiumBannerText}>年間費用詳細入力・複数年度比較・税理士監修の計算エンジンなど</Text>
                </View>
                <TouchableOpacity style={styles.premiumBannerBtn} activeOpacity={0.8}>
                  <Text style={styles.premiumBannerBtnText}>アップグレード</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.calcButton}
            onPress={handleCalculate}
            activeOpacity={0.85}
          >
            <Text style={styles.calcButtonText}>
              {mode === "detailed" ? "詳細計算する" : "手取りを計算する"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            ※ 本計算は概算です。実際の金額は給与明細・確定申告等でご確認ください。{"\n"}
            ※ 配偶者控除・扶養控除は設定タブのデータから自動計算されます。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 都道府県選択モーダル */}
      <Modal
        visible={showPrefModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrefModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>勤務地を選択</Text>
            <TouchableOpacity
              onPress={() => setShowPrefModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={PREFECTURES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.prefItem,
                  item === prefecture && styles.prefItemSelected,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => {
                  setPrefecture(item);
                  setShowPrefModal(false);
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
              >
                <Text
                  style={[
                    styles.prefItemText,
                    item === prefecture && styles.prefItemTextSelected,
                  ]}
                >
                  {item}
                </Text>
                {item === prefecture && (
                  <Text style={styles.prefCheckmark}>✓</Text>
                )}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.prefDivider} />}
          />
        </View>
      </Modal>

      {/* 年次データ選択モーダル */}
      <Modal
        visible={showYearModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowYearModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>年次データを選択</Text>
            <TouchableOpacity
              onPress={() => setShowYearModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={savedYears}
            keyExtractor={(item) => String(item)}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.prefItem,
                  item === selectedYear && styles.prefItemSelected,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => handleYearSelect(item)}
              >
                <Text
                  style={[
                    styles.prefItemText,
                    item === selectedYear && styles.prefItemTextSelected,
                  ]}
                >
                  {item}年のデータ
                </Text>
                {item === selectedYear && (
                  <Text style={styles.prefCheckmark}>✓</Text>
                )}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.prefDivider} />}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 20,
      paddingTop: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 4,
    },
    // モード切替トグル
    modeToggleContainer: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: 16,
    },
    modeToggleBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 9,
      gap: 6,
    },
    modeToggleBtnActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    modeToggleBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.muted,
    },
    modeToggleBtnTextActive: {
      color: "#FFFFFF",
    },
    premiumBadge: {
      backgroundColor: "#F5A623",
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    premiumBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: 0.5,
    },
    // 詳細モード説明バナー
    detailBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#EEF6FF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 14,
      marginBottom: 16,
      gap: 10,
    },
    detailBannerIcon: {
      fontSize: 22,
    },
    detailBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
      marginBottom: 3,
    },
    detailBannerText: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    // カード
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    cardSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    cardSectionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 16,
    },
    // 詳細モードヘッダー行
    detailHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 4,
      gap: 8,
    },
    // 年次データ選択
    yearSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
      marginTop: 2,
    },
    yearSelectorText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },
    yearSelectorChevron: {
      fontSize: 10,
      color: colors.primary,
    },
    // 年次データ反映バナー
    annualDataBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F0FFF4",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#68D391",
      padding: 10,
      marginBottom: 16,
      gap: 8,
    },
    annualDataBannerIcon: {
      fontSize: 16,
    },
    annualDataBannerText: {
      fontSize: 12,
      color: "#276749",
      fontWeight: "500",
    },
    // 自動計算ボックス（配偶者控除・扶養控除）
    autoCalcBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#FFFBEB",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#F6AD55",
      padding: 10,
      marginTop: 4,
      gap: 8,
    },
    autoCalcIcon: {
      fontSize: 16,
    },
    autoCalcTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: "#744210",
      marginBottom: 2,
    },
    autoCalcText: {
      fontSize: 11,
      color: "#744210",
      lineHeight: 16,
    },
    autoCalcSub: {
      fontSize: 10,
      color: "#92400E",
      lineHeight: 15,
      marginTop: 1,
    },
    // 扶養自動判定ボックス（後方互換のために残す）
    dependentInfoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "#FFFBEB",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#F6AD55",
      padding: 10,
      marginTop: 8,
      gap: 8,
    },
    dependentInfoIcon: {
      fontSize: 16,
    },
    dependentInfoTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: "#744210",
      marginBottom: 2,
    },
    dependentInfoText: {
      fontSize: 11,
      color: "#744210",
      lineHeight: 16,
    },
    // フィールド
    fieldGroup: {
      marginBottom: 4,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 6,
    },
    fieldHint: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    // 日付入力
    dateRow: {
      flexDirection: "row",
      gap: 8,
    },
    dateInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dateInput: {
      width: 70,
      height: 44,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      fontSize: 16,
      color: colors.foreground,
      textAlign: "center",
    },
    dateUnit: {
      fontSize: 14,
      color: colors.muted,
    },
    // 年収入力
    incomeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    incomeInput: {
      flex: 1,
      height: 48,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      fontSize: 20,
      fontWeight: "600",
      color: colors.foreground,
    },
    incomeUnit: {
      fontSize: 14,
      color: colors.muted,
      minWidth: 40,
    },
    // 詳細入力
    detailInput: {
      flex: 1,
      height: 44,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      fontSize: 16,
      color: colors.foreground,
    },
    // スイッチ行
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    // ステッパー
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperBtnText: {
      fontSize: 18,
      color: colors.foreground,
      lineHeight: 22,
    },
    stepperValue: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      minWidth: 24,
      textAlign: "center",
    },
    // 都道府県セレクター
    prefSelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: 44,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    prefSelectorText: {
      fontSize: 16,
      color: colors.foreground,
    },
    prefChevron: {
      fontSize: 20,
      color: colors.muted,
    },
    // エラーテキスト
    errorText: {
      fontSize: 12,
      color: "#EF4444",
      marginTop: 4,
    },
    // 計算ボタン
    calcButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    calcButtonText: {
      fontSize: 17,
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: 0.3,
    },
    disclaimer: {
      fontSize: 11,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 16,
      marginBottom: 8,
    },
    // モーダル
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    modalClose: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: "600",
    },
    prefItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    prefItemSelected: {
      backgroundColor: colors.surface,
    },
    prefItemText: {
      fontSize: 16,
      color: colors.foreground,
    },
    prefItemTextSelected: {
      color: colors.primary,
      fontWeight: "600",
    },
    prefCheckmark: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: "700",
    },
    prefDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    premiumBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFF8E1",
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: "#FFD54F",
    },
    premiumBannerIcon: {
      fontSize: 22,
    },
    premiumBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#E65100",
      marginBottom: 2,
    },
    premiumBannerText: {
      fontSize: 11,
      color: "#795548",
      lineHeight: 16,
    },
    premiumBannerBtn: {
      backgroundColor: "#FF8F00",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    premiumBannerBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
}
