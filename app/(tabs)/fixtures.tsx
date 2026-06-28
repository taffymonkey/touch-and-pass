import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import FixtureRow, { FixtureLite } from '@/components/rugby/FixtureRow';
import CompetitionHeader from '@/components/rugby/CompetitionHeader';
import SkeletonLoader from '@/components/rugby/SkeletonLoader';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN,
} from '@/constants/Colors';

type FilterType = 'upcoming' | 'all' | 'completed';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

interface Section {
  title: string;
  data: FixtureLite[];
}

export default function FixturesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [fixtures, setFixtures] = useState<FixtureLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFixtures = useCallback(async () => {
    console.log('[Fixtures] Fetching all fixtures');
    const { data, error } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url),
        away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url),
        competition:competitions(id, name),
        match_events(id, event_type, owning_team_id)
      `)
      .order('match_date', { ascending: true });

    if (error) {
      console.log('[Fixtures] Fetch error:', error.message);
    } else {
      console.log('[Fixtures] Fetched', data?.length ?? 0, 'fixtures');
    }
    return (data ?? []) as FixtureLite[];
  }, []);

  const loadFixtures = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const data = await fetchFixtures();
    setFixtures(data);
    if (!isRefresh) setLoading(false);
    setRefreshing(false);
  }, [fetchFixtures]);

  useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFixtures(true);
  };

  const handleFilterPress = (f: FilterType) => {
    console.log('[Fixtures] Filter changed to:', f);
    setFilter(f);
  };

  const handleFixturePress = (id: string) => {
    console.log('[Fixtures] Fixture pressed:', id);
    router.push(`/match/${id}`);
  };

  const filtered = fixtures.filter(f => {
    if (filter === 'upcoming') return f.status === 'upcoming' || f.status === 'in_progress';
    if (filter === 'completed') return f.status === 'completed';
    return true;
  });

  const sections: Section[] = [];
  const monthMap = new Map<string, FixtureLite[]>();
  filtered.forEach(f => {
    const key = getMonthKey(f.match_date);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(f);
  });
  monthMap.forEach((data, title) => sections.push({ title, data }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fixtures</Text>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filter === f.key && styles.filterPillActive]}
            onPress={() => handleFilterPress(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map(i => (
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
              <Text style={styles.emptyText}>No {filter} fixtures</Text>
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
  safe: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  filterStrip: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: CARD_BG,
  },
  filterPillActive: {
    backgroundColor: BRAND_GREEN,
    borderColor: BRAND_GREEN,
  },
  filterText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  skeletonContainer: {
    padding: 16,
    gap: 8,
  },
  skeletonItem: {
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
});
