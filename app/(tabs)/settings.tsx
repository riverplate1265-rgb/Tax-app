import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Switch,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { PREFECTURES } from "@/lib/constants";

type WorkClassification =
  | "会社員（企業年金なし）"
  | "会社員（企業年金あり）"
  | "公務員"
  | "自営業・フリーランス";

const WORK_CLASSIFICATIONS: WorkClassification[] = [
  "会社員（企業年金なし）",
  "会社員（企業年金あり）",
  "公務員",
  "自営業・フリーランス",
];

export default function SettingsScreen() {
  const colors = useColors();

  // プロフィール状態
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // プロフィール入力
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [workClass, setWorkClass] = useState<WorkClassification>("会社員（企業年金なし）");
  const [prefecture, setPrefecture] = useState("東京都");
  const [hasSpouse, setHasSpouse] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const [showWorkModal, setShowWorkModal] = useState(false);

  // 年次設定
  const [annualIncome, setAnnualIncome] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [idecoMonthly, setIdecoMonthly] = useState("");
  const [furusatoAmount, setFurusatoAmount] = useState("");
  const [housingLoanBalance, setHousingLoanBalance] = useState("");

  const styles = createStyles(colors);

  const handleGuestLogin = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsLoggedIn(true);
    setShowAuthModal(false);
  };

  const handlePremiumPurchase = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsPremium(true);
    setShowPremiumModal(false);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>設定</Text>
          <Text style={styles.headerSubtitle}>プロフィールと年次データの管理</Text>
        </View>

        {/* アカウント状態カード */}
        {!isLoggedIn ? (
          <View style={styles.authCard}>
            <Text style={styles.authCardTitle}>ログインしてデータを保存</Text>
            <Text style={styles.authCardSubtitle}>
              ログインすると計算データが保存され、複数デバイスで同期できます。
              ゲストモードのデータも引き継げます。
            </Text>
            <TouchableOpacity
              style={styles.authPrimaryBtn}
              onPress={() => setShowAuthModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.authPrimaryBtnText}>ログイン / 新規登録</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.authGuestBtn}
              onPress={handleGuestLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.authGuestBtnText}>ゲストとして続ける</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>
                {isLoggedIn ? "👤" : "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>
                {isLoggedIn ? "ゲストユーザー" : "未ログイン"}
              </Text>
              <Text style={styles.accountStatus}>
                {isPremium ? "✨ プレミアム会員" : "フリープラン"}
              </Text>
            </View>
            {!isPremium && (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => setShowPremiumModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.upgradeBtnText}>アップグレード</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* プレミアム案内バナー */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => setShowPremiumModal(true)}
            activeOpacity={0.9}
          >
            <View style={styles.premiumBannerLeft}>
              <Text style={styles.premiumBannerTitle}>✨ プレミアムプランにアップグレード</Text>
              <Text style={styles.premiumBannerSubtitle}>
                詳細計算・分析タブ・節税提案・PDFレポートが使い放題
              </Text>
            </View>
            <View style={styles.premiumBannerPrice}>
              <Text style={styles.premiumBannerPriceText}>¥500</Text>
              <Text style={styles.premiumBannerPriceUnit}>/年</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* プロフィール設定 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>基本プロフィール</Text>
        </View>

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
                />
                <Text style={styles.dateUnit}>日</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 職場区分 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>職場区分</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowWorkModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorText}>{workClass}</Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* 配偶者 */}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>配偶者あり</Text>
            <Switch
              value={hasSpouse}
              onValueChange={(v) => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setHasSpouse(v);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* 子供の人数 */}
          <View style={styles.stepperRow}>
            <Text style={styles.fieldLabel}>子供の人数</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setChildrenCount((v) => Math.max(0, v - 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{childrenCount}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setChildrenCount((v) => Math.min(10, v + 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 年次データ設定（2026年） */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>年次データ（2026年）</Text>
          {isPremium && (
            <View style={styles.premiumTag}>
              <Text style={styles.premiumTagText}>PRO</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, !isPremium && styles.cardLocked]}>
          {!isPremium && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockText}>有料版で詳細データを入力できます</Text>
              <TouchableOpacity
                style={styles.lockBtn}
                onPress={() => setShowPremiumModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.lockBtnText}>アップグレード</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 年収 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>年収</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="500"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={annualIncome}
                onChangeText={setAnnualIncome}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>万円</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 月収 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>月収（基本給）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="30"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>万円</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 賞与 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>賞与合計（年間）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="120"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={bonusAmount}
                onChangeText={setBonusAmount}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>万円</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* iDeCo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>iDeCo掛金（月額）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="23000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={idecoMonthly}
                onChangeText={setIdecoMonthly}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>円</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ふるさと納税 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ふるさと納税（年間）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="60000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={furusatoAmount}
                onChangeText={setFurusatoAmount}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>円</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 住宅ローン残高 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>住宅ローン残高（年末）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="30000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={housingLoanBalance}
                onChangeText={setHousingLoanBalance}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>円</Text>
            </View>
          </View>

          {isPremium && (
            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>データを保存する</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* アプリ情報 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
        </View>

        <View style={styles.card}>
          {[
            { label: "バージョン", value: "2.0.0" },
            { label: "適用法令", value: "令和8年度（2026年）" },
            { label: "最終更新", value: "2026年3月" },
          ].map((item) => (
            <View key={item.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* ログアウトボタン */}
        {isLoggedIn && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setIsLoggedIn(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutBtnText}>ログアウト</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 認証モーダル */}
      <Modal
        visible={showAuthModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ログイン / 新規登録</Text>
            <TouchableOpacity onPress={() => setShowAuthModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.authModalSubtitle}>
              ソーシャルアカウントで簡単ログイン。データは安全に保管されます。
            </Text>

            {/* 認証ボタン */}
            {[
              { icon: "🍎", label: "Appleでサインイン", color: "#000000", textColor: "#FFFFFF" },
              { icon: "🔵", label: "Googleでサインイン", color: "#FFFFFF", textColor: "#1A1A1A", border: true },
              { icon: "💚", label: "LINEでサインイン", color: "#00B900", textColor: "#FFFFFF" },
              { icon: "🟡", label: "Yahoo! JAPANでサインイン", color: "#FF0033", textColor: "#FFFFFF" },
            ].map((provider) => (
              <TouchableOpacity
                key={provider.label}
                style={[
                  styles.authProviderBtn,
                  { backgroundColor: provider.color },
                  provider.border && styles.authProviderBtnBorder,
                ]}
                onPress={handleGuestLogin}
                activeOpacity={0.85}
              >
                <Text style={styles.authProviderIcon}>{provider.icon}</Text>
                <Text style={[styles.authProviderLabel, { color: provider.textColor }]}>
                  {provider.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.authDivider}>
              <View style={styles.authDividerLine} />
              <Text style={styles.authDividerText}>または</Text>
              <View style={styles.authDividerLine} />
            </View>

            <TouchableOpacity
              style={styles.authGuestBtnModal}
              onPress={handleGuestLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.authGuestBtnModalText}>ゲストとして続ける（データは端末に保存）</Text>
            </TouchableOpacity>

            <Text style={styles.authNote}>
              ゲストモードで入力したデータは、後からアカウント登録することで引き継ぐことができます。
            </Text>
          </ScrollView>
        </View>
      </Modal>

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

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* 価格 */}
            <View style={styles.premiumPriceCard}>
              <Text style={styles.premiumPriceLabel}>年額プラン</Text>
              <View style={styles.premiumPriceRow}>
                <Text style={styles.premiumPrice}>¥500</Text>
                <Text style={styles.premiumPriceUnit}>/年（税込）</Text>
              </View>
              <Text style={styles.premiumPriceNote}>月あたり約42円</Text>
            </View>

            {/* 機能一覧 */}
            <Text style={styles.premiumFeaturesTitle}>プレミアム機能</Text>
            {[
              { icon: "🎯", title: "詳細計算モード", desc: "iDeCo・ふるさと納税・住宅ローン控除を含む1円単位の精密計算" },
              { icon: "📊", title: "分析タブ全機能", desc: "同世代比較・将来予測・税の使い道・税務カレンダー" },
              { icon: "💡", title: "節税提案", desc: "あなたの状況に最適化されたiDeCo・ふるさと納税の推奨額を計算" },
              { icon: "📄", title: "PDFレポート出力", desc: "分析結果をPDFでダウンロード・共有" },
              { icon: "🔔", title: "税務カレンダー通知", desc: "確定申告・住民税更新などの重要日程をプッシュ通知" },
              { icon: "☁️", title: "クラウド同期", desc: "複数デバイスでデータを同期" },
            ].map((feature) => (
              <View key={feature.title} style={styles.premiumFeatureItem}>
                <Text style={styles.premiumFeatureIcon}>{feature.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.premiumFeatureTitle}>{feature.title}</Text>
                  <Text style={styles.premiumFeatureDesc}>{feature.desc}</Text>
                </View>
                <Text style={styles.premiumFeatureCheck}>✓</Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.premiumPurchaseBtn}
              onPress={handlePremiumPurchase}
              activeOpacity={0.85}
            >
              <Text style={styles.premiumPurchaseBtnText}>¥500/年 でアップグレード</Text>
            </TouchableOpacity>

            <Text style={styles.premiumTermsNote}>
              購入はApp Store / Google Playを通じて処理されます。
              サブスクリプションは自動更新されます。いつでもキャンセル可能です。
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* 職場区分選択モーダル */}
      <Modal
        visible={showWorkModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWorkModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>職場区分を選択</Text>
            <TouchableOpacity onPress={() => setShowWorkModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          {WORK_CLASSIFICATIONS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.workClassItem, item === workClass && styles.workClassItemSelected]}
              onPress={() => {
                setWorkClass(item);
                setShowWorkModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.workClassText, item === workClass && styles.workClassTextSelected]}>
                {item}
              </Text>
              {item === workClass && <Text style={styles.workClassCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
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
    // 認証カード
    authCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    authCardTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
    },
    authCardSubtitle: {
      fontSize: 13,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    authPrimaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 32,
      width: "100%",
      alignItems: "center",
      marginBottom: 10,
    },
    authPrimaryBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    authGuestBtn: {
      paddingVertical: 10,
    },
    authGuestBtnText: {
      fontSize: 14,
      color: colors.muted,
    },
    // アカウントカード
    accountCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    accountAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountAvatarText: {
      fontSize: 22,
    },
    accountName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.foreground,
    },
    accountStatus: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    upgradeBtn: {
      backgroundColor: "#F5A623",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    upgradeBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    // プレミアムバナー
    premiumBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1A6FD4",
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      gap: 12,
    },
    premiumBannerLeft: {
      flex: 1,
    },
    premiumBannerTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
      marginBottom: 4,
    },
    premiumBannerSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      lineHeight: 18,
    },
    premiumBannerPrice: {
      alignItems: "center",
    },
    premiumBannerPriceText: {
      fontSize: 22,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    premiumBannerPriceUnit: {
      fontSize: 11,
      color: "rgba(255,255,255,0.8)",
    },
    // セクションヘッダー
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    premiumTag: {
      backgroundColor: "#F5A623",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    premiumTagText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: 0.5,
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
    cardLocked: {
      opacity: 0.7,
      position: "relative",
    },
    lockOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255,255,255,0.85)",
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      gap: 8,
    },
    lockIcon: {
      fontSize: 28,
    },
    lockText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
    },
    lockBtn: {
      backgroundColor: "#F5A623",
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginTop: 4,
    },
    lockBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#FFFFFF",
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
    selector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    selectorText: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    selectorChevron: {
      fontSize: 20,
      color: colors.muted,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: colors.foreground,
      padding: 0,
    },
    inputUnit: {
      fontSize: 14,
      color: colors.muted,
      marginLeft: 4,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 16,
      marginBottom: 4,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    // アプリ情報
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.muted,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.foreground,
    },
    logoutBtn: {
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 20,
    },
    logoutBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.muted,
    },
    // モーダル共通
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
    modalContent: {
      padding: 20,
      paddingBottom: 40,
    },
    // 認証モーダル
    authModalSubtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 24,
    },
    authProviderBtn: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      marginBottom: 12,
      gap: 12,
    },
    authProviderBtnBorder: {
      borderWidth: 1.5,
      borderColor: "#D8E3EF",
    },
    authProviderIcon: {
      fontSize: 20,
    },
    authProviderLabel: {
      fontSize: 15,
      fontWeight: "600",
    },
    authDivider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginVertical: 20,
    },
    authDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    authDividerText: {
      fontSize: 13,
      color: colors.muted,
    },
    authGuestBtnModal: {
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 16,
    },
    authGuestBtnModalText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.muted,
    },
    authNote: {
      fontSize: 12,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    // プレミアムモーダル
    premiumPriceCard: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 24,
    },
    premiumPriceLabel: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      marginBottom: 4,
    },
    premiumPriceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    premiumPrice: {
      fontSize: 48,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: -2,
    },
    premiumPriceUnit: {
      fontSize: 14,
      color: "rgba(255,255,255,0.8)",
      marginBottom: 8,
    },
    premiumPriceNote: {
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      marginTop: 4,
    },
    premiumFeaturesTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 16,
    },
    premiumFeatureItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    premiumFeatureIcon: {
      fontSize: 22,
    },
    premiumFeatureTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 2,
    },
    premiumFeatureDesc: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
    },
    premiumFeatureCheck: {
      fontSize: 16,
      color: "#2ECC71",
      fontWeight: "700",
    },
    premiumPurchaseBtn: {
      backgroundColor: "#F5A623",
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
      marginBottom: 12,
      shadowColor: "#F5A623",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    premiumPurchaseBtnText: {
      fontSize: 17,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    premiumTermsNote: {
      fontSize: 11,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    // 職場区分モーダル
    workClassItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    workClassItemSelected: {
      backgroundColor: "#EBF4FF",
    },
    workClassText: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    workClassTextSelected: {
      color: colors.primary,
      fontWeight: "600",
    },
    workClassCheck: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
