import React from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DonutChart } from "@/components/DonutChart";
import { formatManYen, formatYen, type TaxResult } from "@/lib/taxCalculator";
import { useColors } from "@/hooks/use-colors";

export default function ResultScreen() {
  const router = useRouter();
  const colors = useColors();
  const { result: resultJson, mode } = useLocalSearchParams<{
    result: string;
    mode: string;
  }>();

  const result: TaxResult = JSON.parse(resultJson ?? "{}");
  const isDetailedMode = mode === "detailed";

  const incomeMan = Math.round(result.annualIncome / 10_000);
  const socialMan = Math.round(result.totalSocialInsurance / 10_000);
  const taxMan = Math.round(result.totalTax / 10_000);
  const takeHomeMan = Math.round(result.takeHome / 10_000);

  // 標準賞与額を万円単位に
  const bonusKenpoMan = Math.round(result.standardBonusRemunerationKenpo / 10_000);

  const chartSegments = [
    {
      value: result.takeHome,
      color: "#2ECC71",
      label: "手取り",
    },
    {
      value: result.totalSocialInsurance,
      color: "#F5A623",
      label: "社会保険料",
    },
    {
      value: result.totalTax,
      color: "#E05252",
      label: "税金",
    },
  ];

  const styles = createStyles(colors);

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  // 節税効果の有無チェック
  const hasTaxSavings = isDetailedMode && (result.taxSavings ?? 0) > 0;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>‹ 戻る</Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>診断結果</Text>
            {isDetailedMode && (
              <View style={styles.detailModeBadge}>
                <Text style={styles.detailModeBadgeText}>詳細モード</Text>
              </View>
            )}
          </View>
        </View>

        {/* サマリーカード */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            あなたの年収{" "}
            <Text style={styles.summaryHighlight}>{incomeMan.toLocaleString()}万円</Text>{" "}
            のうち、
          </Text>
          <Text style={styles.summaryText}>
            社会保険料が約{" "}
            <Text style={[styles.summaryHighlight, { color: "#F5A623" }]}>
              {socialMan.toLocaleString()}万円
            </Text>
            、税金が約{" "}
            <Text style={[styles.summaryHighlight, { color: "#E05252" }]}>
              {taxMan.toLocaleString()}万円
            </Text>
            、
          </Text>
          <Text style={[styles.summaryText, { marginTop: 4 }]}>
            手取り額が約{" "}
            <Text style={[styles.summaryHighlight, { color: "#2ECC71", fontSize: 22 }]}>
              {takeHomeMan.toLocaleString()}万円
            </Text>{" "}
            です。
          </Text>
          <View style={styles.ratioRow}>
            <Text style={styles.ratioLabel}>手取り割合</Text>
            <Text style={styles.ratioValue}>{result.takeHomeRatio}%</Text>
          </View>
        </View>

        {/* 詳細モード：節税効果カード */}
        {hasTaxSavings && (
          <View style={styles.savingsCard}>
            <View style={styles.savingsHeader}>
              <Text style={styles.savingsIcon}>💰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.savingsTitle}>節税効果</Text>
                <Text style={styles.savingsSubtitle}>入力した控除による税負担の軽減額</Text>
              </View>
              <Text style={styles.savingsTotal}>
                {formatYen(result.taxSavings ?? 0)}
              </Text>
            </View>
            <View style={styles.savingsDivider} />
            {(result.idecoDeduction ?? 0) > 0 && (
              <SavingsRow
                label="iDeCo 所得控除"
                value={`控除額 ${formatYen(result.idecoDeduction!)}`}
                colors={colors}
              />
            )}
            {(result.furusatoTaxCredit ?? 0) > 0 && (
              <SavingsRow
                label="ふるさと納税 税額控除"
                value={formatYen(result.furusatoTaxCredit!)}
                colors={colors}
              />
            )}
            {(result.housingLoanDeductionApplied ?? 0) > 0 && (
              <SavingsRow
                label="住宅ローン控除（適用額）"
                value={formatYen(result.housingLoanDeductionApplied!)}
                colors={colors}
              />
            )}
            {(result.lifeInsuranceDeduction ?? 0) > 0 && (
              <SavingsRow
                label="生命保険料 所得控除"
                value={`控除額 ${formatYen(result.lifeInsuranceDeduction!)}`}
                colors={colors}
              />
            )}
            {(result.medicalExpenseDeduction ?? 0) > 0 && (
              <SavingsRow
                label="医療費控除"
                value={`控除額 ${formatYen(result.medicalExpenseDeduction!)}`}
                colors={colors}
              />
            )}
          </View>
        )}

        {/* 円グラフ */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>内訳グラフ</Text>
          <View style={styles.chartContainer}>
            <DonutChart
              segments={chartSegments}
              size={220}
              strokeWidth={38}
              centerLabel={`${result.takeHomeRatio}%`}
              centerSubLabel="手取り割合"
            />
          </View>
          {/* 凡例 */}
          <View style={styles.legend}>
            {chartSegments.map((seg) => (
              <View key={seg.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: seg.color }]}
                />
                <Text style={styles.legendLabel}>{seg.label}</Text>
                <Text style={styles.legendValue}>
                  {formatManYen(seg.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 社会保険料内訳カード */}
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>社会保険料の内訳</Text>
          <DetailRow
            label="健康保険料"
            value={formatYen(result.healthInsurance)}
            colors={colors}
          />
          {result.nursingInsurance > 0 && (
            <DetailRow
              label="介護保険料"
              value={formatYen(result.nursingInsurance)}
              colors={colors}
            />
          )}
          <DetailRow
            label="子ども・子育て支援金"
            value={formatYen(result.kodomoKosodate)}
            colors={colors}
          />
          <DetailRow
            label="厚生年金保険料"
            value={formatYen(result.pensionInsurance)}
            colors={colors}
          />
          <DetailRow
            label="雇用保険料"
            value={formatYen(result.employmentInsurance)}
            colors={colors}
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>社会保険料 合計</Text>
            <Text style={[styles.totalValue, { color: "#F5A623" }]}>
              {formatManYen(result.totalSocialInsurance)}
            </Text>
          </View>
        </View>

        {/* 税金内訳カード */}
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>税金の内訳</Text>
          <DetailRow
            label="所得税（復興税含む）"
            value={formatYen(result.incomeTax)}
            colors={colors}
          />
          <DetailRow
            label="住民税"
            value={formatYen(result.residentTax)}
            colors={colors}
          />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>税金 合計</Text>
            <Text style={[styles.totalValue, { color: "#E05252" }]}>
              {formatManYen(result.totalTax)}
            </Text>
          </View>
        </View>

        {/* 計算の前提条件 */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>計算の前提条件</Text>
          <Text style={styles.noticeText}>
            • 社会保険料は、協会けんぽ加入を前提に計算しており、2026年3月分（4月納付分）に基づいて計算しています。
          </Text>
          <Text style={styles.noticeText}>
            • 社会保険料は、標準報酬月額 {formatYen(result.standardMonthlyRemuneration)} と仮定して計算しています。
          </Text>
          <Text style={styles.noticeText}>
            • 賞与は月収の4ヶ月分としており、標準賞与額 {bonusKenpoMan}万円/回、年2回と仮定して計算しています。
          </Text>
          <Text style={styles.noticeText}>
            • 所得税は、2026年に適用される法令に基づいて計算しています（2026年3月1日現在）。
          </Text>
          <Text style={styles.noticeText}>
            • 住民税は前年所得ベースで計算しています（標準税率10%）。
          </Text>
          {isDetailedMode && (
            <Text style={styles.noticeText}>
              • ふるさと納税の控除額はワンストップ特例または確定申告を行った場合の試算です。
            </Text>
          )}
        </View>

        {/* もう一度ボタン */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleBack}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>もう一度計算する</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
        {value}
      </Text>
    </View>
  );
}

function SavingsRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(46,204,113,0.15)",
      }}
    >
      <Text style={{ fontSize: 13, color: "#1A7A40" }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#1A7A40" }}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
    },
    header: {
      marginBottom: 20,
      paddingTop: 4,
    },
    backBtn: {
      marginBottom: 8,
    },
    backBtnText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: "500",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    detailModeBadge: {
      backgroundColor: "#F5A623",
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    detailModeBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    summaryText: {
      fontSize: 16,
      color: colors.foreground,
      lineHeight: 28,
    },
    summaryHighlight: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primary,
    },
    ratioRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    ratioLabel: {
      fontSize: 15,
      color: colors.muted,
      fontWeight: "500",
    },
    ratioValue: {
      fontSize: 28,
      fontWeight: "800",
      color: "#2ECC71",
      letterSpacing: -1,
    },
    // 節税効果カード
    savingsCard: {
      backgroundColor: "#F0FBF4",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: "#2ECC71",
      shadowColor: "#2ECC71",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 2,
    },
    savingsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    savingsIcon: {
      fontSize: 24,
    },
    savingsTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#1A7A40",
    },
    savingsSubtitle: {
      fontSize: 12,
      color: "#2E8B57",
      marginTop: 2,
    },
    savingsTotal: {
      fontSize: 18,
      fontWeight: "800",
      color: "#1A7A40",
    },
    savingsDivider: {
      height: 1,
      backgroundColor: "rgba(46,204,113,0.3)",
      marginBottom: 8,
    },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 16,
    },
    chartContainer: {
      alignItems: "center",
      marginBottom: 20,
    },
    legend: {
      gap: 10,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
    },
    legendValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 12,
      marginTop: 4,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "700",
    },
    noticeCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noticeTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
      marginBottom: 8,
    },
    noticeText: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 20,
      marginBottom: 4,
    },
    retryButton: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primary,
    },
  });
}
