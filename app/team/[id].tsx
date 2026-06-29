import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/app/integrations/supabase/client';
import TeamBadge from '@/components/rugby/TeamBadge';
import FixtureRow, { FixtureLite } from '@/components/rugby/FixtureRow';
import CompetitionHeader from '@/components/rugby/CompetitionHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN, LIVE_GREEN,
} from '@/constants/Colors';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface TeamDetail {
  id: string;
  name: string;
  club_id: string;
  primary_color: string | null;
  logo_url: string | null;
  home_kit_image_url: string | null;
  away_kit_image_url: string | null;
  is_subscribed: boolean;
  age_group: string | null;
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    home_kit_image_url: string | null;
    away_kit_image_url: string | null;
  } | null;
}

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  jersey_number: number | null;
  photo_url: string | null;
  public_profile: boolean;
  team_role: string | null;
}

const TABS = ['Overview', 'Fixtures', 'Squad'];
const FIXTURE_FILTERS = ['upcoming', 'all', 'completed'] as const;
type FixtureFilter = typeof FIXTURE_FILTERS[number];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function computeScore(events: { event_type: string; owning_team_id: string | null }[], teamId: string): number {
  return events
    .filter(e => e.owning_team_id === teamId)
    .reduce((sum, e) => {
      if (e.event_type === 'try') return sum + 5;
      if (e.event_type === 'conversion') return sum + 2;
      if (e.event_type === 'penalty') return sum + 3;
      if (e.event_type === 'drop_goal') return sum + 3;
      return sum;
    }, 0);
}

export default function TeamProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [fixtures, setFixtures] = useState<FixtureLite[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [fixtureFilter, setFixtureFilter] = useState<FixtureFilter>('upcoming');
  const [isFavourite, setIsFavourite] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    if (!id) return;
    console.log('[Team] Fetching team data for id:', id);
    const [teamRes, fixturesRes, registrationsRes] = await Promise.all([
      supabase.from('teams').select(`*, club:clubs(*)`).eq('id', id).single(),
      supabase
        .from('fixtures')
        .select(`*, home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url), away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url), competition:competitions(id, name), match_events(id, event_type, owning_team_id)`)
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order('match_date', { ascending: false }),
      supabase
        .from('player_team_registrations')
        .select(`player:players(*)`)
        .eq('team_id', id),
    ]);

    if (teamRes.error) console.log('[Team] Team fetch error:', teamRes.error.message);
    if (fixturesRes.error) console.log('[Team] Fixtures fetch error:', fixturesRes.error.message);
    if (registrationsRes.error) console.log('[Team] Registrations fetch error:', registrationsRes.error.message);

    setTeam(teamRes.data as TeamDetail | null);
    setFixtures((fixturesRes.data ?? []) as FixtureLite[]);

    const rawPlayers = (registrationsRes.data ?? [])
      .map((r: { player: PlayerRow | null }) => r.player)
      .filter((p): p is PlayerRow => p !== null && p.public_profile === true);
    setPlayers(rawPlayers);
    setLoading(false);
    console.log('[Team] Data loaded, fixtures:', fixturesRes.data?.length ?? 0, 'players:', rawPlayers.length);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('fan_favourites')
      .select('id')
      .eq('user_id', user.id)
      .eq('entity_type', 'team')
      .eq('entity_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user, id]);

  const handleTabPress = (index: number) => {
    console.log('[Team] Tab pressed:', TABS[index]);
    setActiveTab(index);
    Animated.spring(tabAnim, { toValue: index, useNativeDriver: true, damping: 20, stiffness: 120 }).start();
  };

  const handleBack = () => {
    console.log('[Team] Back button pressed');
    router.back();
  };

  const handleFavourite = async () => {
    console.log('[Team] Favourite button pressed');
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save favourites');
      return;
    }
    if (isFavourite) {
      await supabase.from('fan_favourites').delete().eq('user_id', user.id).eq('entity_type', 'team').eq('entity_id', id!);
      setIsFavourite(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('fan_favourites').upsert({ user_id: user.id, entity_type: 'team', entity_id: id! } as any);
      setIsFavourite(true);
    }
  };

  const handlePlayerPress = (playerId: string) => {
    console.log('[Team] Player pressed:', playerId);
    router.push(`/player/${playerId}`);
  };

  const handleFixturePress = (fixtureId: string) => {
    console.log('[Team] Fixture pressed:', fixtureId);
    router.push(`/match/${fixtureId}`);
  };

  const handleFixtureFilterPress = (f: FixtureFilter) => {
    console.log('[Team] Fixture filter changed to:', f);
    setFixtureFilter(f);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Team not found</Text>
      </View>
    );
  }

  const primaryColor = team.primary_color ?? BRAND_GREEN;
  const completedFixtures = fixtures.filter(f => f.status === 'completed');
  const last5 = completedFixtures.slice(0, 5);
  const nextFixture = fixtures.find(f => f.status === 'upcoming' || f.status === 'in_progress');

  const wins = completedFixtures.filter(f => {
    const events = f.match_events ?? [];
    const myScore = computeScore(events, id!);
    const oppId = f.home_team?.id === id ? f.away_team?.id ?? '' : f.home_team?.id ?? '';
    const oppScore = computeScore(events, oppId);
    return myScore > oppScore;
  }).length;
  const losses = completedFixtures.filter(f => {
    const events = f.match_events ?? [];
    const myScore = computeScore(events, id!);
    const oppId = f.home_team?.id === id ? f.away_team?.id ?? '' : f.home_team?.id ?? '';
    const oppScore = computeScore(events, oppId);
    return myScore < oppScore;
  }).length;

  const allEvents = fixtures.flatMap(f => (f.match_events ?? []).map(e => ({ ...e, fixture: f })));
  const teamEvents = allEvents.filter(e => e.owning_team_id === id);
  const totalTries = teamEvents.filter(e => e.event_type === 'try').length;
  const totalConversions = teamEvents.filter(e => e.event_type === 'conversion').length;
  const totalPenalties = teamEvents.filter(e => e.event_type === 'penalty').length;
  const totalDropGoals = teamEvents.filter(e => e.event_type === 'drop_goal').length;
  const totalFor = totalTries * 5 + totalConversions * 2 + totalPenalties * 3 + totalDropGoals * 3;
  const totalAgainst = allEvents
    .filter(e => e.owning_team_id !== id && (e.event_type === 'try' || e.event_type === 'conversion' || e.event_type === 'penalty' || e.event_type === 'drop_goal'))
    .reduce((sum, e) => {
      if (e.event_type === 'try') return sum + 5;
      if (e.event_type === 'conversion') return sum + 2;
      if (e.event_type === 'penalty') return sum + 3;
      if (e.event_type === 'drop_goal') return sum + 3;
      return sum;
    }, 0);

  // Squad sections
  const forwards = players.filter(p => {
    const pos = (p.position ?? '').toLowerCase();
    return pos.includes('prop') || pos.includes('hooker') || pos.includes('lock') || pos.includes('flanker') || pos.includes('number 8') || pos.includes('no. 8') || pos.includes('forward');
  });
  const backs = players.filter(p => {
    const pos = (p.position ?? '').toLowerCase();
    return pos.includes('scrum') || pos.includes('fly') || pos.includes('centre') || pos.includes('wing') || pos.includes('fullback') || pos.includes('back');
  });
  const other = players.filter(p => !forwards.includes(p) && !backs.includes(p));

  // Filtered fixtures for Fixtures tab
  const filteredFixtures = fixtures.filter(f => {
    if (fixtureFilter === 'upcoming') return f.status === 'upcoming' || f.status === 'in_progress';
    if (fixtureFilter === 'completed') return f.status === 'completed';
    return true;
  });

  const fixturesByMonth = new Map<string, FixtureLite[]>();
  [...filteredFixtures].reverse().forEach(f => {
    const key = getMonthKey(f.match_date);
    if (!fixturesByMonth.has(key)) fixturesByMonth.set(key, []);
    fixturesByMonth.get(key)!.push(f);
  });

  const tabIndicatorWidth = 100;
  const tabIndicatorTranslate = tabAnim.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [0, tabIndicatorWidth * (TABS.length - 1)],
  });

  const renderSquadSection = (title: string, sectionPlayers: PlayerRow[]) => {
    if (sectionPlayers.length === 0) return null;
    return (
      <View key={title}>
        <View style={styles.squadSectionHeader}>
          <Text style={styles.squadSectionTitle}>{title}</Text>
        </View>
        {sectionPlayers.map(p => (
          <TouchableOpacity key={p.id} style={styles.playerRow} onPress={() => handlePlayerPress(p.id)}>
            <View style={styles.jerseyBadge}>
              <Text style={styles.jerseyNum}>{p.jersey_number ?? '—'}</Text>
            </View>
            <View style={styles.playerInitials}>
              <Text style={styles.playerInitialsText}>
                {(p.first_name[0] + p.last_name[0]).toUpperCase()}
              </Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{p.first_name} {p.last_name}</Text>
              {p.position && <Text style={styles.playerPos}>{p.position}</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero */}
      <LinearGradient
        colors={[primaryColor, `${primaryColor}88`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroOverlay}>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroTop}>
              <TouchableOpacity style={styles.circleBtn} onPress={handleBack}>
                <Text style={styles.circleBtnText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} onPress={handleFavourite}>
                <Text style={[styles.circleBtnText, isFavourite && styles.starActive]}>
                  {isFavourite ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroContent}>
              {/* Kit panels */}
              <View style={styles.kitPanel}>
                {(team.home_kit_image_url || team.club?.home_kit_image_url) ? (
                  <View style={styles.kitImageWrapper}>
                    <Image source={{ uri: team.home_kit_image_url ?? team.club?.home_kit_image_url ?? '' }} style={styles.kitImage} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={[styles.kitPlaceholder, { backgroundColor: primaryColor }]}>
                    <Text style={styles.kitPlaceholderText}>Home</Text>
                  </View>
                )}
              </View>

              <View style={styles.heroCentre}>
                <TeamBadge logoUrl={team.club?.logo_url} name={team.club?.name ?? team.name} primaryColor={team.club?.primary_color} size={56} />
                <Text style={styles.clubName}>{team.club?.name ?? ''}</Text>
                <Text style={styles.teamName}>{team.name}</Text>
                {team.age_group && (
                  <View style={styles.agePill}>
                    <Text style={styles.agePillText}>{team.age_group}</Text>
                  </View>
                )}
              </View>

              <View style={styles.kitPanel}>
                {(team.away_kit_image_url || team.club?.away_kit_image_url) ? (
                  <View style={styles.kitImageWrapper}>
                    <Image source={{ uri: team.away_kit_image_url ?? team.club?.away_kit_image_url ?? '' }} style={styles.kitImage} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={[styles.kitPlaceholder, { backgroundColor: `${primaryColor}66` }]}>
                    <Text style={styles.kitPlaceholderText}>Away</Text>
                  </View>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </LinearGradient>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => handleTabPress(i)}>
            <Text style={[styles.tabLabel, activeTab === i && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabIndicatorWidth, transform: [{ translateX: tabIndicatorTranslate }] },
          ]}
        />
      </View>

      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
        {/* Overview */}
        {activeTab === 0 && (
          <View style={styles.overviewTab}>
            {nextFixture && (
              <View style={styles.overviewSection}>
                <Text style={styles.overviewSectionTitle}>Next Fixture</Text>
                <FixtureRow fixture={nextFixture} onPress={() => handleFixturePress(nextFixture.id)} teamId={id} />
              </View>
            )}

            {last5.length > 0 && (
              <View style={styles.overviewSection}>
                <Text style={styles.overviewSectionTitle}>Last 5 Games</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.last5Row}>
                  {last5.map(f => {
                    const events = f.match_events ?? [];
                    const myScore = computeScore(events, id!);
                    const oppId = f.home_team?.id === id ? f.away_team?.id ?? '' : f.home_team?.id ?? '';
                    const oppScore = computeScore(events, oppId);
                    const result = myScore > oppScore ? 'W' : myScore === oppScore ? 'D' : 'L';
                    const resultColor = result === 'W' ? LIVE_GREEN : result === 'D' ? '#f59e0b' : '#ef4444';
                    const opp = f.home_team?.id === id ? f.away_team : f.home_team;
                    return (
                      <TouchableOpacity key={f.id} style={styles.last5Card} onPress={() => handleFixturePress(f.id)}>
                        <View style={[styles.last5Result, { backgroundColor: resultColor }]}>
                          <Text style={styles.last5ResultText}>{result}</Text>
                        </View>
                        <TeamBadge logoUrl={opp?.logo_url} name={opp?.name ?? '?'} primaryColor={opp?.primary_color} size={28} />
                        <Text style={styles.last5Score}>{myScore}–{oppScore}</Text>
                        <Text style={styles.last5Date}>{formatShortDate(f.match_date)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.overviewSection}>
              <Text style={styles.overviewSectionTitle}>Season Stats</Text>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Played', value: completedFixtures.length },
                  { label: 'Wins', value: wins },
                  { label: 'Losses', value: losses },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Tries', value: totalTries },
                  { label: 'Conversions', value: totalConversions },
                  { label: 'Penalties', value: totalPenalties },
                  { label: 'Drop Goals', value: totalDropGoals },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.statsGrid}>
                {[
                  { label: 'Points For', value: totalFor },
                  { label: 'Points Against', value: totalAgainst },
                  { label: 'Diff', value: totalFor - totalAgainst },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={[styles.statValue, s.label === 'Diff' && (totalFor - totalAgainst) >= 0 ? styles.statPositive : styles.statNegative]}>
                      {s.label === 'Diff' && (totalFor - totalAgainst) > 0 ? '+' : ''}{s.value}
                    </Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Fixtures */}
        {activeTab === 1 && (
          <View style={styles.fixturesTab}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FIXTURE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, fixtureFilter === f && styles.filterPillActive]}
                  onPress={() => handleFixtureFilterPress(f)}
                >
                  <Text style={[styles.filterText, fixtureFilter === f && styles.filterTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredFixtures.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No {fixtureFilter} fixtures</Text>
              </View>
            ) : (
              Array.from(fixturesByMonth.entries()).map(([month, monthFixtures]) => (
                <View key={month}>
                  <CompetitionHeader name={month} />
                  {monthFixtures.map(f => (
                    <FixtureRow key={f.id} fixture={f} onPress={() => handleFixturePress(f.id)} teamId={id} />
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {/* Squad */}
        {activeTab === 2 && (
          <View style={styles.squadTab}>
            {players.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No public player profiles</Text>
              </View>
            ) : (
              <>
                {renderSquadSection('Forwards', forwards)}
                {renderSquadSection('Backs', backs)}
                {renderSquadSection('Other', other)}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  loadingContainer: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TEXT_SECONDARY, fontSize: 16 },
  hero: { minHeight: 250 },
  heroOverlay: { backgroundColor: 'rgba(0,0,0,0.4)', flex: 1 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  starActive: { color: '#f59e0b' },
  heroContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  kitPanel: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  kitImage: {
    width: 90,
    height: 115,
  },
  kitPlaceholder: {
    width: 90,
    height: 115,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  kitImageWrapper: {
    borderWidth: 1.5,
    borderColor: '#ADD8E6',
    borderRadius: 6,
    padding: 2,
  },
  kitPlaceholderText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroCentre: { flex: 2, alignItems: 'center', gap: 6 },
  clubName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  agePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  agePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, position: 'relative' },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: BRAND_GREEN },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: BRAND_GREEN, borderRadius: 1 },
  tabContent: { flex: 1 },
  tabContentInner: { paddingBottom: 120 },
  overviewTab: { padding: 16, gap: 16 },
  overviewSection: { gap: 8 },
  overviewSectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  last5Row: { gap: 8, paddingVertical: 4 },
  last5Card: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER_COLOR, padding: 12, alignItems: 'center', gap: 6, width: 80 },
  last5Result: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  last5ResultText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  last5Score: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  last5Date: { color: TEXT_SECONDARY, fontSize: 10 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER_COLOR, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  statPositive: { color: LIVE_GREEN },
  statNegative: { color: '#ef4444' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  fixturesTab: { paddingTop: 8 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER_COLOR, backgroundColor: CARD_BG },
  filterPillActive: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
  filterText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  squadTab: {},
  squadSectionHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: DARK_BG, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  squadSectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, gap: 10 },
  jerseyBadge: { width: 28, height: 28, borderRadius: 6, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center' },
  jerseyNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  playerInitials: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER_COLOR, alignItems: 'center', justifyContent: 'center' },
  playerInitialsText: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  playerPos: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },
});
