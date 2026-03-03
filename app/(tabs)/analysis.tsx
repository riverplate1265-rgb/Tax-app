import React, { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DonutChart } from "@/components/DonutChart";
import { BarChart, HorizontalBar } from "@/components/BarChart";
import { useColors } from "@/hooks/use-colors";
import {
  simulateFutureIncome,
  calcTaxUsage,
  calcFurusatoOptimal,
  calcIdecoMax,
} from "@/lib/taxCalculatorDetailed";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 64; // padding考慮

// ===== モックデータ =====
// 実際の実装ではSupabaseから取得
const MOCK_ANNUAL_INCOME = 500; // 万円
const MOCK_AGE = 35;
const MOCK_TAKE_HOME = 383; // 万円
const MOCK_TOTAL_TAX = 27; // 万円（所得税+住民税）
const MOCK_SOCIAL_INSURANCE = 90; // 万円

// 同世代比較データ（統計ベース）
const PEER_COMPARISON_DATA = [
  { label: "25-29歳", value: 348, color: "#D8E3EF" },
  { label: "30-34歳", value: 401, color: "#D8E3EF" },
  { label: "35-39歳", value: 447, color: "#1A6FD4" }, // 現在の年代（ハイライト）
  { label: "40-44歳", value: 487, color: "#D8E3EF" },
  { label: "45-49歳", value: 512, color: "#D8E3EF" },
];

// 過年度比較データ
const YEARLY_COMPARISON_DATA = [
  { label: "2022", value: 360, color: "#D8E3EF" },
  { label: "2023", value: 371, color: "#D8E3EF" },
  { label: "2024", value: 375, color: "#D8E3EF" },
  { label: "2025", value: 380, color: "#D8E3EF" },
  { label: "2026", value: 383, color: "#2ECC71" }, // 今年（ハイライト）
];

// 税務カレンダーデータ
const TAX_CALENDAR = [
  { month: 1, label: "1月", events: ["給与支払報告書提出"] },
  { month: 2, label: "2月", events: ["確定申告受付開始（2/17〜）"] },
  { month: 3, label: "3月", events: ["確定申告期限（3/17）", "協会けんぽ保険料率改定"] },
  { month: 4, label: "4月", events: ["子ども・子育て支援金 徴収開始"] },
  { month: 5, label: "5月", events: ["住民税決定通知書"] },
  { month: 6, label: "6月", events: ["住民税 第1期納付", "住民税特別徴収開始"] },
  { month: 8, label: "8月", events: ["住民税 第2期納付"] },
  { month: 10, label: "10月", events: ["住民税 第3期納付"] },
  { month: 11, label: "11月", events: ["年末調整書類提出"] },
  { month: 12, label: "12月", events: ["年末調整", "住民税 第4期納付"] },
];

// 分析サブタブ
type AnalysisTab = "comparison" | "future" | "taxUsage" | "calendar" | "taxSaving";

export default function AnalysisScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<AnalysisTab>("comparison");
  const [comparisonView, setComparisonView] = useState<"peer" | "yearly">("peer");

  const currentMonth = new Date().getMonth() + 1;

  // 将来予測データ（メモ化）
  const futureData = useMemo(() => {
    const data = simulateFutureIncome(MOCK_AGE, MOCK_ANNUAL_INCOME, 0.02, 65);
    // 5年おきにサンプリング
    return data.filter((_, i) => i % 5 === 0).map((d) => ({
      label: `${d.age}歳`,
      value: d.takeHome,
      color: d.age === MOCK_AGE ? "#1A6FD4" : "#A8C4E8",
    }));
  }, []);

  // 税の使い道データ
  const taxUsageData = useMemo(() => {
    const totalTax = MOCK_TOTAL_TAX * 10_000;
    return calcTaxUsage(totalTax);
  }, []);

  // 節税提案データ
  const idecoMax = calcIdecoMax("会社員（企業年金なし）");
  const furusatoOptimal = calcFurusatoOptimal(
    MOCK_ANNUAL_INCOME * 10_000,
    false,
    0
  );
  const idecoAnnualSavings = Math.round((idecoMax * 12 * 0.20) / 10_000); // 概算節税額（万円）
  const furusatoSavings = Math.round((furusatoOptimal - 2_000) / 10_000);

  const styles = createStyles(colors);

  const renderTabContent = () => {
    switch (activeTab) {
      case "comparison":
        return renderComparisonTab();
      case "future":
        return renderFutureTab();
      case "taxUsage":
        return renderTaxUsageTab();
      case "calendar":
        return renderCalendarTab();
      case "taxSaving":
        return renderTaxSavingTab();
      default:
        return null;
    }
  };

  // ① 比較グラフ
  const renderComparisonTab = () => (
    <View>
      {/* 比較ビュー切替 */}
      <View style={styles.subToggle}>
        <TouchableOpacity
          style={[styles.subToggleBtn, comparisonView === "peer" && styles.subToggleBtnActive]}
          onPress={() => setComparisonView("peer")}
        >
          <Text style={[styles.subToggleBtnText, comparisonView === "peer" && styles.subToggleBtnTextActive]}>
            同世代比較
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subToggleBtn, comparisonView === "yearly" && styles.subToggleBtnActive]}
          onPress={() => setComparisonView("yearly")}
        >
          <Text style={[styles.subToggleBtnText, comparisonView === "yearly" && styles.subToggleBtnTextActive]}>
            過年度比較
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {comparisonView === "peer" ? "同世代の平均手取り比較" : "あなたの手取り推移"}
        </Text>
        <Text style={styles.cardSubtitle}>
          {comparisonView === "peer"
            ? "国税庁「民間給与実態統計調査」ベース（概算）"
            : "過去5年間の手取り額の推移"}
        </Text>

        <View style={styles.chartContainer}>
          <BarChart
            data={comparisonView === "peer" ? PEER_COMPARISON_DATA : YEARLY_COMPARISON_DATA}
            width={CHART_WIDTH}
            height={180}
            highlightIndex={comparisonView === "peer" ? 2 : 4}
            unit="万円"
          />
        </View>

        {comparisonView === "peer" && (
          <View style={styles.insightBox}>
            <Text style={styles.insightIcon}>💡</Text>
            <Text style={styles.insightText}>
              35〜39歳の平均手取りは{" "}
              <Text style={styles.insightHighlight}>447万円</Text>
              。あなたの手取り{" "}
              <Text style={[styles.insightHighlight, { color: "#E05252" }]}>383万円</Text>
              {" "}は平均より約64万円低い水準です。
            </Text>
          </View>
        )}

        {comparisonView === "yearly" && (
          <View style={styles.insightBox}>
            <Text style={styles.insightIcon}>📈</Text>
            <Text style={styles.insightText}>
              昨年比{" "}
              <Text style={styles.insightHighlight}>+3万円</Text>
              {" "}増加。5年間で合計{" "}
              <Text style={styles.insightHighlight}>+23万円</Text>
              {" "}の手取り増加です。
            </Text>
          </View>
        )}
      </View>

      {/* 現在の収入内訳サマリー */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>今年の収入内訳</Text>
        <View style={styles.chartContainer}>
          <DonutChart
            segments={[
              { value: MOCK_TAKE_HOME, color: "#2ECC71", label: "手取り" },
              { value: MOCK_SOCIAL_INSURANCE, color: "#F5A623", label: "社会保険料" },
              { value: MOCK_TOTAL_TAX, color: "#E05252", label: "税金" },
            ]}
            size={180}
            strokeWidth={32}
            centerLabel={`${Math.round((MOCK_TAKE_HOME / MOCK_ANNUAL_INCOME) * 100)}%`}
            centerSubLabel="手取り割合"
          />
        </View>
        <View style={styles.legendRow}>
          {[
            { label: "手取り", value: MOCK_TAKE_HOME, color: "#2ECC71" },
            { label: "社会保険料", value: MOCK_SOCIAL_INSURANCE, color: "#F5A623" },
            { label: "税金", value: MOCK_TOTAL_TAX, color: "#E05252" },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={[styles.legendValue, { color: item.color }]}>{item.value}万円</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ② 将来予測
  const renderFutureTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>65歳までの手取り予測</Text>
        <Text style={styles.cardSubtitle}>年収上昇率2%・現状の控除条件を維持した場合</Text>
        <View style={styles.chartContainer}>
          <BarChart
            data={futureData}
            width={CHART_WIDTH}
            height={180}
            highlightIndex={0}
            unit="万円"
          />
        </View>
        <View style={styles.insightBox}>
          <Text style={styles.insightIcon}>🔮</Text>
          <Text style={styles.insightText}>
            65歳時点での推定手取りは約{" "}
            <Text style={styles.insightHighlight}>
              {futureData[futureData.length - 1]?.value ?? 0}万円
            </Text>
            。30年間の累計手取りは約{" "}
            <Text style={styles.insightHighlight}>
              {futureData.reduce((sum, d) => sum + d.value * 5, 0).toLocaleString()}万円
            </Text>
            （概算）です。
          </Text>
        </View>
      </View>

      {/* 資産推移シミュレーション */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>資産推移シミュレーション</Text>
        <Text style={styles.cardSubtitle}>手取りの40%を毎年積立投資（年利3%想定）</Text>
        <View style={styles.simulationGrid}>
          {[
            { age: 40, label: "5年後（40歳）", amount: Math.round(MOCK_TAKE_HOME * 0.4 * 5 * 1.08) },
            { age: 45, label: "10年後（45歳）", amount: Math.round(MOCK_TAKE_HOME * 0.4 * 10 * 1.16) },
            { age: 55, label: "20年後（55歳）", amount: Math.round(MOCK_TAKE_HOME * 0.4 * 20 * 1.35) },
            { age: 65, label: "30年後（65歳）", amount: Math.round(MOCK_TAKE_HOME * 0.4 * 30 * 1.56) },
          ].map((item) => (
            <View key={item.age} style={styles.simulationCard}>
              <Text style={styles.simulationLabel}>{item.label}</Text>
              <Text style={styles.simulationAmount}>
                {item.amount.toLocaleString()}
                <Text style={styles.simulationUnit}>万円</Text>
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.noticeText}>
          ※ 概算値です。実際の運用成績は変動します。
        </Text>
      </View>
    </View>
  );

  // ③ 税の使い道
  const renderTaxUsageTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>あなたの税金の使い道</Text>
        <Text style={styles.cardSubtitle}>
          今年の推定納税額 {MOCK_TOTAL_TAX}万円 の内訳（令和8年度一般会計予算ベース）
        </Text>

        {taxUsageData.map((item) => (
          <HorizontalBar
            key={item.label}
            label={item.label}
            value={item.amount}
            maxValue={taxUsageData[0].amount}
            color={
              item.label === "社会保障" ? "#2ECC71" :
              item.label === "国債費" ? "#E05252" :
              item.label === "地方交付税" ? "#1A6FD4" :
              "#F5A623"
            }
            unit="円"
          />
        ))}

        <View style={styles.insightBox}>
          <Text style={styles.insightIcon}>🏥</Text>
          <Text style={styles.insightText}>
            税金の約{" "}
            <Text style={styles.insightHighlight}>33.5%</Text>
            {" "}が社会保障（医療・年金・介護）に使われています。
            あなたの税金から約{" "}
            <Text style={styles.insightHighlight}>
              {Math.round(MOCK_TOTAL_TAX * 0.335)}万円
            </Text>
            {" "}が社会保障費に充当されています。
          </Text>
        </View>
      </View>

      {/* 社会保険料の使い道 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>社会保険料の内訳</Text>
        <Text style={styles.cardSubtitle}>
          年間社会保険料 {MOCK_SOCIAL_INSURANCE}万円 の内訳
        </Text>
        {[
          { label: "厚生年金保険料", amount: Math.round(MOCK_SOCIAL_INSURANCE * 0.62), color: "#1A6FD4" },
          { label: "健康保険料", amount: Math.round(MOCK_SOCIAL_INSURANCE * 0.28), color: "#2ECC71" },
          { label: "介護保険料", amount: Math.round(MOCK_SOCIAL_INSURANCE * 0.05), color: "#F5A623" },
          { label: "雇用保険料", amount: Math.round(MOCK_SOCIAL_INSURANCE * 0.03), color: "#E05252" },
          { label: "子ども・子育て支援金", amount: Math.round(MOCK_SOCIAL_INSURANCE * 0.02), color: "#9B59B6" },
        ].map((item) => (
          <HorizontalBar
            key={item.label}
            label={item.label}
            value={item.amount * 10_000}
            maxValue={Math.round(MOCK_SOCIAL_INSURANCE * 0.62) * 10_000}
            color={item.color}
            unit="万円"
          />
        ))}
      </View>
    </View>
  );

  // ④ 税務カレンダー
  const renderCalendarTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>税務カレンダー 2026年</Text>
        <Text style={styles.cardSubtitle}>確定申告・住民税・年末調整などの年間スケジュール</Text>

        {TAX_CALENDAR.map((item) => {
          const isCurrentMonth = item.month === currentMonth;
          const isPastMonth = item.month < currentMonth;
          return (
            <View
              key={item.month}
              style={[
                styles.calendarItem,
                isCurrentMonth && styles.calendarItemCurrent,
                isPastMonth && styles.calendarItemPast,
              ]}
            >
              <View style={[styles.calendarMonthBadge, isCurrentMonth && styles.calendarMonthBadgeCurrent]}>
                <Text style={[styles.calendarMonth, isCurrentMonth && styles.calendarMonthCurrent]}>
                  {item.label}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                {item.events.map((event, i) => (
                  <View key={i} style={styles.calendarEventRow}>
                    <View style={[styles.calendarDot, isCurrentMonth && styles.calendarDotCurrent]} />
                    <Text style={[styles.calendarEvent, isPastMonth && styles.calendarEventPast]}>
                      {event}
                    </Text>
                    {isCurrentMonth && (
                      <View style={styles.calendarNowBadge}>
                        <Text style={styles.calendarNowBadgeText}>今月</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* 通知設定 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>リマインダー設定</Text>
        <Text style={styles.cardSubtitle}>重要な税務イベントの通知を受け取る</Text>
        {[
          { label: "確定申告期限（3/17）", enabled: true },
          { label: "住民税決定通知（5月）", enabled: true },
          { label: "年末調整書類提出（11月）", enabled: false },
        ].map((item) => (
          <View key={item.label} style={styles.notificationRow}>
            <Text style={styles.notificationLabel}>{item.label}</Text>
            <View style={[styles.notificationToggle, item.enabled && styles.notificationToggleOn]}>
              <Text style={styles.notificationToggleText}>{item.enabled ? "ON" : "OFF"}</Text>
            </View>
          </View>
        ))}
        <View style={styles.premiumNotice}>
          <Text style={styles.premiumNoticeText}>
            🔒 通知設定は有料版でご利用いただけます
          </Text>
        </View>
      </View>
    </View>
  );

  // ⑤ 節税提案
  const renderTaxSavingTab = () => (
    <View>
      {/* 節税サマリー */}
      <View style={[styles.card, styles.savingsSummaryCard]}>
        <Text style={styles.savingsSummaryTitle}>節税ポテンシャル</Text>
        <Text style={styles.savingsSummaryAmount}>
          最大 {idecoAnnualSavings + furusatoSavings}万円/年
        </Text>
        <Text style={styles.savingsSummarySubtext}>iDeCo + ふるさと納税の合計節税効果</Text>
      </View>

      {/* iDeCo提案 */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>iDeCo（個人型確定拠出年金）</Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>節税 約{idecoAnnualSavings}万円/年</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          掛金が全額所得控除。老後資産形成と節税を同時に実現。
        </Text>

        <View style={styles.idecoGrid}>
          <View style={styles.idecoItem}>
            <Text style={styles.idecoItemLabel}>現在の掛金</Text>
            <Text style={styles.idecoItemValue}>0円/月</Text>
          </View>
          <View style={styles.idecoItemArrow}>
            <Text style={styles.idecoArrow}>→</Text>
          </View>
          <View style={[styles.idecoItem, styles.idecoItemOptimal]}>
            <Text style={styles.idecoItemLabel}>推奨掛金</Text>
            <Text style={[styles.idecoItemValue, { color: "#1A6FD4" }]}>
              {idecoMax.toLocaleString()}円/月
            </Text>
          </View>
        </View>

        <View style={styles.idecoDetail}>
          <View style={styles.idecoDetailRow}>
            <Text style={styles.idecoDetailLabel}>年間掛金</Text>
            <Text style={styles.idecoDetailValue}>{(idecoMax * 12).toLocaleString()}円</Text>
          </View>
          <View style={styles.idecoDetailRow}>
            <Text style={styles.idecoDetailLabel}>所得税節税効果（概算）</Text>
            <Text style={[styles.idecoDetailValue, { color: "#2ECC71" }]}>
              約{Math.round(idecoMax * 12 * 0.10 / 10_000)}万円/年
            </Text>
          </View>
          <View style={styles.idecoDetailRow}>
            <Text style={styles.idecoDetailLabel}>住民税節税効果（概算）</Text>
            <Text style={[styles.idecoDetailValue, { color: "#2ECC71" }]}>
              約{Math.round(idecoMax * 12 * 0.10 / 10_000)}万円/年
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>iDeCoの詳細計算を見る</Text>
        </TouchableOpacity>
      </View>

      {/* ふるさと納税提案 */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>ふるさと納税</Text>
          <View style={[styles.savingsBadge, { backgroundColor: "#E8F8EF" }]}>
            <Text style={[styles.savingsBadgeText, { color: "#0FA86E" }]}>
              節税 約{furusatoSavings}万円/年
            </Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          2,000円の自己負担で返礼品を受け取りながら住民税を節税。
        </Text>

        <View style={styles.furusatoBox}>
          <Text style={styles.furusatoLabel}>あなたの寄附上限額（目安）</Text>
          <Text style={styles.furusatoAmount}>
            {Math.round(furusatoOptimal / 10_000).toLocaleString()}万円
          </Text>
          <Text style={styles.furusatoNote}>
            ※ ワンストップ特例利用の場合。実際の上限は所得・控除により異なります。
          </Text>
        </View>

        <View style={styles.furusatoSteps}>
          {[
            { step: "1", text: "上限額を確認する" },
            { step: "2", text: "返礼品を選んで寄附する" },
            { step: "3", text: "ワンストップ特例申請書を提出" },
            { step: "4", text: "翌年6月から住民税が控除される" },
          ].map((item) => (
            <View key={item.step} style={styles.furusatoStep}>
              <View style={styles.furusatoStepBadge}>
                <Text style={styles.furusatoStepNum}>{item.step}</Text>
              </View>
              <Text style={styles.furusatoStepText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#0FA86E" }]}>
          <Text style={styles.actionBtnText}>ふるさと納税の最適額を計算</Text>
        </TouchableOpacity>
      </View>

      {/* その他の節税手段 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>その他の節税手段</Text>
        {[
          {
            icon: "🏠",
            title: "住宅ローン控除",
            desc: "年末残高の0.7%を所得税から直接控除（上限35万円）",
            savings: "最大35万円/年",
          },
          {
            icon: "🏥",
            title: "医療費控除",
            desc: "年間医療費が10万円を超えた場合に超過分を控除",
            savings: "超過分の20〜45%",
          },
          {
            icon: "🛡️",
            title: "生命保険料控除",
            desc: "生命・介護医療・個人年金保険料を最大12万円控除",
            savings: "最大12万円控除",
          },
        ].map((item) => (
          <View key={item.title} style={styles.otherSavingItem}>
            <Text style={styles.otherSavingIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.otherSavingTitleRow}>
                <Text style={styles.otherSavingTitle}>{item.title}</Text>
                <Text style={styles.otherSavingAmount}>{item.savings}</Text>
              </View>
              <Text style={styles.otherSavingDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* レポート出力 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>分析レポートの出力</Text>
        <Text style={styles.cardSubtitle}>
          節税提案・将来予測・収入内訳をPDFでまとめてダウンロード
        </Text>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#5E7491" }]}>
          <Text style={styles.actionBtnText}>📄 PDFレポートを生成する</Text>
        </TouchableOpacity>
        <View style={styles.premiumNotice}>
          <Text style={styles.premiumNoticeText}>
            🔒 レポート出力は有料版でご利用いただけます
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>分析</Text>
          <Text style={styles.headerSubtitle}>詳細な収入分析と節税アドバイス</Text>
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumBannerText}>🔒 有料版専用機能</Text>
          </View>
        </View>

        {/* サブタブナビゲーション */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabScrollContent}
        >
          {[
            { id: "comparison" as AnalysisTab, label: "比較" },
            { id: "future" as AnalysisTab, label: "将来予測" },
            { id: "taxUsage" as AnalysisTab, label: "税の使い道" },
            { id: "calendar" as AnalysisTab, label: "税務カレンダー" },
            { id: "taxSaving" as AnalysisTab, label: "節税提案" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTab, activeTab === tab.id && styles.subTabActive]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setActiveTab(tab.id);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.subTabText, activeTab === tab.id && styles.subTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* タブコンテンツ */}
        {renderTabContent()}
      </ScrollView>
    </ScreenContainer>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    scrollContent: {
      padding: 20,
      paddingBottom: 48,
    },
    header: {
      marginBottom: 16,
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
      marginBottom: 10,
    },
    premiumBanner: {
      backgroundColor: "#FFF3CD",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: "#F5A623",
    },
    premiumBannerText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#8B5E00",
    },
    // サブタブ
    tabScrollView: {
      marginBottom: 16,
      marginHorizontal: -20,
    },
    tabScrollContent: {
      paddingHorizontal: 20,
      gap: 8,
    },
    subTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    subTabText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.muted,
    },
    subTabTextActive: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    // サブトグル（比較グラフ内）
    subToggle: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: 12,
    },
    subToggleBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 8,
    },
    subToggleBtnActive: {
      backgroundColor: colors.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    subToggleBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.muted,
    },
    subToggleBtnTextActive: {
      color: colors.foreground,
      fontWeight: "600",
    },
    // カード
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 4,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
      flexWrap: "wrap",
      gap: 8,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 16,
      lineHeight: 18,
    },
    chartContainer: {
      alignItems: "center",
      marginBottom: 12,
    },
    // インサイトボックス
    insightBox: {
      flexDirection: "row",
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      gap: 8,
      marginTop: 8,
    },
    insightIcon: {
      fontSize: 18,
    },
    insightText: {
      flex: 1,
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 20,
    },
    insightHighlight: {
      fontWeight: "700",
      color: colors.primary,
    },
    // 凡例
    legendRow: {
      gap: 8,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.foreground,
    },
    legendValue: {
      fontSize: 13,
      fontWeight: "700",
    },
    // シミュレーショングリッド
    simulationGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 12,
    },
    simulationCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    simulationLabel: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 6,
    },
    simulationAmount: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.primary,
    },
    simulationUnit: {
      fontSize: 13,
      fontWeight: "500",
    },
    noticeText: {
      fontSize: 11,
      color: colors.muted,
      lineHeight: 16,
    },
    // カレンダー
    calendarItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    calendarItemCurrent: {
      backgroundColor: "#EBF4FF",
      marginHorizontal: -18,
      paddingHorizontal: 18,
      borderRadius: 8,
      borderBottomWidth: 0,
      marginBottom: 4,
    },
    calendarItemPast: {
      opacity: 0.5,
    },
    calendarMonthBadge: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    calendarMonthBadgeCurrent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    calendarMonth: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.muted,
    },
    calendarMonthCurrent: {
      color: "#FFFFFF",
    },
    calendarEventRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    calendarDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.muted,
    },
    calendarDotCurrent: {
      backgroundColor: colors.primary,
    },
    calendarEvent: {
      fontSize: 13,
      color: colors.foreground,
      flex: 1,
    },
    calendarEventPast: {
      color: colors.muted,
    },
    calendarNowBadge: {
      backgroundColor: colors.primary,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    calendarNowBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    // 通知設定
    notificationRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationLabel: {
      fontSize: 14,
      color: colors.foreground,
      flex: 1,
    },
    notificationToggle: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.border,
    },
    notificationToggleOn: {
      backgroundColor: colors.primary,
    },
    notificationToggleText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    premiumNotice: {
      backgroundColor: "#FFF8EC",
      borderRadius: 8,
      padding: 10,
      marginTop: 12,
      borderWidth: 1,
      borderColor: "#F5A623",
    },
    premiumNoticeText: {
      fontSize: 12,
      color: "#8B5E00",
      textAlign: "center",
    },
    // 節税提案
    savingsSummaryCard: {
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    savingsSummaryTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.8)",
      marginBottom: 4,
    },
    savingsSummaryAmount: {
      fontSize: 32,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: -1,
    },
    savingsSummarySubtext: {
      fontSize: 12,
      color: "rgba(255,255,255,0.7)",
      marginTop: 4,
    },
    savingsBadge: {
      backgroundColor: "#EBF4FF",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    savingsBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    // iDeCo
    idecoGrid: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    idecoItem: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    idecoItemOptimal: {
      borderColor: colors.primary,
      backgroundColor: "#EBF4FF",
    },
    idecoItemArrow: {
      alignItems: "center",
    },
    idecoArrow: {
      fontSize: 20,
      color: colors.muted,
    },
    idecoItemLabel: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 4,
    },
    idecoItemValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    idecoDetail: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      gap: 8,
    },
    idecoDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    idecoDetailLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    idecoDetailValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    // ふるさと納税
    furusatoBox: {
      backgroundColor: "#E8F8EF",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#0FA86E",
    },
    furusatoLabel: {
      fontSize: 12,
      color: "#0FA86E",
      fontWeight: "600",
      marginBottom: 4,
    },
    furusatoAmount: {
      fontSize: 32,
      fontWeight: "800",
      color: "#0FA86E",
      letterSpacing: -1,
    },
    furusatoNote: {
      fontSize: 11,
      color: "#5E7491",
      marginTop: 6,
      textAlign: "center",
      lineHeight: 16,
    },
    furusatoSteps: {
      gap: 10,
      marginBottom: 14,
    },
    furusatoStep: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    furusatoStepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#0FA86E",
      alignItems: "center",
      justifyContent: "center",
    },
    furusatoStepNum: {
      fontSize: 12,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    furusatoStepText: {
      fontSize: 13,
      color: colors.foreground,
    },
    // その他節税
    otherSavingItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    otherSavingIcon: {
      fontSize: 22,
    },
    otherSavingTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    otherSavingTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
    otherSavingAmount: {
      fontSize: 12,
      fontWeight: "600",
      color: "#2ECC71",
    },
    otherSavingDesc: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
    },
    // アクションボタン
    actionBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
}
