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
import EventIcon from '@/components/rugby/EventIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN,
} from '@/constants/Colors';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface PublicPlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  secondary_position: string | null;
  jersey_number: number | null;
  photo_url: string | null;
  nationality: string | null;
  team_role: string | null;
}

interface PlayerEvent {
  id: string;
  event_type: string;
  owning_team_id: string | null;
  minute: number | null;
  fixture: {
    id: string;
    match_date: string;
    status: string;
    home_team: { id: string; name: string; primary_color: string | null; logo_url: string | null } | null;
    away_team: { id: string; name: string; primary_color: string | null; logo_url: string | null } | null;
  } | null;
}

interface Registration {
  player_id: string;
  team_id: string;
  is_primary: boolean;
  team: {
    id: string;
    name: string;
    age_group: string | null;
    primary_color: string | null;
    logo_url: string | null;
    club: {
      id: string;
      name: string;
      logo_url: string | null;
      primary_color: string | null;
    } | null;
  } | null;
}

const TABS = ['Overview', 'History'];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function computeScoreForTeam(events: PlayerEvent[], teamId: string): number {
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

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [events, setEvents] = useState<PlayerEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [isFavourite, setIsFavourite] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    if (!id) return;
    console.log('[Player] Fetching player data for id:', id);
    const [playerRes, eventsRes, registrationsRes] = await Promise.all([
      supabase.from('public_players').select('*').eq('id', id).single(),
      supabase
        .from('match_events')
        .select(`*, fixture:fixtures(id, match_date, status, home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url), away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url))`)
        .eq('owning_player_id', id),
      supabase
        .from('player_team_registrations')
        .select(`*, team:teams(id, name, age_group, primary_color, logo_url, club:clubs(id, name, logo_url, primary_color))`)
        .eq('player_id', id),
    ]);

    if (playerRes.error) console.log('[Player] Player fetch error:', playerRes.error.message);
    if (eventsRes.error) console.log('[Player] Events fetch error:', eventsRes.error.message);
    if (registrationsRes.error) console.log('[Player] Registrations fetch error:', registrationsRes.error.message);

    setPlayer(playerRes.data as PublicPlayer | null);
    setEvents((eventsRes.data ?? []) as PlayerEvent[]);
    setRegistrations((registrationsRes.data ?? []) as Registration[]);
    setLoading(false);
    console.log('[Player] Data loaded, events:', eventsRes.data?.length ?? 0);
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
      .eq('entity_type', 'player')
      .eq('entity_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user, id]);

  const handleTabPress = (index: number) => {
    console.log('[Player] Tab pressed:', TABS[index]);
    setActiveTab(index);
    Animated.spring(tabAnim, { toValue: index, useNativeDriver: true, damping: 20, stiffness: 120 }).start();
  };

  const handleBack = () => {
    console.log('[Player] Back button pressed');
    router.back();
  };

  const handleFavourite = async () => {
    console.log('[Player] Favourite button pressed');
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save favourites');
      return;
    }
    if (isFavourite) {
      await supabase.from('fan_favourites').delete().eq('user_id', user.id).eq('entity_type', 'player').eq('entity_id', id!);
      setIsFavourite(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('fan_favourites').upsert({ user_id: user.id, entity_type: 'player', entity_id: id! } as any);
      setIsFavourite(true);
    }
  };

  const handleFixturePress = (fixtureId: string) => {
    console.log('[Player] Fixture pressed:', fixtureId);
    router.push(`/match/${fixtureId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (!player) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Player not found</Text>
      </View>
    );
  }

  // Stats computation
  const uniqueFixtureIds = new Set(events.map(e => e.fixture?.id).filter(Boolean));
  const appearances = uniqueFixtureIds.size;
  const tries = events.filter(e => e.event_type === 'try').length;
  const conversions = events.filter(e => e.event_type === 'conversion').length;
  const penalties = events.filter(e => e.event_type === 'penalty').length;
  const dropGoals = events.filter(e => e.event_type === 'drop_goal').length;
  const yellowCards = events.filter(e => e.event_type === 'yellow_card').length;
  const redCards = events.filter(e => e.event_type === 'red_card').length;
  const points = tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3;

  // Recent 5 fixtures
  const fixtureMap = new Map<string, { fixture: PlayerEvent['fixture']; events: PlayerEvent[] }>();
  events.forEach(e => {
    if (!e.fixture?.id) return;
    if (!fixtureMap.has(e.fixture.id)) {
      fixtureMap.set(e.fixture.id, { fixture: e.fixture, events: [] });
    }
    fixtureMap.get(e.fixture.id)!.events.push(e);
  });
  const recentFixtures = Array.from(fixtureMap.values())
    .sort((a, b) => new Date(b.fixture?.match_date ?? '').getTime() - new Date(a.fixture?.match_date ?? '').getTime())
    .slice(0, 5);

  const primaryReg = registrations.find(r => r.is_primary) ?? registrations[0];
  const primaryTeam = primaryReg?.team;
  const primaryColor = primaryTeam?.primary_color ?? BRAND_GREEN;

  const fullName = `${player.first_name} ${player.last_name}`.toUpperCase();
  const jerseyNum = player.jersey_number?.toString() ?? '';

  const tabIndicatorWidth = 160;
  const tabIndicatorTranslate = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabIndicatorWidth],
  });

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <View style={styles.hero}>
        {/* Left: photo or colour */}
        <View style={[styles.heroLeft, { backgroundColor: primaryColor }]}>
          {player.photo_url ? (
            <Image source={resolveImageSource(player.photo_url)} style={styles.heroPhoto} resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroPhotoGradient}
          />
          {jerseyNum !== '' && <Text style={styles.heroJerseyNum}>{jerseyNum}</Text>}
        </View>

        {/* Right: info */}
        <View style={styles.heroRight}>
          <TeamBadge
            logoUrl={primaryTeam?.club?.logo_url ?? primaryTeam?.logo_url}
            name={primaryTeam?.club?.name ?? primaryTeam?.name ?? '?'}
            primaryColor={primaryTeam?.club?.primary_color ?? primaryTeam?.primary_color}
            size={44}
          />
          <Text style={styles.heroName}>{fullName}</Text>
          {player.position && (
            <View style={styles.positionChip}>
              <Text style={styles.positionChipText}>{player.position}</Text>
            </View>
          )}
          {player.secondary_position && (
            <Text style={styles.secondaryPos}>{player.secondary_position}</Text>
          )}
          {player.nationality && (
            <Text style={styles.nationality}>{player.nationality}</Text>
          )}
          <View style={styles.heroSeparator} />
          {primaryTeam && (
            <Text style={styles.clubNameText}>{primaryTeam.club?.name ?? primaryTeam.name}</Text>
          )}
        </View>

        {/* Overlay buttons */}
        <SafeAreaView style={styles.heroButtons} edges={['top']}>
          <TouchableOpacity style={styles.circleBtn} onPress={handleBack}>
            <Text style={styles.circleBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={handleFavourite}>
            <Text style={[styles.circleBtnText, isFavourite && styles.starActive]}>
              {isFavourite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

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
        {/* Overview tab */}
        {activeTab === 0 && (
          <View style={styles.overviewTab}>
            <View style={styles.statsRow}>
              <View style={styles.statsLeft}>
                <Text style={styles.statsSectionTitle}>Stats</Text>
                {[
                  { label: 'Appearances', value: appearances },
                  { label: 'Points', value: points },
                  { label: 'Tries', value: tries },
                  { label: 'Conversions', value: conversions },
                  { label: 'Penalties', value: penalties },
                  { label: 'Drop Goals', value: dropGoals },
                  { label: 'Yellow Cards', value: yellowCards },
                  { label: 'Red Cards', value: redCards },
                ].map(s => (
                  <View key={s.label} style={styles.statItem}>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={styles.statValue}>{s.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.statsRight}>
                <Text style={styles.statsSectionTitle}>Recent</Text>
                {recentFixtures.length === 0 ? (
                  <Text style={styles.noDataText}>No appearances</Text>
                ) : (
                  recentFixtures.map(({ fixture, events: fEvents }) => {
                    if (!fixture) return null;
                    const homeId = fixture.home_team?.id ?? '';
                    const awayId = fixture.away_team?.id ?? '';
                    const homeScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), homeId);
                    const awayScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), awayId);
                    return (
                      <TouchableOpacity
                        key={fixture.id}
                        style={styles.recentCard}
                        onPress={() => handleFixturePress(fixture.id)}
                      >
                        <Text style={styles.recentDate}>{formatShortDate(fixture.match_date)}</Text>
                        <View style={styles.recentTeams}>
                          <TeamBadge logoUrl={fixture.home_team?.logo_url} name={fixture.home_team?.name ?? '?'} primaryColor={fixture.home_team?.primary_color} size={20} />
                          <Text style={styles.recentScore}>{homeScore}–{awayScore}</Text>
                          <TeamBadge logoUrl={fixture.away_team?.logo_url} name={fixture.away_team?.name ?? '?'} primaryColor={fixture.away_team?.primary_color} size={20} />
                        </View>
                        <View style={styles.recentEvents}>
                          {fEvents.slice(0, 3).map(e => (
                            <EventIcon key={e.id} type={e.event_type} size={16} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* Squads */}
            {registrations.length > 0 && (
              <View style={styles.squadsSection}>
                <Text style={styles.statsSectionTitle}>Squads</Text>
                {registrations.map(reg => (
                  <View key={reg.team_id} style={styles.squadRow}>
                    <TeamBadge
                      logoUrl={reg.team?.logo_url}
                      name={reg.team?.name ?? '?'}
                      primaryColor={reg.team?.primary_color}
                      size={36}
                    />
                    <View style={styles.squadInfo}>
                      <Text style={styles.squadTeamName}>{reg.team?.name}</Text>
                      {reg.team?.age_group && (
                        <Text style={styles.squadAgeGroup}>{reg.team.age_group}</Text>
                      )}
                    </View>
                    {reg.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* History tab */}
        {activeTab === 1 && (
          <View style={styles.historyTab}>
            {registrations.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Teams Played For</Text>
                {registrations.map(reg => (
                  <View key={reg.team_id} style={styles.historyTeamRow}>
                    <TeamBadge
                      logoUrl={reg.team?.logo_url}
                      name={reg.team?.name ?? '?'}
                      primaryColor={reg.team?.primary_color}
                      size={36}
                    />
                    <View style={styles.historyTeamInfo}>
                      <Text style={styles.historyTeamName}>{reg.team?.name}</Text>
                      {reg.team?.age_group && (
                        <Text style={styles.historyTeamMeta}>{reg.team.age_group}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>All Games</Text>
              {recentFixtures.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No game history</Text>
                </View>
              ) : (
                Array.from(fixtureMap.values())
                  .sort((a, b) => new Date(b.fixture?.match_date ?? '').getTime() - new Date(a.fixture?.match_date ?? '').getTime())
                  .map(({ fixture, events: fEvents }) => {
                    if (!fixture) return null;
                    const homeId = fixture.home_team?.id ?? '';
                    const awayId = fixture.away_team?.id ?? '';
                    const homeScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), homeId);
                    const awayScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), awayId);
                    return (
                      <TouchableOpacity
                        key={fixture.id}
                        style={styles.historyGameRow}
                        onPress={() => handleFixturePress(fixture.id)}
                      >
                        <Text style={styles.historyDate}>{formatShortDate(fixture.match_date)}</Text>
                        <View style={styles.historyMatchup}>
                          <TeamBadge logoUrl={fixture.home_team?.logo_url} name={fixture.home_team?.name ?? '?'} primaryColor={fixture.home_team?.primary_color} size={24} />
                          <Text style={styles.historyScore}>{homeScore} – {awayScore}</Text>
                          <TeamBadge logoUrl={fixture.away_team?.logo_url} name={fixture.away_team?.name ?? '?'} primaryColor={fixture.away_team?.primary_color} size={24} />
                        </View>
                        <View style={styles.historyEvents}>
                          {fEvents.map(e => (
                            <EventIcon key={e.id} type={e.event_type} size={18} />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })
              )}
            </View>
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
  hero: { height: 280, flexDirection: 'row', position: 'relative' },
  heroLeft: { width: 170, position: 'relative', overflow: 'hidden' },
  heroPhoto: { ...StyleSheet.absoluteFillObject },
  heroPhotoGradient: { ...StyleSheet.absoluteFillObject },
  heroJerseyNum: { position: 'absolute', bottom: 12, left: 12, color: '#fff', fontSize: 48, fontWeight: '900', opacity: 0.9 },
  heroRight: { flex: 1, backgroundColor: CARD_BG, padding: 16, justifyContent: 'center', gap: 6 },
  heroName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', letterSpacing: 0.5, lineHeight: 20 },
  positionChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: BRAND_GREEN },
  positionChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  secondaryPos: { color: TEXT_SECONDARY, fontSize: 12 },
  nationality: { color: TEXT_SECONDARY, fontSize: 12 },
  heroSeparator: { height: 1, backgroundColor: BORDER_COLOR, marginVertical: 4 },
  clubNameText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  heroButtons: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  starActive: { color: '#f59e0b' },
  tabBar: { flexDirection: 'row', backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, position: 'relative' },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: BRAND_GREEN },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: BRAND_GREEN, borderRadius: 1 },
  tabContent: { flex: 1 },
  tabContentInner: { paddingBottom: 120 },
  overviewTab: { padding: 16, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statsLeft: { flex: 1, gap: 4 },
  statsRight: { flex: 1, gap: 6 },
  statsSectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  statItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  statLabel: { color: TEXT_SECONDARY, fontSize: 12 },
  statValue: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },
  noDataText: { color: TEXT_SECONDARY, fontSize: 12 },
  recentCard: { backgroundColor: CARD_BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER_COLOR, padding: 8, gap: 4, marginBottom: 6 },
  recentDate: { color: TEXT_SECONDARY, fontSize: 10 },
  recentTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentScore: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'center' },
  recentEvents: { flexDirection: 'row', gap: 4 },
  squadsSection: { gap: 8 },
  squadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, gap: 10 },
  squadInfo: { flex: 1 },
  squadTeamName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  squadAgeGroup: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(26,71,42,0.5)', borderWidth: 1, borderColor: BRAND_GREEN },
  primaryBadgeText: { color: BRAND_GREEN, fontSize: 10, fontWeight: '700' },
  historyTab: { padding: 16, gap: 16 },
  historySection: { gap: 8 },
  historySectionTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  historyTeamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, gap: 10 },
  historyTeamInfo: { flex: 1 },
  historyTeamName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  historyTeamMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  historyGameRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, gap: 8 },
  historyDate: { color: TEXT_SECONDARY, fontSize: 11, width: 60 },
  historyMatchup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyScore: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'center' },
  historyEvents: { flexDirection: 'row', gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },
});
