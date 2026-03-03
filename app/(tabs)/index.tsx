import React, { useState } from "react";
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
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { PREFECTURES } from "@/lib/constants";
import { calculateTax, type TaxInput } from "@/lib/taxCalculator";
import { useColors } from "@/hooks/use-colors";

// モード定義
type CalcMode = "simple" | "detailed";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();

  // モード状態
  const [mode, setMode] = useState<CalcMode>("simple");

  // 入力状態（簡易モード）
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [annualIncome, setAnnualIncome] = useState("");
  const [hasSpouseDeduction, setHasSpouseDeduction] = useState(false);
  const [childrenUnder19, setChildrenUnder19] = useState(0);
  const [childrenUnder23, setChildrenUnder23] = useState(0);
  const [prefecture, setPrefecture] = useState("東京都");
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleModeToggle = (isDetailed: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isDetailed) {
      // 詳細モードは有料版専用 → 設定タブへ誘導するアラート表示
      setMode("detailed");
    } else {
      setMode("simple");
    }
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

  const handleCalculate = () => {
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
    };

    const result = calculateTax(input);

    router.push({
      pathname: "/result",
      params: {
        result: JSON.stringify(result),
        annualIncomeInput: annualIncome,
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

          {/* 詳細モードのプレミアム案内 */}
          {mode === "detailed" && (
            <View style={styles.premiumBanner}>
              <Text style={styles.premiumBannerIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumBannerTitle}>詳細モードは有料版専用です</Text>
                <Text style={styles.premiumBannerText}>
                  iDeCo・ふるさと納税・住宅ローン控除を含む1円単位の精密計算。年額500円でご利用いただけます。
                </Text>
              </View>
              <TouchableOpacity
                style={styles.premiumBannerBtn}
                onPress={() => router.push("/(tabs)/settings")}
                activeOpacity={0.8}
              >
                <Text style={styles.premiumBannerBtnText}>詳細を見る</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* フォームカード（簡易モード） */}
          <View style={styles.card}>
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

          <TouchableOpacity
            style={styles.calcButton}
            onPress={handleCalculate}
            activeOpacity={0.85}
          >
            <Text style={styles.calcButtonText}>手取りを計算する</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            ※ 本計算は概算です。実際の金額は給与明細等でご確認ください。
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
    // プレミアム案内バナー
    premiumBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFF8EC",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#F5A623",
      padding: 14,
      marginBottom: 16,
      gap: 10,
    },
    premiumBannerIcon: {
      fontSize: 24,
    },
    premiumBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#8B5E00",
      marginBottom: 4,
    },
    premiumBannerText: {
      fontSize: 12,
      color: "#A07020",
      lineHeight: 18,
    },
    premiumBannerBtn: {
      backgroundColor: "#F5A623",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    premiumBannerBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#FFFFFF",
    },
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
    fieldGroup: {
      paddingVertical: 14,
    },
    fieldLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 8,
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
