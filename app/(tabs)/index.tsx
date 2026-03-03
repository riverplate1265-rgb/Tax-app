import React, { useState, useEffect } from "react";
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
import { calculateTax, type TaxInput } from "@/lib/taxCalculator";
import { useColors } from "@/hooks/use-colors";
import { useAnnualSettings } from "@/hooks/use-annual-settings";
import { useAuthLink } from "@/hooks/use-auth-link";

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

  const handleModeToggle = (isDetailed: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMode(isDetailed ? "detailed" : "simple");
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
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

    const birthDate = new Date(
      parseInt(birthYear, 10),
      parseInt(birthMonth, 10) - 1,
      parseInt(birthDay, 10)
    );

    const input: TaxInput = {
      birthDate,
      annualIncome: parseFloat(annualIncome),
      hasSpouseDeduction,
      childrenUnder19,
      childrenUnder23,
      prefecture,
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
    save({
      annual_income: parseFloat(annualIncome),
      prefecture,
      birth_date: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
    } as any).catch((e) => console.warn("[HomeScreen] settings save failed:", e));

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
                <Text style={styles.detailBannerTitle}>詳細モード：節税控除を反映</Text>
                <Text style={styles.detailBannerText}>
                  iDeCo・ふるさと納税・住宅ローン控除を加味した精密計算を行います。
                </Text>
              </View>
            </View>
          )}

          {/* フォームカード（共通：基本情報） */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>基本情報</Text>

            {/* 生年月日 */}
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

            <View style={styles.divider} />

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

            <View style={styles.divider} />

            {/* 配偶者扶養 */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>配偶者の扶養</Text>
                <Text style={styles.fieldHint}>満額控除（38万円）で計算</Text>
              </View>
              <Switch
                value={hasSpouseDeduction}
                onValueChange={(v) => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setHasSpouseDeduction(v);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* 子供（16歳以上19歳未満） */}
            <View style={styles.stepperRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>子供（16歳以上19歳未満）</Text>
                <Text style={styles.fieldHint}>一般扶養控除 38万円/人</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustChildren("under19", -1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{childrenUnder19}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustChildren("under19", 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* 子供（19歳以上22歳以下） */}
            <View style={styles.stepperRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>子供（19歳以上22歳以下）</Text>
                <Text style={styles.fieldHint}>特定扶養控除 63万円/人</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustChildren("under23", -1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{childrenUnder23}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustChildren("under23", 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stepperBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* 勤務地 */}
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
          </View>

          {/* 詳細モード：節税控除フォーム */}
          {mode === "detailed" && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>節税控除の入力</Text>
              <Text style={styles.cardSectionSubtitle}>
                入力した控除を加味して手取りを精密計算します
              </Text>

              {/* iDeCo */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>iDeCo 月額掛金</Text>
                <Text style={styles.fieldHint}>全額所得控除。上限：会社員2.3万円/月</Text>
                <View style={[styles.incomeRow, { marginTop: 8 }]}>
                  <TextInput
                    style={styles.detailInput}
                    placeholder="23000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={idecoMonthly}
                    onChangeText={setIdecoMonthly}
                    returnKeyType="next"
                  />
                  <Text style={styles.incomeUnit}>円/月</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* ふるさと納税 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ふるさと納税 年間寄付額</Text>
                <Text style={styles.fieldHint}>2,000円を超える部分が税額控除されます</Text>
                <View style={[styles.incomeRow, { marginTop: 8 }]}>
                  <TextInput
                    style={styles.detailInput}
                    placeholder="50000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={furusatoAmount}
                    onChangeText={setFurusatoAmount}
                    returnKeyType="next"
                  />
                  <Text style={styles.incomeUnit}>円/年</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 住宅ローン控除 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>住宅ローン年末残高</Text>
                <Text style={styles.fieldHint}>残高×0.7%が税額控除（令和4年以降入居）</Text>
                <View style={[styles.incomeRow, { marginTop: 8 }]}>
                  <TextInput
                    style={styles.detailInput}
                    placeholder="30000000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={housingLoanBalance}
                    onChangeText={setHousingLoanBalance}
                    returnKeyType="next"
                  />
                  <Text style={styles.incomeUnit}>円</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 生命保険料控除 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>生命保険料 年間支払額</Text>
                <Text style={styles.fieldHint}>新制度：最大4万円の所得控除</Text>
                <View style={[styles.incomeRow, { marginTop: 8 }]}>
                  <TextInput
                    style={styles.detailInput}
                    placeholder="120000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={lifeInsurancePremium}
                    onChangeText={setLifeInsurancePremium}
                    returnKeyType="next"
                  />
                  <Text style={styles.incomeUnit}>円/年</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 医療費控除 */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>医療費 年間支払額</Text>
                <Text style={styles.fieldHint}>10万円超の部分が所得控除（上限200万円）</Text>
                <View style={[styles.incomeRow, { marginTop: 8 }]}>
                  <TextInput
                    style={styles.detailInput}
                    placeholder="150000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={medicalExpenses}
                    onChangeText={setMedicalExpenses}
                    returnKeyType="done"
                  />
                  <Text style={styles.incomeUnit}>円/年</Text>
                </View>
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
            ※ 本計算は概算です。実際の金額は給与明細・確定申告等でご確認ください。
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
      lineHeight: 18,
    },
    // カード
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
      paddingTop: 14,
      paddingBottom: 4,
      letterSpacing: 0.3,
    },
    cardSectionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      paddingBottom: 8,
    },
    fieldGroup: {
      paddingVertical: 14,
    },
    fieldLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 4,
    },
    fieldHint: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    dateRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    dateInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flex: 1,
    },
    dateInput: {
      flex: 1,
      fontSize: 16,
      color: colors.foreground,
      padding: 0,
    },
    dateUnit: {
      fontSize: 14,
      color: colors.muted,
      marginLeft: 2,
    },
    incomeRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    incomeInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: "600",
      color: colors.foreground,
      padding: 0,
    },
    detailInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: "500",
      color: colors.foreground,
      padding: 0,
    },
    incomeUnit: {
      fontSize: 16,
      color: colors.muted,
      marginLeft: 4,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperBtnText: {
      fontSize: 18,
      color: "#FFFFFF",
      fontWeight: "600",
      lineHeight: 22,
    },
    stepperValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
      minWidth: 24,
      textAlign: "center",
    },
    prefSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginTop: 8,
    },
    prefSelectorText: {
      flex: 1,
      fontSize: 16,
      color: colors.foreground,
      fontWeight: "500",
    },
    prefChevron: {
      fontSize: 20,
      color: colors.muted,
    },
    calcButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 16,
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
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
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
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.foreground,
    },
    modalClose: {
      fontSize: 16,
      color: colors.primary,
    },
    prefItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
    },
    prefItemSelected: {
      backgroundColor: colors.background,
    },
    prefItemText: {
      flex: 1,
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
      fontWeight: "600",
    },
    prefDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 16,
    },
  });
}
