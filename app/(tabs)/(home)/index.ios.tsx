// Re-export the shared Scores screen for iOS
// NOTE: This is a full copy to avoid circular import issues with Metro's platform resolution
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import FixtureRow, { FixtureLite } from '@/components/rugby/FixtureRow';
import CompetitionHeader from '@/components/rugby/CompetitionHeader';
import SkeletonLoader from '@/components/rugby/SkeletonLoader';
import { NotificationBell } from "@/components/NotificationBell";
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY,
  BRAND_GREEN, LIVE_RED,
} from '@/constants/Colors';

function getDayStrip() {
  const days: Date[] = [];
  const today = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Section {
  title: string;
  data: FixtureLite[];
}

export default function ScoresScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [fixtures, setFixtures] = useState<FixtureLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [livePulse]);

  const fetchFixtures = useCallback(async (date: Date) => {
    const dateStr = toDateString(date);
    const start = `${dateStr}T00:00:00`;
    const end = `${dateStr}T23:59:59`;
    console.log('[Scores] Fetching fixtures for date:', dateStr);
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url),
        away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url),
        competition:competitions(id, name),
        match_events(id, event_type, owning_team_id, minute)
      `)
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true });

    if (error) {
      console.log('[Scores] Fetch error:', error.message);
    } else {
      console.log('[Scores] Fetched', data?.length ?? 0, 'fixtures');
    }
    return (data ?? []) as FixtureLite[];
  }, []);

  const loadFixtures = useCallback(async (date: Date, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const data = await fetchFixtures(date);
    setFixtures(data);
    if (!isRefresh) setLoading(false);
    setRefreshing(false);
  }, [fetchFixtures]);

  useEffect(() => {
    loadFixtures(selectedDate);
  }, [selectedDate, loadFixtures]);

  useEffect(() => {
    const dateStr = toDateString(selectedDate);
    console.log('[Scores] Setting up realtime subscription for:', dateStr);
    const channel = supabase
      .channel(`fixtures-ios-${dateStr}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures' }, () => {
        console.log('[Scores] Realtime fixture change received, refetching');
        loadFixtures(selectedDate, true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, loadFixtures]);

  const toggleSearch = () => {
    console.log('[Scores] Toggle search:', !searchVisible);
    const toValue = searchVisible ? 0 : 1;
    setSearchVisible(!searchVisible);
    Animated.timing(searchAnim, { toValue, duration: 200, useNativeDriver: false }).start();
    if (searchVisible) setSearchText('');
  };

  const toggleLive = () => {
    console.log('[Scores] Toggle live filter:', !liveOnly);
    setLiveOnly(!liveOnly);
  };

  const handleDayPress = (day: Date) => {
    console.log('[Scores] Day selected:', toDateString(day));
    setSelectedDate(day);
  };

  const handleFixturePress = (id: string) => {
    console.log('[Scores] Fixture pressed:', id);
    router.push(`/match/${id}`);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFixtures(selectedDate, true);
  };

  const filtered = fixtures.filter(f => {
    if (liveOnly && f.status !== 'in_progress') return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const homeName = f.home_team?.name?.toLowerCase() ?? '';
      const awayName = f.away_team?.name?.toLowerCase() ?? '';
      const compName = f.competition?.name?.toLowerCase() ?? '';
      if (!homeName.includes(q) && !awayName.includes(q) && !compName.includes(q)) return false;
    }
    return true;
  });

  const sections: Section[] = [];
  const compMap = new Map<string, FixtureLite[]>();
  filtered.forEach(f => {
    const key = f.competition?.name ?? 'Other';
    if (!compMap.has(key)) compMap.set(key, []);
    compMap.get(key)!.push(f);
  });
  compMap.forEach((data, title) => sections.push({ title, data }));

  const days = getDayStrip();
  const todayStr = toDateString(new Date());
  const selectedStr = toDateString(selectedDate);

  const searchHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/7ed917ba-da4b-4f6c-8254-196108fe23ea.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleSearch}>
            <Text style={styles.iconText}>🔍</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      <Animated.View style={[styles.searchContainer, { height: searchHeight, overflow: 'hidden' }]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams or competitions..."
          placeholderTextColor={TEXT_SECONDARY}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
        />
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayStrip}
        contentContainerStyle={styles.dayStripContent}
      >
        {days.map((day, i) => {
          const ds = toDateString(day);
          const isSelected = ds === selectedStr;
          const isToday = ds === todayStr;
          const hasFixtures = fixtures.some(f => f.match_date.startsWith(ds));
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayItem, isSelected && styles.dayItemSelected]}
              onPress={() => handleDayPress(day)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                {isToday ? 'Today' : DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayTextSelected]}>
                {day.getDate()}
              </Text>
              {hasFixtures && (
                <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.livePill, liveOnly && styles.livePillActive]}
          onPress={toggleLive}
        >
          <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
          <Text style={[styles.livePillText, liveOnly && styles.livePillTextActive]}>LIVE</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map(i => (
            <SkeletonLoader key={i} width="100%" height={72} borderRadius={12} style={styles.skeletonItem} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FixtureRow
              fixture={item}
              onPress={() => handleFixturePress(item.id)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <CompetitionHeader name={section.title} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No fixtures for this date</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK_BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerLogo: { width: 140, height: 36 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER_COLOR },
  iconText: { fontSize: 16 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { backgroundColor: CARD_BG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: TEXT_PRIMARY, fontSize: 14, borderWidth: 1, borderColor: BORDER_COLOR },
  dayStrip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  dayStripContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  dayItem: { width: 52, alignItems: 'center', paddingVertical: 8, borderRadius: 10, gap: 2 },
  dayItemSelected: { backgroundColor: BRAND_GREEN },
  dayName: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  dayNum: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  dayTextSelected: { color: '#fff' },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BRAND_GREEN, marginTop: 2 },
  dayDotSelected: { backgroundColor: '#fff' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: BORDER_COLOR, backgroundColor: CARD_BG },
  livePillActive: { borderColor: LIVE_RED, backgroundColor: 'rgba(239,68,68,0.1)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIVE_RED },
  livePillText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  livePillTextActive: { color: LIVE_RED },
  skeletonContainer: { padding: 16, gap: 8 },
  skeletonItem: { marginBottom: 4 },
  listContent: { paddingBottom: 120 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },
});
