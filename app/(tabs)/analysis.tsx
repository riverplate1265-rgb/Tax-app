import { useState, useEffect, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Modal,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { DonutChart } from "@/components/DonutChart";
import { BarChart, HorizontalBar, LineChart } from "@/components/BarChart";
import { useColors } from "@/hooks/use-colors";
import { useCalculationResult } from "@/hooks/use-calculation-result";
import {
  simulateFutureIncome,
  calcTaxUsage,
  calcFurusatoOptimal,
  calcIdecoMax,
} from "@/lib/taxCalculatorDetailed";
import {
  loadAllAnnualData,
  loadPremium,
  getPremiumSync,
  subscribeToProfileStore,
  type AnnualDataMap,
} from "@/store/profileStore";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 64;

// 税務カレンダーデータ
const TAX_CALENDAR = [
  { month: 2, label: "2月", events: ["確定申告受付開始（2/17～）"] },
  { month: 3, label: "3月", events: ["確定申告期限（3/17）", "協会けんぽ保険料率改定"] },
  { month: 4, label: "4月", events: ["子ども・子育て支援金 徴収開始", "雇用保険料率改定"] },
  { month: 5, label: "5月", events: ["住民税決定通知書"] },
  { month: 6, label: "6月", events: ["住民税の新年度徴収開始"] },
  { month: 9, label: "9月", events: ["社会保険料の定時決定"] },
  { month: 10, label: "10月", events: ["社会保険料の106万円の壁撤廃", "厚生年金の上限引き上げ"] },
  { month: 11, label: "11月", events: ["年末調整書類提出"] },
  { month: 12, label: "12月", events: ["年末調整", "ふるさと納税の期限（12/31）"] },
];

// 働き方の壁データ（2026年）
const WORK_WALLS = [
  {
    income: "約100万円",
    wall: "住民税①",
    content: "住民税均等割 発生",
    highlight: "住民税均等割",
    color: "#F5A623",
    icon: "🏛️",
  },
  {
    income: "約110万円",
    wall: "住民税②",
    content: "住民税所得割 発生",
    highlight: "住民税所得割",
    color: "#F5A623",
    icon: "🏛️",
  },
  {
    income: "106万円",
    wall: "社会保険①",
    content: "大企業パートで 健康保険・厚生年金 加入",
    highlight: "健康保険・厚生年金",
    color: "#E05252",
    icon: "🏥",
  },
  {
    income: "123万円",
    wall: "配偶者控除",
    content: "配偶者控除 満額ライン",
    highlight: "配偶者控除",
    color: "#1A6FD4",
    icon: "👫",
  },
  {
    income: "130万円",
    wall: "社会保険②",
    content: "配偶者の社会保険扶養から外れる",
    highlight: null,
    color: "#E05252",
    icon: "🏥",
  },
  {
    income: "150万円",
    wall: "配偶者特別控除",
    content: "配偶者特別控除 満額ライン",
    highlight: "配偶者特別控除",
    color: "#1A6FD4",
    icon: "👫",
  },
  {
    income: "約178万円",
    wall: "所得税",
    content: "所得税 課税開始",
    highlight: "所得税",
    color: "#E05252",
    icon: "📋",
  },
  {
    income: "約201万円",
    wall: "配偶者特別控除",
    content: "控除終了",
    highlight: null,
    color: "#1A6FD4",
    icon: "👫",
  },
];

// リマインダー設定の型
type ReminderTiming = "1week" | "3days";
interface ReminderSetting {
  label: string;
  enabled: boolean;
  timing: ReminderTiming;
}

type AnalysisTab = "takeHome" | "comparison" | "workWall" | "taxUsage" | "future" | "calendar" | "taxSaving" | "pdf";

export default function AnalysisScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<AnalysisTab>("takeHome");
  const { result, input, isLoaded, hasData } = useCalculationResult();

  // プレミアムフラグ
  const [isPremium, setIsPremium] = useState(() => getPremiumSync());
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  useEffect(() => {
    loadPremium().then((v) => setIsPremium(v));
    return subscribeToProfileStore(() => setIsPremium(getPremiumSync()));
  }, []);

  const handlePremiumPurchase = async () => {
    const { savePremium } = await import("@/store/profileStore");
    await savePremium(true);
    setIsPremium(true);
    setShowPremiumModal(false);
  };

  // 年次データ
  const [annualDataMap, setAnnualDataMap] = useState<AnnualDataMap>({});
  useEffect(() => {
    loadAllAnnualData().then((data) => setAnnualDataMap(data));
    return subscribeToProfileStore(() => {
      loadAllAnnualData().then((data) => setAnnualDataMap(data));
    });
  }, []);

  // リマインダー設定（時系列順）
  const [reminders, setReminders] = useState<ReminderSetting[]>([
    { label: "確定申告受付開始（2/17～）", enabled: false, timing: "3days" },
    { label: "確定申告期限（3/17）", enabled: true, timing: "1week" },
    { label: "年末調整書類提出（11月）", enabled: false, timing: "1week" },
    { label: "ふるさと納税の期限（12/31）", enabled: false, timing: "1week" },
  ]);
  const toggleReminder = (idx: number) => {
    setReminders((prev) => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  };
  const setReminderTiming = (idx: number, timing: ReminderTiming) => {
    setReminders((prev) => prev.map((r, i) => i === idx ? { ...r, timing } : r));
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // 実データから値を取得
  const annualIncomeMan = input ? Math.round(input.annualIncome) : 500;
  const age = input ? input.age : 35;
  const takeHomeMan = result ? Math.round(result.takeHome / 10_000) : 383;
  const totalTaxMan = result ? Math.round(result.totalTax / 10_000) : 27;
  const socialInsuranceMan = result ? Math.round(result.totalSocialInsurance / 10_000) : 90;
  const takeHomeRatio = result ? result.takeHomeRatio : Math.round((383 / 500) * 100);

  // 実質手取り計算（会社負担の社保を含む）
  const companyBurdenSocialInsurance = result ? (
    result.healthInsurance + result.nursingInsurance + result.kodomoKosodate + result.pensionInsurance
  ) : 0;
  const totalBurdenIncludingCompany = result ? (
    result.annualIncome + companyBurdenSocialInsurance
  ) : annualIncomeMan * 10_000;
  const realTakeHomeRatio = totalBurdenIncludingCompany > 0 ? Math.round(
    ((result ? result.takeHome : 0) / totalBurdenIncludingCompany) * 1000
  ) / 10 : 0;

  // 将来予測データ
  const futureData = useMemo(() => {
    const data = simulateFutureIncome(age, annualIncomeMan, 0.02, 65);
    return data.filter((_, i) => i % 5 === 0).map((d) => ({
      label: `${d.age}歳`,
      value: d.takeHome,
      color: d.age === age ? "#1A6FD4" : "#A8C4E8",
    }));
  }, [age, annualIncomeMan]);

  // 税の使い道データ
  const taxUsageData = useMemo(() => {
    const totalTax = totalTaxMan * 10_000;
    return calcTaxUsage(totalTax);
  }, [totalTaxMan]);

  // 節税提案データ
  const idecoMax = calcIdecoMax("会社員（企業年金なし）");
  const currentIdecoMonthly = input?.idecoMonthly ?? 0;
  const simpleFurusatoOptimal = calcFurusatoOptimal(
    annualIncomeMan * 10_000,
    input?.hasSpouseDeduction ?? false,
    (input?.childrenUnder19 ?? 0) + (input?.childrenUnder23 ?? 0)
  );
  const [furusatoOptimal, setFurusatoOptimal] = useState<number>(simpleFurusatoOptimal);
  const [furusatoCalcMode, setFurusatoCalcMode] = useState<"simple" | "precise">("simple");

  useEffect(() => {
    setFurusatoOptimal(simpleFurusatoOptimal);
    setFurusatoCalcMode("simple");
  }, [annualIncomeMan, input?.hasSpouseDeduction, input?.childrenUnder19, input?.childrenUnder23]);

  const handleCalcPreciseFurusato = () => {
    if (!result) return;
    const shotokuWari = Math.max(0, result.residentTax - 5_000);
    const effectiveTaxRate = result.annualIncome > 0
      ? (result.incomeTax / result.annualIncome)
      : 0.10;
    const combinedRate = effectiveTaxRate + 0.10;
    const denominator = 1 - combinedRate;
    const preciseLimit = denominator > 0
      ? Math.round(shotokuWari * 0.20 / denominator) + 2_000
      : Math.round(shotokuWari * 0.20 / 0.80) + 2_000;
    setFurusatoOptimal(Math.max(preciseLimit, 2_000));
    setFurusatoCalcMode("precise");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const effectiveTaxRate = result && result.annualIncome > 0
    ? (result.incomeTax / result.annualIncome)
    : 0.10;
  const idecoRemainingMonthly = Math.max(0, idecoMax - currentIdecoMonthly);
  const idecoAnnualSavings = Math.round(idecoRemainingMonthly * 12 * (effectiveTaxRate + 0.10) / 10_000);
  const furusatoSavings = Math.round((furusatoOptimal - 2_000) / 10_000);

  // 来年の住民税予測（今年の所得から翌年住民税を推定）
  const nextYearResidentTax = result ? Math.round(result.residentTax / 10_000) : 0;

  const styles = createStyles(colors);

  // ---- タブコンテンツ ----

  const renderTakeHomeTab = () => (
    <View>
      {/* 収入内訳 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>収入内訳</Text>
        <Text style={styles.cardSubtitle}>年収 {annualIncomeMan}万円 の内訳</Text>
        <View style={styles.donutRow}>
          <DonutChart
            segments={[
              { value: takeHomeMan, color: "#2ECC71", label: "手取り" },
              { value: socialInsuranceMan, color: "#F5A623", label: "社保" },
              { value: totalTaxMan, color: "#E05252", label: "税金" },
            ]}
            size={150}
            strokeWidth={28}
            centerLabel={`${takeHomeRatio}%`}
            centerSubLabel="手取り"
          />
          <View style={styles.donutLegend}>
            {[
              { label: "手取り", value: takeHomeMan, color: "#2ECC71" },
              { label: "社会保険料", value: socialInsuranceMan, color: "#F5A623" },
              { label: "税金", value: totalTaxMan, color: "#E05252" },
            ].map((item) => (
              <View key={item.label} style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.donutLegendLabel}>{item.label}</Text>
                <Text style={[styles.donutLegendValue, { color: item.color }]}>{item.value}万円</Text>
              </View>
            ))}
            <View style={styles.donutLegendDivider} />
            <View style={styles.donutLegendItem}>
              <Text style={styles.donutLegendTotalLabel}>年収（額面）</Text>
              <Text style={styles.donutLegendTotalValue}>{annualIncomeMan}万円</Text>
            </View>
          </View>
        </View>
        <View style={styles.insightBox}>
          <Text style={styles.insightIcon}>💰</Text>
          <Text style={styles.insightText}>
            年収{annualIncomeMan}万円のうち、実際に受け取れる手取りは{" "}
            <Text style={styles.insightHighlight}>{takeHomeMan}万円（{takeHomeRatio}%）</Text>
            。残りの{annualIncomeMan - takeHomeMan}万円が税金・社会保険料として差し引かれています。
          </Text>
        </View>
      </View>

      {/* 実質手取り */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>実質手取り</Text>
        <Text style={styles.cardSubtitle}>
          会社負担の社保を含めた実質的な手取り割合{"\n"}実質手取り = 手取り ÷ (収入 + 社保会社負担分)
        </Text>
        <View style={styles.realBurdenRow}>
          <View style={styles.realBurdenChartWrap}>
            <DonutChart
              segments={[
                { value: takeHomeMan, color: "#2ECC71", label: "手取り" },
                { value: socialInsuranceMan, color: "#F5A623", label: "社保(自己負担)" },
                { value: result ? Math.round(companyBurdenSocialInsurance / 10_000) : 0, color: "#FF9800", label: "社保(会社負担)" },
                { value: totalTaxMan, color: "#E05252", label: "税金" },
              ]}
              size={140}
              strokeWidth={26}
              centerLabel={`${realTakeHomeRatio}%`}
              centerSubLabel="実質手取り"
            />
          </View>
          <View style={styles.realBurdenLegend}>
            {[
              { label: "手取り", value: takeHomeMan, color: "#2ECC71" },
              { label: "社保(自己負担)", value: socialInsuranceMan, color: "#F5A623" },
              { label: "社保(会社負担)", value: result ? Math.round(companyBurdenSocialInsurance / 10_000) : 0, color: "#FF9800" },
              { label: "税金", value: totalTaxMan, color: "#E05252" },
            ].map((item) => (
              <View key={item.label} style={styles.realBurdenLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.realBurdenLegendLabel}>{item.label}</Text>
                <Text style={[styles.realBurdenLegendValue, { color: item.color }]}>{item.value}万円</Text>
              </View>
            ))}
            <View style={styles.realBurdenDivider} />
            <View style={styles.realBurdenLegendItem}>
              <Text style={styles.realBurdenTotalLabel}>実質手取り</Text>
              <Text style={[styles.realBurdenTotalValue, { color: "#2ECC71" }]}>{realTakeHomeRatio}%</Text>
            </View>
          </View>
        </View>
        <View style={styles.insightBox}>
          <Text style={styles.insightIcon}>📊</Text>
          <Text style={styles.insightText}>
            会社負担の社保を含めると、実質的な手取り率は{" "}
            <Text style={[styles.insightHighlight, { color: "#2ECC71" }]}>{realTakeHomeRatio}%</Text>
            {" "}になります。表面上の手取り率{takeHomeRatio}%よりも会社負担分を加味すると実質の手取り割合は低くなります。
          </Text>
        </View>
      </View>
    </View>
  );

  const renderComparisonTab = () => {
    const sortedYears = Object.keys(annualDataMap).map(Number).sort((a, b) => a - b);
    const hasTrend = sortedYears.length >= 2;
    const trendData = hasTrend ? sortedYears.map((year) => ({
      label: `${year}`,
      value: parseFloat(annualDataMap[year]?.annualIncome ?? "0"),
    })) : [];
    // 手取り推移データ（annualDataMapから手取りを推定: 年収の約76%）
    const takeHomeTrendData = hasTrend ? sortedYears.map((year) => ({
      label: `${year}`,
      value: Math.round(parseFloat(annualDataMap[year]?.annualIncome ?? "0") * 0.76),
    })) : [];

    const latestIncome = trendData[trendData.length - 1]?.value ?? 0;
    const firstIncome = trendData[0]?.value ?? 0;
    const incomeDiff = latestIncome - firstIncome;

    const latestTakeHome = takeHomeTrendData[takeHomeTrendData.length - 1]?.value ?? 0;
    const firstTakeHome = takeHomeTrendData[0]?.value ?? 0;
    const takeHomeDiff = latestTakeHome - firstTakeHome;

    return (
      <View>
        {hasTrend ? (
          <>
            {/* 額面の推移 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>額面（年収）の推移</Text>
              <Text style={styles.cardSubtitle}>年次データから生成</Text>
              <View style={styles.chartContainer}>
                <LineChart
                  data={trendData}
                  width={CHART_WIDTH}
                  height={160}
                  lineColor="#1A6FD4"
                  dotColor="#1A6FD4"
                  unit="万"
                />
              </View>
              <View style={styles.trendInsightRow}>
                <View style={styles.trendInsightItem}>
                  <Text style={styles.trendInsightLabel}>{sortedYears[0]}年比</Text>
                  <Text style={[styles.trendInsightValue, { color: incomeDiff >= 0 ? "#2ECC71" : "#E05252" }]}>
                    {incomeDiff >= 0 ? "+" : ""}{incomeDiff}万円
                  </Text>
                </View>
                <View style={styles.trendInsightItem}>
                  <Text style={styles.trendInsightLabel}>最新年収</Text>
                  <Text style={[styles.trendInsightValue, { color: "#1A6FD4" }]}>{latestIncome}万円</Text>
                </View>
              </View>
            </View>

            {/* 手取りの推移 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>手取りの推移</Text>
              <Text style={styles.cardSubtitle}>年収から推定（年収の約76%）</Text>
              <View style={styles.chartContainer}>
                <LineChart
                  data={takeHomeTrendData}
                  width={CHART_WIDTH}
                  height={160}
                  lineColor="#2ECC71"
                  dotColor="#2ECC71"
                  unit="万"
                />
              </View>
              <View style={styles.trendInsightRow}>
                <View style={styles.trendInsightItem}>
                  <Text style={styles.trendInsightLabel}>{sortedYears[0]}年比</Text>
                  <Text style={[styles.trendInsightValue, { color: takeHomeDiff >= 0 ? "#2ECC71" : "#E05252" }]}>
                    {takeHomeDiff >= 0 ? "+" : ""}{takeHomeDiff}万円
                  </Text>
                </View>
                <View style={styles.trendInsightItem}>
                  <Text style={styles.trendInsightLabel}>最新手取り</Text>
                  <Text style={[styles.trendInsightValue, { color: "#2ECC71" }]}>{latestTakeHome}万円</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>推移グラフ</Text>
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateIcon}>📈</Text>
              <Text style={styles.emptyStateTitle}>年次データが2年分以上あると表示されます</Text>
              <Text style={styles.emptyStateText}>
                設定タブの「年次設定」に2年分以上の年収データを入力すると、額面・手取りの推移グラフが表示されます。
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderWorkWallTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>2026年 働き方の壁（完全整理）</Text>
        <Text style={styles.cardSubtitle}>
          収入が一定額を超えると発生する税・社会保険の負担増ポイント
        </Text>
        {WORK_WALLS.map((wall, idx) => (
          <View key={idx} style={[styles.wallItem, idx < WORK_WALLS.length - 1 && styles.wallItemBorder]}>
            <View style={[styles.wallIconBadge, { backgroundColor: wall.color + "20" }]}>
              <Text style={styles.wallIcon}>{wall.icon}</Text>
            </View>
            <View style={styles.wallContent}>
              <View style={styles.wallHeaderRow}>
                <Text style={[styles.wallIncome, { color: wall.color }]}>{wall.income}</Text>
                <View style={[styles.wallBadge, { backgroundColor: wall.color + "20" }]}>
                  <Text style={[styles.wallBadgeText, { color: wall.color }]}>{wall.wall}</Text>
                </View>
              </View>
              <Text style={styles.wallDescription}>
                {wall.highlight ? (
                  <>
                    {wall.content.split(wall.highlight)[0]}
                    <Text style={[styles.wallHighlight, { color: wall.color }]}>{wall.highlight}</Text>
                    {wall.content.split(wall.highlight)[1]}
                  </>
                ) : (
                  wall.content
                )}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.insightBox}>
          <Text style={styles.insightIcon}>💡</Text>
          <Text style={styles.insightText}>
            2026年10月から社会保険の106万円の壁が撤廃されます。週20時間以上・月8.8万円以上の場合、企業規模に関わらず社会保険に加入が必要になります。
          </Text>
        </View>
      </View>

      {/* 自分の年収との対比 */}
      {hasData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>あなたの年収と壁の関係</Text>
          <Text style={styles.cardSubtitle}>現在の年収 {annualIncomeMan}万円 との比較</Text>
          {WORK_WALLS.map((wall, idx) => {
            const wallValue = parseInt(wall.income.replace(/[^0-9]/g, ""));
            const userIncome = annualIncomeMan * 10_000 / 10_000;
            const isPassed = userIncome >= wallValue;
            return (
              <View key={idx} style={styles.wallCheckRow}>
                <View style={[styles.wallCheckDot, { backgroundColor: isPassed ? "#2ECC71" : colors.border }]} />
                <Text style={[styles.wallCheckLabel, { color: isPassed ? colors.foreground : colors.muted }]}>
                  {wall.income} {wall.wall}
                </Text>
                <Text style={[styles.wallCheckStatus, { color: isPassed ? "#2ECC71" : colors.muted }]}>
                  {isPassed ? "超過" : "未達"}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderTaxUsageTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>あなたの税金の使い道</Text>
        <Text style={styles.cardSubtitle}>
          今年の推定納税額 {totalTaxMan}万円 の内訳（令和8年度一般会計予算ベース）
        </Text>
        {taxUsageData.map((item) => (
          <HorizontalBar
            key={item.label}
            label={`${item.label}（${item.ratio}%）`}
            value={item.amount}
            maxValue={taxUsageData[0].amount}
            color={
              item.label === "社会保障" ? "#2ECC71" :
              item.label === "国債費" ? "#E05252" :
              item.label === "地方交付税" ? "#1A6FD4" :
              "#F5A623"
            }
            unit="万円"
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
              {Math.round(totalTaxMan * 0.335)}万円
            </Text>
            {" "}が社会保障費に充当されています。
          </Text>
        </View>
      </View>
    </View>
  );

  const renderFutureTab = () => {
    const futureTotal = futureData.reduce((sum, d) => sum + d.value * 5, 0);
    const lastFuture = futureData[futureData.length - 1]?.value ?? 0;
    const yearlyInvest = takeHomeMan * 0.4;
    const simulate = (years: number) => {
      let total = 0;
      for (let i = 0; i < years; i++) {
        total = (total + yearlyInvest) * 1.03;
      }
      return Math.round(total);
    };

    return (
      <View>
        {/* 来年の住民税予測 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>来年の住民税予測</Text>
          <Text style={styles.cardSubtitle}>
            {currentYear}年の所得から推定される{currentYear + 1}年度の住民税
          </Text>
          {result ? (
            <>
              <View style={styles.residentTaxBox}>
                <Text style={styles.residentTaxLabel}>推定住民税（{currentYear + 1}年6月〜）</Text>
                <Text style={styles.residentTaxAmount}>{nextYearResidentTax}万円</Text>
                <Text style={styles.residentTaxNote}>
                  月額 約{Math.round(nextYearResidentTax / 12 * 10) / 10}万円（{currentYear + 1}年6月〜{currentYear + 2}年5月）
                </Text>
              </View>
              <View style={styles.residentTaxBreakdown}>
                <View style={styles.residentTaxRow}>
                  <Text style={styles.residentTaxRowLabel}>所得割（所得 × 10%）</Text>
                  <Text style={styles.residentTaxRowValue}>
                    {Math.round(Math.max(0, result.residentTax - 5_000) / 10_000)}万円
                  </Text>
                </View>
                <View style={styles.residentTaxRow}>
                  <Text style={styles.residentTaxRowLabel}>均等割</Text>
                  <Text style={styles.residentTaxRowValue}>5,000円</Text>
                </View>
              </View>
              <View style={styles.insightBox}>
                <Text style={styles.insightIcon}>📅</Text>
                <Text style={styles.insightText}>
                  住民税は前年の所得に基づいて翌年6月から徴収されます。今年の年収{annualIncomeMan}万円から、来年6月以降の住民税は月約{Math.round(nextYearResidentTax / 12 * 10) / 10}万円になる見込みです。
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateIcon}>🏛️</Text>
              <Text style={styles.emptyStateText}>計算タブで手取り計算を行うと、住民税予測が表示されます。</Text>
            </View>
          )}
        </View>

        {/* 65歳までの手取り予測 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>65歳までの手取り予測</Text>
          <Text style={styles.cardSubtitle}>
            現在の年収 {annualIncomeMan}万円・年収上昇率2%・現状の控除条件を維持した場合
          </Text>
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
              <Text style={styles.insightHighlight}>{lastFuture}万円</Text>
              。{age}歳から65歳までの累計手取りは約{" "}
              <Text style={styles.insightHighlight}>
                {futureTotal.toLocaleString()}万円
              </Text>
              （概算）です。
            </Text>
          </View>
        </View>

        {/* 資産推移シミュレーション */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>資産推移シミュレーション</Text>
          <Text style={styles.cardSubtitle}>
            手取り {takeHomeMan}万円 の40%（{Math.round(yearlyInvest)}万円/年）を積立投資（年利3%想定）
          </Text>
          <View style={styles.simulationGrid}>
            {[
              { label: `5年後（${age + 5}歳）`, years: 5 },
              { label: `10年後（${age + 10}歳）`, years: 10 },
              { label: `20年後（${age + 20}歳）`, years: 20 },
              { label: `30年後（${age + 30}歳）`, years: 30 },
            ].map((item) => (
              <View key={item.label} style={styles.simulationCard}>
                <Text style={styles.simulationLabel}>{item.label}</Text>
                <Text style={styles.simulationAmount}>
                  {simulate(item.years).toLocaleString()}
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
  };

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>リマインダー設定</Text>
        <Text style={styles.cardSubtitle}>重要な税務イベントの通知を受け取る</Text>
        {reminders.map((item, idx) => (
          <View key={item.label} style={styles.notificationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationLabel}>{item.label}</Text>
              {item.enabled && (
                <View style={styles.timingRow}>
                  {(["1week", "3days"] as ReminderTiming[]).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.timingBtn,
                        item.timing === t && styles.timingBtnActive,
                        !isPremium && { opacity: 0.4 },
                      ]}
                      onPress={() => isPremium && setReminderTiming(idx, t)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.timingBtnText,
                        item.timing === t && styles.timingBtnTextActive,
                      ]}>{t === "1week" ? "1週間前" : "3日前"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Switch
              value={item.enabled}
              onValueChange={() => {
                if (!isPremium) return;
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleReminder(idx);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
              disabled={!isPremium}
            />
          </View>
        ))}
        {!isPremium && (
          <View style={styles.premiumNotice}>
            <Text style={styles.premiumNoticeText}>
              🔒 通知設定は有料版でご利用いただけます
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderTaxSavingTab = () => (
    <View>
      <View style={[styles.card, styles.savingsSummaryCard]}>
        <Text style={styles.savingsSummaryTitle}>節税ポテンシャル</Text>
        <Text style={styles.savingsSummaryAmount}>
          最大 {Math.max(0, idecoAnnualSavings + furusatoSavings)}万円/年
        </Text>
        <Text style={styles.savingsSummarySubtext}>
          iDeCo（追加分）+ ふるさと納税の合計節税効果
        </Text>
      </View>

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
            <Text style={styles.idecoItemValue}>
              {currentIdecoMonthly > 0 ? `${currentIdecoMonthly.toLocaleString()}円/月` : "0円/月"}
            </Text>
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
            <Text style={styles.idecoDetailLabel}>年間掛金（上限）</Text>
            <Text style={styles.idecoDetailValue}>{(idecoMax * 12).toLocaleString()}円</Text>
          </View>
          <View style={styles.idecoDetailRow}>
            <Text style={styles.idecoDetailLabel}>所得税節税効果（概算）</Text>
            <Text style={[styles.idecoDetailValue, { color: "#2ECC71" }]}>
              約{Math.round(idecoRemainingMonthly * 12 * effectiveTaxRate / 10_000)}万円/年
            </Text>
          </View>
          <View style={styles.idecoDetailRow}>
            <Text style={styles.idecoDetailLabel}>住民税節税効果（概算）</Text>
            <Text style={[styles.idecoDetailValue, { color: "#2ECC71" }]}>
              約{Math.round(idecoRemainingMonthly * 12 * 0.10 / 10_000)}万円/年
            </Text>
          </View>
        </View>
      </View>

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
          <Text style={styles.furusatoLabel}>
            {furusatoCalcMode === "precise" ? "あなたの寄附上限額（厳密計算）" : "あなたの寄附上限額（目安）"}
          </Text>
          <Text style={styles.furusatoAmount}>
            {Math.round(furusatoOptimal / 10_000).toLocaleString()}万円
          </Text>
          {furusatoCalcMode === "precise" ? (
            <Text style={[styles.furusatoNote, { color: "#0FA86E", fontWeight: "600" }]}>
              ✓ 住民税所得割・所得税率から逆算した厳密値。ワンストップ特例利用の場合。
            </Text>
          ) : (
            <Text style={styles.furusatoNote}>
              ※ 年収 {annualIncomeMan}万円 ベースの概算。「最適額を計算」で厳密値に更新できます。
            </Text>
          )}
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
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: furusatoCalcMode === "precise" ? "#888" : "#0FA86E" },
            !result && { opacity: 0.4 },
          ]}
          onPress={handleCalcPreciseFurusato}
          disabled={!result || furusatoCalcMode === "precise"}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>
            {furusatoCalcMode === "precise"
              ? "✓ 厳密値に更新済み"
              : result
                ? "📊 実データから最適額を計算"
                : "📊 計算タブで計算後に利用可能"}
          </Text>
        </TouchableOpacity>
      </View>

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
    </View>
  );

  const renderPdfTab = () => (
    <View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>分析レポートの出力</Text>
        <Text style={styles.cardSubtitle}>
          節税提案・将来予測・収入内訳をPDFでまとめてダウンロード
        </Text>
        <View style={styles.pdfFeatureList}>
          {[
            { icon: "💰", text: "収入内訳・実質手取り" },
            { icon: "📈", text: "手取り・額面の推移グラフ" },
            { icon: "🔮", text: "65歳までの将来予測" },
            { icon: "💡", text: "iDeCo・ふるさと納税の節税提案" },
            { icon: "🏛️", text: "税金の使い道" },
          ].map((item) => (
            <View key={item.text} style={styles.pdfFeatureItem}>
              <Text style={styles.pdfFeatureIcon}>{item.icon}</Text>
              <Text style={styles.pdfFeatureText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#5E7491", marginTop: 8 }]}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>📄 PDFレポートを生成する</Text>
        </TouchableOpacity>
        {!isPremium && (
          <View style={styles.premiumNotice}>
            <Text style={styles.premiumNoticeText}>
              🔒 レポート出力は有料版でご利用いただけます
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>出力形式</Text>
        {[
          { format: "PDF", desc: "印刷・保存に最適。A4縦形式で出力。", icon: "📄" },
          { format: "CSV", desc: "年次データをスプレッドシートで管理。", icon: "📊" },
        ].map((item) => (
          <View key={item.format} style={styles.pdfFormatItem}>
            <Text style={styles.pdfFormatIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfFormatName}>{item.format}</Text>
              <Text style={styles.pdfFormatDesc}>{item.desc}</Text>
            </View>
            <TouchableOpacity style={styles.pdfFormatBtn} activeOpacity={0.8}>
              <Text style={styles.pdfFormatBtnText}>出力</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "takeHome": return renderTakeHomeTab();
      case "comparison": return renderComparisonTab();
      case "workWall": return renderWorkWallTab();
      case "taxUsage": return renderTaxUsageTab();
      case "future": return renderFutureTab();
      case "calendar": return renderCalendarTab();
      case "taxSaving": return renderTaxSavingTab();
      case "pdf": return renderPdfTab();
      default: return null;
    }
  };

  // タブ定義（2行×4列）
  const TAB_ROWS: { id: AnalysisTab; label: string }[][] = [
    [
      { id: "takeHome", label: "手取り" },
      { id: "comparison", label: "比較" },
      { id: "workWall", label: "働き方の壁" },
      { id: "taxUsage", label: "税金使途" },
    ],
    [
      { id: "future", label: "予測" },
      { id: "calendar", label: "カレンダー" },
      { id: "taxSaving", label: "節税" },
      { id: "pdf", label: "PDF" },
    ],
  ];

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>分析</Text>
          {hasData ? (
            <Text style={styles.headerSubtitle}>
              年収 {annualIncomeMan.toLocaleString()}万円・{age}歳のデータを分析中
            </Text>
          ) : (
            <Text style={styles.headerSubtitle}>詳細な収入分析と節税アドバイス</Text>
          )}
          {!hasData && isLoaded && (
            <View style={styles.noDataBanner}>
              <Text style={styles.noDataBannerText}>
                💡 計算タブで手取り計算を行うと、実際のデータで分析できます
              </Text>
            </View>
          )}
          {!isLoaded && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          )}
        </View>

        {/* 2行タブナビゲーション */}
        <View style={styles.tabGrid}>
          {TAB_ROWS.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.tabRow}>
              {row.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.gridTab, activeTab === tab.id && styles.gridTabActive]}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setActiveTab(tab.id);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.gridTabText, activeTab === tab.id && styles.gridTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* タブコンテンツ（有料版ロック） */}
        {isPremium ? (
          renderTabContent()
        ) : (
          <TouchableOpacity
            style={styles.lockOverlay}
            onPress={() => setShowPremiumModal(true)}
            activeOpacity={0.9}
          >
            <View style={styles.lockOverlayInner}>
              <Text style={styles.lockOverlayIcon}>🔒</Text>
              <Text style={styles.lockOverlayTitle}>プレミアム会員限定</Text>
              <Text style={styles.lockOverlayText}>詳細な分析・比較・節税提案は{"\n"}有料版でご利用いただけます</Text>
              <View style={styles.lockOverlayBtn}>
                <Text style={styles.lockOverlayBtnText}>アップグレードする</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* プレミアムモーダル */}
      <Modal
        visible={showPremiumModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>プレミアムプラン</Text>
            <TouchableOpacity onPress={() => setShowPremiumModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={[styles.card, { alignItems: "center", marginBottom: 16 }]}>
              <Text style={{ fontSize: 32, marginBottom: 4 }}>✨</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>プレミアムプラン</Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary }}>&#165;500<Text style={{ fontSize: 14, fontWeight: "400", color: colors.muted }}>/年（税込）</Text></Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>月あたり約42円</Text>
            </View>
            {[
              { icon: "🎯", title: "詳細計算モード", desc: "iDeCo・ふるさと納税・住宅ローン控除を含む1円単位の精密計算" },
              { icon: "📊", title: "分析タブ全機能", desc: "手取り内訳・比較・働き方の壁・将来予測・税の使い道・税務カレンダー" },
              { icon: "💡", title: "節税提案", desc: "あなたの状況に最適化されたiDeCo・ふるさと納税の推奨額を計算" },
              { icon: "👤", title: "基本プロフィール入力", desc: "生年月日・配偶者・子供の情報を登録して精密な計算に活用" },
              { icon: "📄", title: "PDFレポート出力", desc: "分析結果をPDFでダウンロード・共有" },
              { icon: "☁️", title: "クラウド同期", desc: "複数デバイスでデータを同期" },
              { icon: "🚫", title: "広告なし", desc: "アプリ内の広告を非表示にしてスッキり使える" },
            ].map((f) => (
              <View key={f.title} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 2 }}>{f.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>{f.desc}</Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "700" }}>✓</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.premiumPurchaseBtn}
              onPress={handlePremiumPurchase}
              activeOpacity={0.85}
            >
              <Text style={styles.premiumPurchaseBtnText}>¥500/年 でアップグレード</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 12, lineHeight: 18 }}>
              購入はApp Store / Google Playを通じて処理されます。{"\n"}サブスクリプションは自動更新されます。いつでもキャンセル可能です。
            </Text>
          </ScrollView>
        </View>
      </Modal>
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
    noDataBanner: {
      backgroundColor: "#EBF4FF",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "#1A6FD4",
    },
    noDataBannerText: {
      fontSize: 12,
      fontWeight: "500",
      color: "#1A4A8A",
      lineHeight: 18,
    },
    // 2行タブグリッド
    tabGrid: {
      marginBottom: 16,
      gap: 6,
    },
    tabRow: {
      flexDirection: "row",
      gap: 6,
    },
    gridTab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    gridTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    gridTabText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.muted,
      textAlign: "center",
    },
    gridTabTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
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
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    // 手取りタブ
    donutRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 12,
    },
    donutLegend: {
      flex: 1,
      gap: 8,
    },
    donutLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    donutLegendLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.foreground,
    },
    donutLegendValue: {
      fontSize: 13,
      fontWeight: "700",
    },
    donutLegendDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    donutLegendTotalLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    donutLegendTotalValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    // 実質手取り
    realBurdenRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 12,
    },
    realBurdenChartWrap: {
      alignItems: "center",
    },
    realBurdenLegend: {
      flex: 1,
      gap: 6,
    },
    realBurdenLegendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    realBurdenLegendLabel: {
      flex: 1,
      fontSize: 12,
      color: colors.foreground,
    },
    realBurdenLegendValue: {
      fontSize: 12,
      fontWeight: "700",
    },
    realBurdenDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    realBurdenTotalLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    realBurdenTotalValue: {
      fontSize: 16,
      fontWeight: "800",
    },
    // 比較タブ
    trendInsightRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    trendInsightItem: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 10,
      alignItems: "center",
    },
    trendInsightLabel: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 4,
    },
    trendInsightValue: {
      fontSize: 18,
      fontWeight: "800",
    },
    // 働き方の壁タブ
    wallItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 12,
      gap: 12,
    },
    wallItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    wallIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    wallIcon: {
      fontSize: 18,
    },
    wallContent: {
      flex: 1,
    },
    wallHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    wallIncome: {
      fontSize: 15,
      fontWeight: "800",
    },
    wallBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    wallBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    wallDescription: {
      fontSize: 13,
      color: colors.foreground,
      lineHeight: 20,
    },
    wallHighlight: {
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    wallCheckRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    wallCheckDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    wallCheckLabel: {
      flex: 1,
      fontSize: 13,
    },
    wallCheckStatus: {
      fontSize: 12,
      fontWeight: "700",
    },
    // 予測タブ
    residentTaxBox: {
      backgroundColor: "#EBF4FF",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#1A6FD4",
    },
    residentTaxLabel: {
      fontSize: 12,
      color: "#1A6FD4",
      fontWeight: "600",
      marginBottom: 4,
    },
    residentTaxAmount: {
      fontSize: 36,
      fontWeight: "800",
      color: "#1A6FD4",
      letterSpacing: -1,
    },
    residentTaxNote: {
      fontSize: 11,
      color: "#5E7491",
      marginTop: 4,
      textAlign: "center",
    },
    residentTaxBreakdown: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      gap: 8,
    },
    residentTaxRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    residentTaxRowLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    residentTaxRowValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
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
    // カレンダータブ
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
    timingRow: {
      flexDirection: "row" as const,
      gap: 6,
      marginTop: 6,
    },
    timingBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    timingBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "20",
    },
    timingBtnText: {
      fontSize: 11,
      color: colors.muted,
      fontWeight: "500" as const,
    },
    timingBtnTextActive: {
      color: colors.primary,
      fontWeight: "700" as const,
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
    // 節税タブ
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
    // PDFタブ
    pdfFeatureList: {
      gap: 10,
      marginBottom: 16,
    },
    pdfFeatureItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pdfFeatureIcon: {
      fontSize: 18,
    },
    pdfFeatureText: {
      fontSize: 13,
      color: colors.foreground,
    },
    pdfFormatItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    pdfFormatIcon: {
      fontSize: 24,
    },
    pdfFormatName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 2,
    },
    pdfFormatDesc: {
      fontSize: 12,
      color: colors.muted,
    },
    pdfFormatBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    pdfFormatBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    // 空状態
    emptyStateBox: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyStateIcon: {
      fontSize: 40,
      marginBottom: 12,
    },
    emptyStateTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyStateText: {
      fontSize: 12,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    // モーダル共通
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: colors.foreground,
    },
    modalClose: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: "600" as const,
    },
    premiumPurchaseBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center" as const,
      marginTop: 24,
      marginBottom: 12,
    },
    premiumPurchaseBtnText: {
      fontSize: 17,
      fontWeight: "800" as const,
      color: "#FFFFFF",
    },
    // ロックオーバーレイ
    lockedContentWrapper: {
      position: "relative" as const,
    },
    lockedContentBlur: {
      opacity: 0.15,
    },
    lockOverlay: {
      justifyContent: "center" as const,
      alignItems: "center" as const,
      backgroundColor: colors.background,
      borderRadius: 16,
      minHeight: 320,
      marginHorizontal: 16,
      marginTop: 8,
      borderWidth: 2,
      borderColor: colors.primary + "40",
    },
    lockOverlayInner: {
      alignItems: "center" as const,
      paddingHorizontal: 32,
    },
    lockOverlayIcon: {
      fontSize: 48,
      marginBottom: 12,
      color: colors.primary,
    },
    lockOverlayTitle: {
      fontSize: 20,
      fontWeight: "800" as const,
      color: colors.foreground,
      marginBottom: 8,
    },
    lockOverlayText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center" as const,
      lineHeight: 22,
      marginBottom: 24,
    },
    lockOverlayBtn: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    lockOverlayBtnText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: "#FFFFFF",
    },
  });
}
