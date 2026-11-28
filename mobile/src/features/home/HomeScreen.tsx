/* The home page: hero with search, results and compare, then the website's sections in the same order. The "Get the
   app" section is left out (store rules). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { API } from '../../lib/api';
import type { Plan } from '../../lib/api/types';
import { errMsg } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/useLoad';
import { Screen } from '../../ui/chrome';
import { Button, Row, Section } from '../../ui/kit';
import { ROLE_PATH, goTo, onSectionRequest, takeSection, type HomeSection } from '../../ui/nav';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';
import { ApplyForm } from '../apply/ApplyForm';
import { useOpenRequest } from '../request/RequestDialog';
import { CompareBar, CompareDialog } from './compare';
import { startFilters, type Filters } from './planText';
import { Results } from './Results';
import { SearchCard, type Waited } from './SearchCard';
import { AboutSection, CareCard, CitiesSection, FaqSection, HowSection, PartnerIntro, RouterSection } from './sections';
import { Story } from './story';

const CITY_KEY = 'cb-city';
type Found = { results: Plan[]; areas: string[]; category: string; pin: string };

function HeroGrid() {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.35 }} pointerEvents="none">
      <Defs>
        <Pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <Path d="M44 0H0V44" fill="none" stroke="rgba(141,180,255,0.3)" strokeWidth="1" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

export default function HomeScreen() {
  const overlay = useOverlay();
  const router = useRouter();
  const { ready, user } = useSession();
  const { site } = useLocalSearchParams<{ site?: string }>();
  const openRequest = useOpenRequest();
  const scroll = useRef<ScrollViewInstance | null>(null);
  const offsets = useRef<Partial<Record<HomeSection | 'results', number>>>({});
  const wantResults = useRef(false);
  const cardY = useRef(0);

  const base = useLoad(async () => {
    const [cities, pins] = await Promise.all([API.cities(), API.popularPins().catch(() => [])]);
    return { cities, pins };
  }, []);
  const cities = base.data?.cities || [];

  const [chosenCity, setChosenCity] = useState('');
  const [product, setProduct] = useState('broadband');
  const [simType, setSimType] = useState('prepaid');
  const [pin, setPin] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [filters, setFilters] = useState<Filters>(startFilters([]));
  const [compare, setCompare] = useState<string[]>([]);
  const [waited, setWaited] = useState<Waited>(null);

  const city = cities.some((c) => c.id === chosenCity) ? chosenCity : cities.find((c) => c.status === 'live')?.id || cities[0]?.id || '';
  const cityName = cities.find((c) => c.id === city)?.name || 'your city';

  useEffect(() => {
    AsyncStorage.getItem(CITY_KEY)
      .then((saved) => saved && setChosenCity(saved))
      .catch(() => {});
  }, []);

  /* a signed-in DSA, TIP or admin opening the app goes to their dashboard; "Go to website" shows this page */
  const redirected = useRef(false);
  useEffect(() => {
    if (!ready || redirected.current) return;
    redirected.current = true;
    if (user && user.role !== 'customer' && site !== '1') router.push(ROLE_PATH[user.role]);
  }, [ready, user, site, router]);

  const scrollTo = useCallback((key: HomeSection | 'results') => {
    const y = key === 'search' ? 0 : offsets.current[key];
    if (y !== undefined) scroll.current?.scrollTo({ y, animated: true });
  }, []);
  useEffect(() => {
    const jump = () => {
      const section = takeSection();
      setTimeout(() => scrollTo(section || 'search'), 350); // no section = the top of the page, as on the website
    };
    jump();
    return onSectionRequest(jump);
  }, [scrollTo]);

  const reset = () => {
    setPin('');
    setFound(null);
    setCompare([]);
  };
  const show = (next: Found) => {
    setFound(next);
    setFilters(startFilters(next.results));
    setCompare([]);
    wantResults.current = true;
    // already on screen from an earlier search: no new layout event will come
    if (found && offsets.current.results !== undefined) setTimeout(() => scrollTo('results'), 120);
  };
  const category = (prod: string, sim: string) => (prod === 'broadband' ? 'fiber' : prod === 'sim' ? (sim === 'postpaid' ? 'sim_postpaid' : 'sim_prepaid') : prod);
  const search = async (value: string) => {
    const cat = category(product, simType);
    try {
      const r = await API.searchPlans(value, cat);
      show({ results: r.plans, areas: r.areas, category: cat, pin: value });
    } catch (e) {
      overlay.toast(errMsg(e), true);
    }
  };
  const showSim = async (type: string = simType) => {
    const cat = category('sim', type);
    try {
      setPin('');
      show({ results: await API.catalog(cat), areas: [], category: cat, pin: '' });
    } catch (e) {
      overlay.toast(errMsg(e), true);
    }
  };
  const pickCity = (id: string) => {
    setChosenCity(id);
    setWaited(null);
    reset();
    AsyncStorage.setItem(CITY_KEY, id).catch(() => {});
  };

  const request = (plan: Plan | null) => openRequest(plan, { product, pin: found?.pin || pin, area: found?.areas[0] || '', onDone: () => setCompare([]) });
  const toggleCompare = (id: string) => {
    if (compare.includes(id)) return setCompare(compare.filter((x) => x !== id));
    if (compare.length >= 3) return overlay.toast('You can compare up to 3 plans.');
    setCompare([...compare, id]);
  };
  const openCompare = () => {
    const plans = compare.map((id) => found?.results.find((p) => p.id === id)).filter((p): p is Plan => !!p);
    if (plans.length < 2) return overlay.toast('Select at least 2 plans to compare.');
    overlay.open(<CompareDialog plans={plans} pin={found?.pin || ''} onChoose={request} />);
  };
  const mark = (key: HomeSection | 'results', e: LayoutChangeEvent) => {
    offsets.current[key] = e.nativeEvent.layout.y;
    if (key === 'results' && wantResults.current) {
      wantResults.current = false;
      setTimeout(() => scrollTo('results'), 60);
    }
  };

  return (
    <Screen
      scrollRef={scroll}
      refreshing={base.refreshing}
      onRefresh={async () => {
        await base.refresh();
        if (found) await (found.pin ? search(found.pin) : showSim());
      }}
      floating={compare.length ? <CompareBar count={compare.length} onCompare={openCompare} onClear={() => setCompare([])} /> : undefined}>
      <View style={{ backgroundColor: colors.blueDeep, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 28, gap: 16 }}>
        <HeroGrid />
        <T f="display" s={30} w={800} lh={33} c={colors.white} accessibilityRole="header">
          Compare. Choose. Connect.{' '}
          <T f="display" s={30} w={800} lh={33} c={colors.sky}>Care.</T>
        </T>
        <View onLayout={(e) => (cardY.current = e.nativeEvent.layout.y)}>
        <SearchCard
          onPinFocus={(y) => setTimeout(() => scroll.current?.scrollTo({ y: cardY.current + y - 8, animated: true }), 350)}
          loading={base.loading}
          error={base.error}
          onRetry={() => base.reload()}
          cities={cities}
          city={city}
          setCity={pickCity}
          product={product}
          setProduct={(p) => {
            setProduct(p);
            reset();
          }}
          pins={(base.data?.pins || []).filter((p) => !p.city_id || !city || p.city_id === city)}
          pin={pin}
          setPin={setPin}
          onSearch={search}
          onShowSim={() => showSim()}
          simType={simType}
          setSimType={setSimType}
          onReset={reset}
          waited={waited}
          setWaited={setWaited}
        />
        </View>
        <View style={{ paddingHorizontal: 12, gap: 12 }}>
          <Story />
          <CareCard />
        </View>
        <View style={{ gap: 6 }}>
          {['Free for customers', 'BSNL TIPs, DSAs & local ISPs', 'Installation tracked end to end'].map((x) => (
            <Row key={x} wrap={false} gap={9}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sky }} />
              <T s={14} c={colors.heroText} style={{ flexShrink: 1 }}>{x}</T>
            </Row>
          ))}
        </View>
        <Row gap={10}>
          <Button label="Test your Wi-Fi speed →" variant="hero" small onPress={() => goTo('/speed')} />
          <Button label="Care plan →" variant="gold" small icon={<Heart size={13} color="#3B2300" fill="#3B2300" />} onPress={() => goTo('/care')} />
        </Row>
      </View>
      {found ? (
        <View onLayout={(e) => mark('results', e)}>
          <Results
            results={found.results}
            category={found.category}
            pin={found.pin}
            areas={found.areas}
            cityName={cityName}
            filters={filters}
            setFilters={setFilters}
            compare={compare}
            onCompare={toggleCompare}
            onRequest={request}
            simType={simType}
            onSimType={(t) => {
              setSimType(t);
              showSim(t);
            }}
            onChooseCity={() => scrollTo('search')}
          />
        </View>
      ) : null}
      <HowSection tight={!!found} />
      <View onLayout={(e) => mark('cities', e)}>
        <CitiesSection
          cities={cities}
          city={city}
          onPick={(id) => {
            pickCity(id);
            scrollTo('search');
          }}
          onRegister={() => scrollTo('partners')}
        />
      </View>
      <RouterSection />
      <View onLayout={(e) => mark('partners', e)}>
        <Section top={0} style={{ gap: 16 }}>
          <PartnerIntro />
          <ApplyForm cities={cities} city={city} />
        </Section>
      </View>
      <FaqSection onLayout={(e) => mark('faq', e)} />
      <AboutSection />
    </Screen>
  );
}
