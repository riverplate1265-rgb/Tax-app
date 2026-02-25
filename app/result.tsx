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
  const { result: resultJson, annualIncomeInput } = useLocalSearchParams<{
    result: string;
    annualIncomeInput: string;
  }>();

  const result: TaxResult = JSON.parse(resultJson ?? "{}");

  const incomeMan = Math.round(result.annualIncome / 10_000);
  const socialMan = Math.round(result.totalSocialInsurance / 10_000);
  const taxMan = Math.round(result.totalTax / 10_000);
  const takeHomeMan = Math.round(result.takeHome / 10_000);

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
          <Text style={styles.headerTitle}>診断結果</Text>
        </View>

        {/* サマリーカード */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            あなたの年収{" "}
            <Text style={styles.summaryHighlight}>{incomeMan.toLocaleString()}万円</Text>{" "}
            のうち、
          </Text>
          <Text style={styles.summaryText}>
            社会保険料が{" "}
            <Text style={[styles.summaryHighlight, { color: "#F5A623" }]}>
              {socialMan.toLocaleString()}万円
            </Text>
            、
          </Text>
          <Text style={styles.summaryText}>
            税金が{" "}
            <Text style={[styles.summaryHighlight, { color: "#E05252" }]}>
              {taxMan.toLocaleString()}万円
            </Text>
            、
          </Text>
          <Text style={[styles.summaryText, { marginTop: 8 }]}>
            手取り額が{" "}
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

        {/* 内訳カード */}
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

        {/* 注意書き */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>計算の前提条件</Text>
          <Text style={styles.noticeText}>
            • 社会保険料は標準報酬月額で決まります（標準報酬月額: {formatYen(result.standardMonthlyRemuneration)}）
          </Text>
          <Text style={styles.noticeText}>
            • 住民税は前年所得ベースで計算されます（標準税率10%）
          </Text>
          <Text style={styles.noticeText}>
            • 賞与は月収の4ヶ月分として計算しています
          </Text>
          <Text style={styles.noticeText}>
            • 協会けんぽ加入を前提に計算しています
          </Text>
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
    headerTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.5,
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
      marginBottom: 2,
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
