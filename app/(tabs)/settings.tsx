import React, { useState, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { PREFECTURES } from "@/lib/constants";
import { useAuthLink } from "@/hooks/use-auth-link";
import { useAnnualSettings } from "@/hooks/use-annual-settings";
import { upsertProfile, getProfile } from "@/lib/supabaseDb";
import {
  saveProfile,
  saveAnnualData,
  loadAnnualData,
  getSavedYears,
  savePremium,
  loadPremium,
  getPremiumSync,
  subscribeToProfileStore,
  type ChildInfo,
  type DisabilityType,
} from "@/store/profileStore";

/** 日付入力コンポーネント */
function DateInput({
  label,
  year,
  month,
  day,
  onYearChange,
  onMonthChange,
  onDayChange,
  colors,
  styles,
}: {
  label: string;
  year: string;
  month: string;
  day: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
  colors: any;
  styles: any;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <View style={styles.dateInputWrap}>
          <TextInput
            style={styles.dateInput}
            placeholder="1990"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={4}
            value={year}
            onChangeText={onYearChange}
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
            value={month}
            onChangeText={onMonthChange}
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
            value={day}
            onChangeText={onDayChange}
          />
          <Text style={styles.dateUnit}>日</Text>
        </View>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();

  // Supabase 認証・データ連携
  const {
    supabaseUser,
    isAnonymous,
    isAuthenticated,
    linkState,
    linkError,
    migratedCount,
    signInAnonymously,
    linkWithGoogle,
    linkWithApple,
    signOut,
  } = useAuthLink();

  // 設定ビュー切り替え（基本プロフィール / 年次設定）
  type SettingsView = "profile" | "annual";
  const [settingsView, setSettingsView] = useState<SettingsView>("profile");

  // 年度選択（年次データ用）
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showYearModal, setShowYearModal] = useState(false);
  // 選択可能な年度リスト（2025年以降・現在年まで）
  const yearOptions = Array.from(
    { length: Math.max(1, currentYear - 2025 + 1) },
    (_, i) => 2025 + i
  );

  const { settings, save, saving, load } = useAnnualSettings({
    userId: supabaseUser?.id ?? null,
    year: selectedYear,
  });

  // プロフィール状態（ローカルUI用）
  const isLoggedIn = isAuthenticated || isAnonymous;
  const [isPremium, setIsPremium] = useState(() => getPremiumSync());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [annualSaveSuccess, setAnnualSaveSuccess] = useState(false);

  // 本人情報
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [workPrefecture, setWorkPrefecture] = useState("東京都");
  const [showWorkPrefModal, setShowWorkPrefModal] = useState(false);

  // 障害者情報
  const [disabilityType, setDisabilityType] = useState<DisabilityType>("none");

  // 配偶者情報
  const [hasSpouse, setHasSpouse] = useState(false);
  const [spouseBirthYear, setSpouseBirthYear] = useState("");
  const [spouseBirthMonth, setSpouseBirthMonth] = useState("");
  const [spouseBirthDay, setSpouseBirthDay] = useState("");

  // 子供情報
  const [childrenCount, setChildrenCount] = useState(0);
  const [children, setChildren] = useState<ChildInfo[]>([]);

  // 年次設定
  const [annualIncome, setAnnualIncome] = useState("");
  const [spouseIncome, setSpouseIncome] = useState("");
  const [idecoMonthly, setIdecoMonthly] = useState("");
  const [furusatoAmount, setFurusatoAmount] = useState("");
  const [housingLoanBalance, setHousingLoanBalance] = useState("");
  const [lifeInsurance, setLifeInsurance] = useState("");
  const [medicalExpenses, setMedicalExpenses] = useState("");
  // 社会保険料算出パターン
  const [socialInsuranceMode, setSocialInsuranceMode] = useState<"auto" | "hyojun" | "actual" | "manual">("auto");
  const [hyojunHoshu, setHyojunHoshu] = useState("");
  const [actualAprilSalary, setActualAprilSalary] = useState("");
  const [actualMaySalary, setActualMaySalary] = useState("");
  const [actualJuneSalary, setActualJuneSalary] = useState("");
  const [manualSocialInsurance, setManualSocialInsurance] = useState("");

  const styles = createStyles(colors);

  // 子供の人数が変わったとき、children配列を調整する
  useEffect(() => {
    setChildren((prev) => {
      if (childrenCount > prev.length) {
        const added = Array.from({ length: childrenCount - prev.length }, () => ({
          birthYear: "",
          birthMonth: "",
          birthDay: "",
        }));
        return [...prev, ...added];
      } else {
        return prev.slice(0, childrenCount);
      }
    });
  }, [childrenCount]);

  // 起動時に匿名認証・プレミアムフラグ読み込み
  useEffect(() => {
    signInAnonymously();
    loadPremium().then((v) => setIsPremium(v));
  }, []);

  // profileStoreの変更を監視（他タブからの変更を反映）
  useEffect(() => {
    return subscribeToProfileStore(() => {
      setIsPremium(getPremiumSync());
    });
  }, []);

  // 年度が変わったとき、profileStoreから読み込む
  useEffect(() => {
    loadAnnualData(selectedYear).then((data) => {
      if (data) {
        setAnnualIncome(data.annualIncome ?? "");
        setSpouseIncome(data.spouseIncome ?? "");
        setIdecoMonthly(data.idecoMonthly ?? "");
        setFurusatoAmount(data.furusatoAmount ?? "");
        setHousingLoanBalance(data.housingLoanBalance ?? "");
        setLifeInsurance(data.lifeInsurance ?? "");
        setMedicalExpenses(data.medicalExpenses ?? "");
        setSocialInsuranceMode(data.socialInsuranceMode ?? "auto");
        setHyojunHoshu(data.hyojunHoshu ?? "");
        setActualAprilSalary(data.actualAprilSalary ?? "");
        setActualMaySalary(data.actualMaySalary ?? "");
        setActualJuneSalary(data.actualJuneSalary ?? "");
        setManualSocialInsurance(data.manualSocialInsurance ?? "");
      } else if (settings) {
        // profileStoreにない場合はSupabaseから
        if (settings.annual_income) setAnnualIncome(String(settings.annual_income));
        if (settings.ideco_contribution) setIdecoMonthly(String(settings.ideco_contribution));
        if (settings.furusato_nouzei_donation) setFurusatoAmount(String(settings.furusato_nouzei_donation));
        if (settings.housing_loan_deduction) setHousingLoanBalance(String(settings.housing_loan_deduction));
        if (settings.life_insurance_deduction) setLifeInsurance(String(settings.life_insurance_deduction));
        if (settings.spouse_income) setSpouseIncome(String(settings.spouse_income));
        if (settings.medical_expenses) setMedicalExpenses(String(settings.medical_expenses));
        if (settings.work_prefecture) setWorkPrefecture(settings.work_prefecture);
      }
    });
  }, [selectedYear]);

  // Supabase から設定を読み込んでフォームに反映（初回のみ）
  useEffect(() => {
    if (settings) {
      if (settings.annual_income) setAnnualIncome(String(settings.annual_income));
      if (settings.ideco_contribution) setIdecoMonthly(String(settings.ideco_contribution));
      if (settings.furusato_nouzei_donation) setFurusatoAmount(String(settings.furusato_nouzei_donation));
      if (settings.housing_loan_deduction) setHousingLoanBalance(String(settings.housing_loan_deduction));
      if (settings.life_insurance_deduction) setLifeInsurance(String(settings.life_insurance_deduction));
      if (settings.spouse_income) setSpouseIncome(String(settings.spouse_income));
      if (settings.medical_expenses) setMedicalExpenses(String(settings.medical_expenses));
      if (settings.work_prefecture) setWorkPrefecture(settings.work_prefecture);
    }
  }, [settings]);

  // プロフィールを Supabase から読み込む
  useEffect(() => {
    if (!supabaseUser) return;
    getProfile(supabaseUser.id).then((profile) => {
      if (!profile) return;
      if (profile.birth_date) {
        const parts = profile.birth_date.split('-');
        if (parts.length === 3) {
          setBirthYear(parts[0]);
          setBirthMonth(String(parseInt(parts[1], 10)));
          setBirthDay(String(parseInt(parts[2], 10)));
        }
      }
      if (profile.work_prefecture) setWorkPrefecture(profile.work_prefecture);
      if (profile.has_spouse !== undefined) setHasSpouse(profile.has_spouse);
      if (profile.children_count !== undefined) setChildrenCount(profile.children_count);
      if (profile.is_premium !== undefined) setIsPremium(profile.is_premium);
    });
  }, [supabaseUser]);

  // 移行完了通知
  useEffect(() => {
    if (migratedCount > 0) {
      Alert.alert(
        "データ移行完了",
        `ゲストモードで保存した ${migratedCount} 年分のデータをアカウントに引き継ぎました。`,
        [{ text: "OK" }]
      );
    }
  }, [migratedCount]);

  const handleGuestLogin = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowAuthModal(false);
  };

  const handlePremiumPurchase = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await savePremium(true);
    setIsPremium(true);
    setShowPremiumModal(false);
  };

  // 子供の生年月日を更新するヘルパー
  const updateChild = (index: number, field: keyof ChildInfo, value: string) => {
    setChildren((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // プロフィールを保存する（計算タブへの自動反映も行う）
  const handleSaveProfile = async () => {
    if (!supabaseUser) return;
    setIsSavingProfile(true);
    try {
      // Supabase に保存
      await upsertProfile(supabaseUser.id, {
        birth_date: birthYear && birthMonth && birthDay
          ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
          : null,
        work_prefecture: workPrefecture,
        has_spouse: hasSpouse,
        children_count: childrenCount,
      });

      // profileStore に保存（計算タブへの自動反映）
      await saveProfile({
        birthYear,
        birthMonth,
        birthDay,
        workPrefecture,
        disabilityType,
        hasSpouse,
        spouseBirthYear,
        spouseBirthMonth,
        spouseBirthDay,
        childrenCount,
        children,
        savedAt: new Date().toISOString(),
      });

      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 2500);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert("エラー", "プロフィールの保存に失敗しました");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 年次データを保存する
  const handleSaveAnnualSettings = async () => {
    // profileStore に保存（計算タブ詳細モードへの自動反映）
    await saveAnnualData({
      year: selectedYear,
      annualIncome,
      spouseIncome,
      commutingAllowance: "",
      idecoMonthly,
      furusatoAmount,
      housingLoanBalance,
      lifeInsurance,
      medicalExpenses,
      workPrefecture,
      socialInsuranceMode,
      hyojunHoshu,
      actualAprilSalary,
      actualMaySalary,
      actualJuneSalary,
      manualSocialInsurance,
      savedAt: new Date().toISOString(),
    });

    // Supabase にも保存
    const success = await save({
      annual_income: annualIncome ? parseFloat(annualIncome) : null,
      ideco_contribution: idecoMonthly ? parseInt(idecoMonthly, 10) : null,
      furusato_nouzei_donation: furusatoAmount ? parseInt(furusatoAmount, 10) : null,
      housing_loan_deduction: housingLoanBalance ? parseInt(housingLoanBalance, 10) : null,
      life_insurance_deduction: lifeInsurance ? parseInt(lifeInsurance, 10) : null,
      spouse_income: spouseIncome ? parseFloat(spouseIncome) : null,
      medical_expenses: medicalExpenses ? parseInt(medicalExpenses, 10) : null,
      work_prefecture: workPrefecture,
    });
    if (success) {
      setAnnualSaveSuccess(true);
      setTimeout(() => setAnnualSaveSuccess(false), 2500);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
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

        {/* 設定ビュートグル */}
        <View style={styles.settingsToggle}>
          <TouchableOpacity
            style={[styles.settingsToggleBtn, settingsView === "profile" && styles.settingsToggleBtnActive]}
            onPress={() => setSettingsView("profile")}
            activeOpacity={0.8}
          >
            <Text style={[styles.settingsToggleBtnText, settingsView === "profile" && styles.settingsToggleBtnTextActive]}>
              👤 基本プロフィール
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsToggleBtn, settingsView === "annual" && styles.settingsToggleBtnActive]}
            onPress={() => setSettingsView("annual")}
            activeOpacity={0.8}
          >
            <Text style={[styles.settingsToggleBtnText, settingsView === "annual" && styles.settingsToggleBtnTextActive]}>
              📅 年次設定
            </Text>
          </TouchableOpacity>
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
              <Text style={styles.accountAvatarText}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>
                {isAuthenticated ? "ログイン済み" : "ゲストユーザー"}
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
                詳細計算・分析タブ・節税提案・PDFレポート・広告なし
              </Text>
            </View>
            <View style={styles.premiumBannerPrice}>
              <Text style={styles.premiumBannerPriceText}>¥500</Text>
              <Text style={styles.premiumBannerPriceUnit}>/年</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 基本プロフィール（プロフィールビューのみ） */}
        {settingsView === "profile" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>基本プロフィール</Text>
              <View style={styles.premiumTag}>
                <Text style={styles.premiumTagText}>PRO</Text>
              </View>
            </View>

        <View style={[styles.card, !isPremium && styles.cardLocked]}>
          {/* 有料版ロックオーバーレイ */}
          {!isPremium && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockText}>有料版でプロフィールを入力できます</Text>
              <TouchableOpacity
                style={styles.lockBtn}
                onPress={() => setShowPremiumModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.lockBtnText}>アップグレード</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 本人の生年月日 */}
          <DateInput
            label="あなたの生年月日"
            year={birthYear}
            month={birthMonth}
            day={birthDay}
            onYearChange={setBirthYear}
            onMonthChange={setBirthMonth}
            onDayChange={setBirthDay}
            colors={colors}
            styles={styles}
          />

          <View style={styles.divider} />

          {/* 勤務都道府県 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>勤務都道府県</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => isPremium && setShowWorkPrefModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorText}>{workPrefecture}</Text>
              <Text style={styles.selectorChevron}>›</Text>
            </TouchableOpacity>
          </View>

           <View style={styles.divider} />
          {/* 障害者区分 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>障害者区分</Text>
            <Text style={styles.fieldNote}>障害者控除：障害者 27万円、特別障害者 40万円、同居特別障害者 75万円</Text>
            <View style={styles.segmentRow}>
              {([
                { key: "none" as DisabilityType, label: "なし" },
                { key: "general" as DisabilityType, label: "障害者" },
                { key: "special" as DisabilityType, label: "特別" },
                { key: "cohabiting_special" as DisabilityType, label: "同居特別" },
              ] as { key: DisabilityType; label: string }[]).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.segmentBtn,
                    disabilityType === item.key && styles.segmentBtnActive,
                    !isPremium && { opacity: 0.4 },
                  ]}
                  onPress={() => isPremium && setDisabilityType(item.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentBtnText,
                    disabilityType === item.key && styles.segmentBtnTextActive,
                  ]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.divider} />
          {/* 配偶者トグル */}
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
              disabled={!isPremium}
            />
          </View>

          {/* 配偶者の生年月日（配偶者ありの場合のみ表示） */}
          {hasSpouse && (
            <>
              <View style={styles.divider} />
              <DateInput
                label="配偶者の生年月日"
                year={spouseBirthYear}
                month={spouseBirthMonth}
                day={spouseBirthDay}
                onYearChange={setSpouseBirthYear}
                onMonthChange={setSpouseBirthMonth}
                onDayChange={setSpouseBirthDay}
                colors={colors}
                styles={styles}
              />
            </>
          )}

          <View style={styles.divider} />

          {/* 子供の人数 */}
          <View style={styles.stepperRow}>
            <Text style={styles.fieldLabel}>子供の人数</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepperBtn, !isPremium && { opacity: 0.4 }]}
                onPress={() => isPremium && setChildrenCount((v) => Math.max(0, v - 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{childrenCount}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, !isPremium && { opacity: 0.4 }]}
                onPress={() => isPremium && setChildrenCount((v) => Math.min(10, v + 1))}
                activeOpacity={0.7}
              >
                <Text style={styles.stepperBtnText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 子供の生年月日（人数分） */}
          {children.map((child, i) => (
            <React.Fragment key={i}>
              <View style={styles.divider} />
              <DateInput
                label={`第${i + 1}子の生年月日`}
                year={child.birthYear}
                month={child.birthMonth}
                day={child.birthDay}
                onYearChange={(v) => updateChild(i, "birthYear", v)}
                onMonthChange={(v) => updateChild(i, "birthMonth", v)}
                onDayChange={(v) => updateChild(i, "birthDay", v)}
                colors={colors}
                styles={styles}
              />
            </React.Fragment>
          ))}
        </View>

        {/* プロフィールを保存するボタン（基本プロフィールの直下） */}
        {isLoggedIn && isPremium && (
          <TouchableOpacity
            style={[styles.saveProfileBtn, isSavingProfile && { opacity: 0.7 }]}
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
            activeOpacity={0.85}
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveProfileBtnText}>
                {profileSaveSuccess ? "✓ プロフィールを保存しました" : "プロフィールを保存する"}
              </Text>
            )}
          </TouchableOpacity>
        )}
          </>
        )}

        {/* 年次データ設定（年次設定ビューのみ） */}
        {settingsView === "annual" && (
          <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>年次データ</Text>
          {isPremium && (
            <View style={styles.premiumTag}>
              <Text style={styles.premiumTagText}>PRO</Text>
            </View>
          )}
        </View>

        {/* 年度選択プルダウン */}
        <TouchableOpacity
          style={styles.yearSelector}
          onPress={() => setShowYearModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.yearSelectorLabel}>対象年度</Text>
          <View style={styles.yearSelectorRight}>
            <Text style={styles.yearSelectorValue}>{selectedYear}年</Text>
            <Text style={styles.selectorChevron}>›</Text>
          </View>
        </TouchableOpacity>

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
            <Text style={styles.fieldLabel}>年収（見込み）</Text>
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

          {/* 配偶者の見込み年収 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>配偶者の見込み年収</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="103"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={spouseIncome}
                onChangeText={setSpouseIncome}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>万円</Text>
            </View>
            <Text style={styles.fieldNote}>103万円以下で配偶者控除、201万円以下で配偶者特別控除が適用されます</Text>
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
            <Text style={styles.fieldNote}>全額所得控除。上限：会社員2.3万円/月（企業型DCなし）・1.2万円/月（企業型DCあり）</Text>
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
            <Text style={styles.fieldNote}>2,000円を超える部分が税額控除されます（ワンストップ特例または確定申告が必要）</Text>
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
            <Text style={styles.fieldNote}>残高×0.7%が税額控除（令和4年以降入居・上限：新築認定住宅35万円、一般住宅21万円）</Text>
          </View>

          <View style={styles.divider} />

          {/* 生命保険料 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>生命保険料 年間支払額</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="120000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={lifeInsurance}
                onChangeText={setLifeInsurance}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>円</Text>
            </View>
            <Text style={styles.fieldNote}>新制度：年間支払額に応じて最大4万円の所得控除（一般・介護医療・個人年金の合計最大12万円）</Text>
          </View>

          <View style={styles.divider} />

          {/* 医療費年間見込額 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>医療費 年間見込額</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="150000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={medicalExpenses}
                onChangeText={setMedicalExpenses}
                editable={isPremium}
              />
              <Text style={styles.inputUnit}>円</Text>
            </View>
            <Text style={styles.fieldNote}>10万円超の部分が医療費控除として所得控除されます（上限200万円）</Text>
          </View>

          <View style={styles.divider} />

          {/* 社会保険料算出パターン */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>社会保険料の算出方法</Text>
            <Text style={styles.fieldNote}>詳細計算時に使用する社会保険料の算出方法を選択してください</Text>
            <View style={styles.siModeContainer}>
              {([
                { key: "auto", label: "① 給与からの自動推定", desc: "年収から標準報酬月額を推定して算出" },
                { key: "hyojun", label: "② 標準報酬月額の直接指定", desc: "実際の標準報酬月額を入力" },
                { key: "actual", label: "③ 4〜6月の給与実績に基づく算定", desc: "4・5・6月の実績給与から定時決定をシミュレート" },
                { key: "manual", label: "④ 保険料額の直接入力", desc: "年間社会保険料総額を直接入力" },
              ] as const).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.siModeItem,
                    socialInsuranceMode === item.key && styles.siModeItemSelected,
                    !isPremium && { opacity: 0.4 },
                  ]}
                  onPress={() => isPremium && setSocialInsuranceMode(item.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.siModeRadio}>
                    {socialInsuranceMode === item.key && <View style={styles.siModeRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.siModeLabel,
                      socialInsuranceMode === item.key && styles.siModeLabelSelected,
                    ]}>{item.label}</Text>
                    <Text style={styles.siModeDesc}>{item.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* モード2：標準報酬月額入力 */}
            {socialInsuranceMode === "hyojun" && (
              <View style={styles.siInputBlock}>
                <Text style={styles.siInputLabel}>標準報酬月額</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="300000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={hyojunHoshu}
                    onChangeText={setHyojunHoshu}
                    editable={isPremium}
                  />
                  <Text style={styles.inputUnit}>円/月</Text>
                </View>
                <Text style={styles.fieldNote}>標準報酬月額表の等級に対応した保険料を自動計算します（健康保険・厚生年金・雇用保険）</Text>
              </View>
            )}

            {/* モード3：4〜6月実績入力 */}
            {socialInsuranceMode === "actual" && (
              <View style={styles.siInputBlock}>
                <Text style={styles.siInputLabel}>4・5・6月の実績給与（交通費含む）</Text>
                <View style={[styles.inputRow, { marginBottom: 8 }]}>
                  <Text style={[styles.inputUnit, { minWidth: 32 }]}>4月</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="300000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={actualAprilSalary}
                    onChangeText={setActualAprilSalary}
                    editable={isPremium}
                  />
                  <Text style={styles.inputUnit}>円</Text>
                </View>
                <View style={[styles.inputRow, { marginBottom: 8 }]}>
                  <Text style={[styles.inputUnit, { minWidth: 32 }]}>5月</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="300000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={actualMaySalary}
                    onChangeText={setActualMaySalary}
                    editable={isPremium}
                  />
                  <Text style={styles.inputUnit}>円</Text>
                </View>
                <View style={styles.inputRow}>
                  <Text style={[styles.inputUnit, { minWidth: 32 }]}>6月</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="300000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={actualJuneSalary}
                    onChangeText={setActualJuneSalary}
                    editable={isPremium}
                  />
                  <Text style={styles.inputUnit}>円</Text>
                </View>
                {actualAprilSalary && actualMaySalary && actualJuneSalary && (() => {
                  const avg = (parseInt(actualAprilSalary || "0") + parseInt(actualMaySalary || "0") + parseInt(actualJuneSalary || "0")) / 3;
                  return <Text style={styles.fieldNote}>平均報酬: {Math.round(avg).toLocaleString()}円 → 標準報酬月額表で等級を自動判定します</Text>;
                })()}
              </View>
            )}

            {/* モード4：直接入力 */}
            {socialInsuranceMode === "manual" && (
              <View style={styles.siInputBlock}>
                <Text style={styles.siInputLabel}>社会保険料（年額）</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="600000"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    value={manualSocialInsurance}
                    onChangeText={setManualSocialInsurance}
                    editable={isPremium}
                  />
                  <Text style={styles.inputUnit}>円/年</Text>
                </View>
                <Text style={styles.fieldNote}>健康保険料・厚生年金保険料・雇用保険料の合計年額を入力してください</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSaveAnnualSettings}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>
                {annualSaveSuccess ? `✓ ${selectedYear}年のデータを保存しました` : `${selectedYear}年のデータを保存する`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
          </>
        )}

        {/* アプリ情報 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
        </View>

        <View style={styles.card}>
          {[
            { label: "バージョン", value: "2.0.0" },
            { label: "最終更新", value: "2026年3月" },
          ].map((item, idx) => (
            <View
              key={item.label}
              style={[
                styles.infoRow,
                idx === 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* ログアウトボタン */}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={signOut}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutBtnText}>ログアウト</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 年度選択モーダル */}
      <Modal
        visible={showYearModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowYearModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>対象年度を選択</Text>
            <TouchableOpacity onPress={() => setShowYearModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {yearOptions.map((year) => (
              <TouchableOpacity
                key={year}
                style={[styles.workClassItem, year === selectedYear && styles.workClassItemSelected]}
                onPress={() => {
                  setSelectedYear(year);
                  setShowYearModal(false);
                  // フォームをリセット
                  setAnnualIncome("");
                  setSpouseIncome("");
                  setIdecoMonthly("");
                  setFurusatoAmount("");
                  setHousingLoanBalance("");
                  setLifeInsurance("");
                  setMedicalExpenses("");
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.workClassText, year === selectedYear && styles.workClassTextSelected]}>
                  {year}年{year === currentYear ? "（今年）" : ""}
                </Text>
                {year === selectedYear && <Text style={styles.workClassCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

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

            {[
              { icon: "🍎", label: "Appleでサインイン", color: "#000000", textColor: "#FFFFFF", action: linkWithApple },
              { icon: "🔵", label: "Googleでサインイン", color: "#FFFFFF", textColor: "#1A1A1A", border: true, action: linkWithGoogle },
              { icon: "💚", label: "LINEでサインイン", color: "#00B900", textColor: "#FFFFFF", action: handleGuestLogin },
              { icon: "🟡", label: "Yahoo! JAPANでサインイン", color: "#FF0033", textColor: "#FFFFFF", action: handleGuestLogin },
            ].map((provider) => (
              <TouchableOpacity
                key={provider.label}
                style={[
                  styles.authProviderBtn,
                  { backgroundColor: provider.color },
                  provider.border && styles.authProviderBtnBorder,
                ]}
                onPress={provider.action}
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
            <View style={styles.premiumPriceCard}>
              <Text style={styles.premiumPriceLabel}>年額プラン</Text>
              <View style={styles.premiumPriceRow}>
                <Text style={styles.premiumPrice}>¥500</Text>
                <Text style={styles.premiumPriceUnit}>/年（税込）</Text>
              </View>
              <Text style={styles.premiumPriceNote}>月あたり約42円</Text>
            </View>

            <Text style={styles.premiumFeaturesTitle}>プレミアム機能</Text>
            {[
              { icon: "👤", title: "基本プロフィール入力", desc: "生年月日・配偶者・子供の情報を登録して精密な計算に活用" },
              { icon: "🎯", title: "詳細計算モード", desc: "iDeCo・ふるさと納税・住宅ローン控除を含む1円単位の精密計算" },
              { icon: "📊", title: "分析タブ全機能", desc: "同世代比較・将来予測・税の使い道・税務カレンダー" },
              { icon: "💡", title: "節税提案", desc: "あなたの状況に最適化されたiDeCo・ふるさと納税の推奨額を計算" },
              { icon: "📄", title: "PDFレポート出力", desc: "分析結果をPDFでダウンロード・共有" },
              { icon: "☁️", title: "クラウド同期", desc: "複数デバイスでデータを同期" },
            { icon: "🚫", title: "広告なし", desc: "アプリ内の広告を非表示にしてスッキり使える" },
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

      {/* 勤務都道府県選択モーダル */}
      <Modal
        visible={showWorkPrefModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWorkPrefModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>勤務都道府県を選択</Text>
            <TouchableOpacity onPress={() => setShowWorkPrefModal(false)}>
              <Text style={styles.modalClose}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {PREFECTURES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.workClassItem, item === workPrefecture && styles.workClassItemSelected]}
                onPress={() => {
                  setWorkPrefecture(item);
                  setShowWorkPrefModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.workClassText, item === workPrefecture && styles.workClassTextSelected]}>
                  {item}
                </Text>
                {item === workPrefecture && <Text style={styles.workClassCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
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
    // 年度セレクター
    yearSelector: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    yearSelectorLabel: {
      fontSize: 14,
      color: colors.muted,
      fontWeight: "500",
    },
    yearSelectorRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    yearSelectorValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary,
    },
    // カード
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginBottom: 8,
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
      backgroundColor: "rgba(255,255,255,0.88)",
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
    fieldNote: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 6,
      lineHeight: 18,
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
    // プロフィール保存ボタン（基本プロフィールの直下）
    saveProfileBtn: {
      backgroundColor: "#0FA86E",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 24,
      marginTop: 4,
    },
    saveProfileBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    // 年次データ保存ボタン
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
      marginTop: 8,
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
    // 都道府県・年度モーダル
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
    // 障害者区分セグメント
    segmentRow: {
      flexDirection: "row" as const,
      gap: 8,
      marginTop: 10,
      flexWrap: "wrap" as const,
    },
    segmentBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    segmentBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "20",
    },
    segmentBtnText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "500" as const,
    },
    segmentBtnTextActive: {
      color: colors.primary,
      fontWeight: "700" as const,
    },
    // 設定タブのトグルボタン
    settingsToggle: {
      flexDirection: "row" as const,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsToggleBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 9,
      alignItems: "center" as const,
    },
    settingsToggleBtnActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    settingsToggleBtnText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.muted,
    },
    settingsToggleBtnTextActive: {
      color: "#FFFFFF",
    },
    // 社会保険料算出パターン
    siModeContainer: {
      marginTop: 12,
      gap: 8,
    },
    siModeItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    siModeItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "12",
    },
    siModeRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginTop: 2,
    },
    siModeRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    siModeLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
      marginBottom: 2,
    },
    siModeLabelSelected: {
      color: colors.primary,
    },
    siModeDesc: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    siInputBlock: {
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    siInputLabel: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      marginBottom: 10,
    },
  });
}
