/* The frame of every public page: trust strip, header with menu, footer, floating Back, WhatsApp and Top buttons.
   Same order and wording as the website at phone width. */
import { usePathname, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, ArrowUp, Clock, Headphones, Menu, Phone, Scale, ShieldCheck, Wifi, X } from 'lucide-react-native';
import { useCallback, useEffect, useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n/LanguageProvider';
import { ROLE_NAV_LABEL } from '../lib/api/base';
import { BUSINESS_ADDRESS, BUSINESS_AREAS, BUSINESS_HOURS_TEXT, SOCIAL_FACEBOOK, SOCIAL_INSTAGRAM, SUPPORT_PHONE_E164, SUPPORT_PHONE_TEXT, SUPPORT_WA_URL } from '../lib/contact';
import { callPhone, openUrl } from '../lib/links';
import { useSession } from '../lib/session';
import { openAccount } from '../features/account/dialogs';
import { openLogin } from '../features/account/login';
import { FacebookIcon, InstagramIcon, LangToggle, Logo } from './brand';
import { Button } from './kit';
import { ROLE_PATH, goDashboard, goHome, goTo } from './nav';
import { useOverlay } from './overlay';
import { T } from './text';
import { colors, radius, space } from './theme';

const PROMISES = [
  [ShieldCheck, 'Trusted Providers'],
  [Scale, 'Unbiased Comparison'],
  [Clock, 'Fast Installation'],
  [Headphones, 'Free Expert Assistance'],
] as const;

function TrustBar() {
  const { t } = useLanguage();
  return (
    <View style={{ height: 40, backgroundColor: colors.trust, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 18 }} style={{ flex: 1 }}>
        {PROMISES.map(([Icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon size={16} color={colors.trustIcon} />
            <T s={12} c={colors.trustText}>{label}</T>
          </View>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`Call Connect Bhai on ${SUPPORT_PHONE_TEXT}`)}
        onPress={() => callPhone(SUPPORT_PHONE_E164)}
        hitSlop={8}
        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Phone size={18} color={colors.trustIcon} />
      </Pressable>
    </View>
  );
}

function Header({ menu, setMenu }: { menu: boolean; setMenu: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { user, signOut } = useSession();
  const overlay = useOverlay();
  return (
    <View style={{ minHeight: 65, backgroundColor: colors.blueDeep, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(141,180,255,0.18)' }}>
      <Logo height={30} onPress={() => goHome()} />
      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LangToggle />
        {user ? (
          <Button testID="logout" label="Log out" variant="hero" small onPress={() => signOut().then(() => goHome())} style={{ alignSelf: 'center' }} />
        ) : (
          <Button testID="login-open" label="Log in" variant="hero" small onPress={() => openLogin(overlay)} style={{ alignSelf: 'center' }} />
        )}
        <Pressable
          testID="menu-toggle"
          accessibilityRole="button"
          accessibilityLabel={t(menu ? 'Close menu' : 'Open menu')}
          accessibilityState={{ expanded: menu }}
          onPress={() => setMenu(!menu)}
          hitSlop={4}
          style={{ width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(141,180,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
          {menu ? <X size={22} color={colors.white} /> : <Menu size={22} color={colors.white} />}
        </Pressable>
      </View>
    </View>
  );
}

function MobileMenu({ close }: { close: () => void }) {
  const { user } = useSession();
  const overlay = useOverlay();
  const path = usePathname();
  const items: [string, () => void, boolean][] = [
    ['Plans', () => goHome(), path === '/'],
    ['Care plan', () => goTo('/care'), path === '/care'],
    ['Speed test', () => goTo('/speed'), path === '/speed'],
  ];
  if (user) {
    items.push([ROLE_NAV_LABEL[user.role], () => goDashboard(user.role), path === ROLE_PATH[user.role]]);
    items.push(['My account', () => openAccount(overlay), false]);
  }
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}>
      <View style={{ backgroundColor: colors.blueDeep, borderBottomWidth: 1, borderColor: 'rgba(141,180,255,0.18)', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, boxShadow: '0 20px 30px -20px rgba(0,0,0,0.6)' }}>
        {items.map(([label, go, current]) => (
          <Pressable
            key={label}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: current }}
            onPress={() => {
              close();
              go();
            }}
            style={({ pressed }) => ({ borderRadius: radius.input, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: current || pressed ? 'rgba(255,255,255,0.12)' : 'transparent' })}>
            <T w={700} c={current ? colors.white : colors.heroText}>{label}</T>
          </Pressable>
        ))}
      </View>
      <Pressable accessible={false} onPress={close} style={{ flex: 1 }} />
    </View>
  );
}

function FooterLink({ label, onPress, s = 13.5, c = colors.heroText, w = 400 }: { label: string; onPress: () => void; s?: number; c?: string; w?: 400 | 600 | 800 }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={4} style={{ alignSelf: 'flex-start', paddingVertical: 1 }}>
      <T s={s} w={w} c={c}>{label}</T>
    </Pressable>
  );
}

function Footer() {
  const { t } = useLanguage();
  const { user } = useSession();
  const head = (label: string) => <T s={14} w={700} c={colors.white} style={{ marginBottom: 4 }}>{label}</T>;
  const line = (text: string) => <T key={text} s={14} c={colors.heroText}>{text}</T>;
  return (
    <View style={{ backgroundColor: colors.blueDeep, paddingHorizontal: space.gutter, paddingTop: 32, paddingBottom: 88, gap: 22 }}>
      <View style={{ gap: 8 }}>
        <Logo height={30} onPress={() => goHome()} />
        <T s={13.5} c={colors.heroText}>Compare BSNL, Jio, Airtel and local ISP fiber, SIM, TV & OTT plans by PIN code in Indore. Book connection & get Connect Bhai Care.</T>
      </View>
      <View style={{ gap: 5 }}>
        {head('Customers')}
        <FooterLink label="Search by PIN code" onPress={() => goHome('search')} />
        <FooterLink label="Wi-Fi speed test" onPress={() => goTo('/speed')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <FooterLink label="Care plan" c={colors.white} w={800} onPress={() => goTo('/care')} />
          <View style={{ backgroundColor: '#F7AE18', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 1 }}>
            <T s={10.5} w={800} c="#3B2300" caps={0.5}>Featured</T>
          </View>
        </View>
        <FooterLink label="FAQ" onPress={() => goHome('faq')} />
        {user ? <FooterLink label="My dashboard" onPress={() => goDashboard(user.role)} /> : null}
        <FooterLink label="Become a DSA or TIP" onPress={() => goHome('partners')} />
      </View>
      <View style={{ gap: 5 }}>
        {head('Contact')}
        {line(BUSINESS_ADDRESS)}
        {line(BUSINESS_HOURS_TEXT)}
        {line(`Area served: ${BUSINESS_AREAS.slice(0, -1).join(', ')} & ${BUSINESS_AREAS[BUSINESS_AREAS.length - 1]}`)}
        <FooterLink label="www.connectbhai.com" s={14} onPress={() => openUrl('https://www.connectbhai.com')} />
        <T s={14} w={700} c={colors.white} style={{ marginTop: 4 }}>Follow Us On</T>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
          <Pressable accessibilityRole="link" accessibilityLabel={t('Connect Bhai on Facebook')} onPress={() => openUrl(SOCIAL_FACEBOOK)}>
            <FacebookIcon size={40} />
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel={t('Connect Bhai on Instagram')} onPress={() => openUrl(SOCIAL_INSTAGRAM)}>
            <InstagramIcon size={40} />
          </Pressable>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderColor: 'rgba(141,180,255,0.22)', paddingTop: 16, gap: 10 }}>
        <T s={12.5} c="#A9BCE6">{`© ${new Date().getFullYear()} Connect Bhai. All Rights Reserved.`}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 8 }}>
          {(
            [
              ['Privacy Policy', '/privacy'],
              ['Account Deletion', '/delete-account'],
              ['Terms of Service', '/terms'],
              ['Refund Policy', '/refund'],
              ['Shipping Policy', '/shipping'],
            ] as const
          ).map(([label, path]) => (
            <FooterLink key={path} label={label} w={600} c="#A9BCE6" onPress={() => goTo(path)} />
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Wifi size={14} color={colors.heroText} />
            <T s={13.5} w={600} c={colors.heroText}>Connecting India</T>
          </View>
        </View>
      </View>
    </View>
  );
}

export function OfflineScreen() {
  const { retry } = useSession();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Wifi size={44} color={colors.muted} />
      <T f="display" s={22} w={700} center>You are offline</T>
      <T c={colors.muted} center>Check your internet connection and try again.</T>
      <Button label="Try again" onPress={retry} style={{ alignSelf: 'center' }} />
    </SafeAreaView>
  );
}

export type ScreenProps = {
  children: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  /** pull to refresh */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** floats above the content, at the bottom (the compare bar) */
  floating?: ReactNode;
  footer?: boolean;
  back?: boolean;
  /** background behind the content */
  bg?: string;
};

export function Screen({ children, scrollRef, onRefresh, refreshing, floating, footer = true, back = true, bg = colors.bg }: ScreenProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [view, setView] = useState<ScrollViewInstance | null>(null);

  useEffect(() => {
    if (!menu) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenu(false);
      return true;
    });
    return () => sub.remove();
  }, [menu]);

  const attach = useCallback((node: ScrollViewInstance | null) => setView(node), []);
  useImperativeHandle(scrollRef, () => view as ScrollViewInstance, [view]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setShowTop(e.nativeEvent.contentOffset.y > 500);
  const goBack = () => (router.canGoBack() ? router.back() : goHome());

  return (
    <View style={{ flex: 1, backgroundColor: colors.blueDeep }}>
      <View style={{ height: insets.top, backgroundColor: colors.trust }} />
      <TrustBar />
      <Header menu={menu} setMenu={setMenu} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: bg }}>
        <ScrollView
          ref={attach}
          onScroll={onScroll}
          scrollEventThrottle={64}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.blue]} /> : undefined}>
          <View style={{ flexGrow: 1 }}>
            {children}
            {back && path !== '/' ? (
              <Pressable
                testID="page-back"
                accessibilityRole="button"
                accessibilityLabel={t('Go back')}
                onPress={goBack}
                hitSlop={6}
                style={{ position: 'absolute', top: 12, right: space.gutter, height: 36, width: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px -4px rgba(10,27,61,0.35)' }}>
                <ArrowLeft size={18} color={colors.blueDeep} />
              </Pressable>
            ) : null}
          </View>
          {footer ? <Footer /> : null}
        </ScrollView>
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: insets.bottom + (floating ? 80 : 16), alignItems: 'flex-end', gap: 12 }}>
          <Pressable accessibilityRole="link" accessibilityLabel={t('Chat with Connect Bhai on WhatsApp')} onPress={() => openUrl(SUPPORT_WA_URL)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={require('../../assets/whatsapp-float.png')} style={{ width: 77, height: 77 }} />
          </Pressable>
          {showTop ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => view?.scrollTo({ y: 0, animated: true })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.trust, boxShadow: '0 6px 16px rgba(11,58,99,0.35)' }}>
              <T c={colors.white} s={14} w={600}>Top</T>
              <ArrowUp size={16} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
        {floating ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, alignItems: 'center' }}>
            {floating}
          </View>
        ) : null}
        {menu ? <MobileMenu close={() => setMenu(false)} /> : null}
      </KeyboardAvoidingView>
      <View style={{ height: insets.bottom, backgroundColor: colors.blueDeep }} />
    </View>
  );
}
