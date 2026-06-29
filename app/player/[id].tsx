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
  useWindowDimensions,
  Modal,
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

const NATIONALITY_TO_FLAG: Record<string, string> = {
  'england': 'gb-eng',
  'wales': 'gb-wls',
  'scotland': 'gb-sct',
  'ireland': 'ie',
  'france': 'fr',
  'australia': 'au',
  'new zealand': 'nz',
  'south africa': 'za',
  'argentina': 'ar',
  'fiji': 'fj',
  'samoa': 'ws',
  'tonga': 'to',
  'italy': 'it',
  'japan': 'jp',
  'georgia': 'ge',
  'romania': 'ro',
  'uruguay': 'uy',
  'canada': 'ca',
  'usa': 'us',
  'united states': 'us',
  'spain': 'es',
  'portugal': 'pt',
  'namibia': 'na',
  'kenya': 'ke',
  'zimbabwe': 'zw',
  'russia': 'ru',
  'ukraine': 'ua',
  'belgium': 'be',
  'netherlands': 'nl',
  'germany': 'de',
  'brazil': 'br',
  'chile': 'cl',
  'hong kong': 'hk',
  'singapore': 'sg',
};

function getFlagCode(nationality: string): string | null {
  return NATIONALITY_TO_FLAG[nationality.toLowerCase()] ?? null;
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
    home_team: { id: string; name: string; primary_color: string | null; logo_url: string | null; club?: { logo_url: string | null } | null } | null;
    away_team: { id: string; name: string; primary_color: string | null; logo_url: string | null; club?: { logo_url: string | null } | null } | null;
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

const TABS = ['OVERVIEW', 'HISTORY'];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
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
  const { width } = useWindowDimensions();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [events, setEvents] = useState<PlayerEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [isFavourite, setIsFavourite] = useState(false);
  const [scope, setScope] = useState<string>('career');
  const [scopeModalVisible, setScopeModalVisible] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    if (!id) return;
    console.log('[Player] Fetching player data for id:', id);
    const [playerRes, eventsRes, registrationsRes] = await Promise.all([
      supabase.from('public_players').select('*').eq('id', id).single(),
      supabase
        .from('match_events')
        .select(`*, fixture:fixtures(id, match_date, status, home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url)), away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url)))`)
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

  // Stats computation (scoped)
  const uniqueFixtureIds = new Set(filteredEvents.map(e => e.fixture?.id).filter(Boolean));
  const appearances = uniqueFixtureIds.size;
  const tries = filteredEvents.filter(e => e.event_type === 'try').length;
  const conversions = filteredEvents.filter(e => e.event_type === 'conversion').length;
  const penalties = filteredEvents.filter(e => e.event_type === 'penalty').length;
  const dropGoals = filteredEvents.filter(e => e.event_type === 'drop_goal').length;
  const yellowCards = filteredEvents.filter(e => e.event_type === 'yellow_card').length;
  const redCards = filteredEvents.filter(e => e.event_type === 'red_card').length;
  const points = tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3;

  // Recent 5 fixtures (scoped)
  const fixtureMap = new Map<string, { fixture: PlayerEvent['fixture']; events: PlayerEvent[] }>();
  filteredEvents.forEach(e => {
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

  // Scope options
  const scopeOptions: { key: string; label: string }[] = [
    { key: 'career', label: 'Career' },
    { key: 'this_season', label: 'This Season' },
    { key: 'last_season', label: 'Last Season' },
    ...registrations.map(r => ({
      key: `team_${r.team_id}`,
      label: r.team?.name ?? 'Unknown Team',
    })),
  ];

  const currentScopeLabel = scopeOptions.find(o => o.key === scope)?.label ?? 'Career';

  // Season boundaries
  const now = new Date();
  const thisSeasonStart = new Date(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1, 7, 1);
  const lastSeasonStart = new Date(thisSeasonStart.getFullYear() - 1, 7, 1);
  const lastSeasonEnd = new Date(thisSeasonStart.getFullYear(), 7, 1);

  // Filter events by scope
  const filteredEvents = events.filter(e => {
    const matchDate = e.fixture?.match_date ? new Date(e.fixture.match_date) : null;
    if (!matchDate) return false;
    if (scope === 'this_season') return matchDate >= thisSeasonStart;
    if (scope === 'last_season') return matchDate >= lastSeasonStart && matchDate < lastSeasonEnd;
    if (scope.startsWith('team_')) {
      const teamId = scope.replace('team_', '');
      return e.owning_team_id === teamId;
    }
    return true; // career — all events
  });

  const fullName = `${player.first_name} ${player.last_name}`.toUpperCase();
  const jerseyNum = player.jersey_number?.toString() ?? '';
  const jerseyDisplay = jerseyNum !== '' ? `#${jerseyNum}` : '';

  const tabIndicatorWidth = width / 2;
  const tabIndicatorTranslate = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabIndicatorWidth],
  });



  const clubDisplayName = primaryTeam?.club?.name ?? primaryTeam?.name ?? '';

  const statRows = [
    { label: 'Appearances', value: appearances },
    { label: 'Points', value: points },
    { label: 'Tries', value: tries },
    { label: 'Conversions', value: conversions },
    { label: 'Penalties', value: penalties },
    { label: 'Drop Goals', value: dropGoals },
    { label: 'Yellow Cards', value: yellowCards },
    { label: 'Red Cards', value: redCards },
  ];

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <View style={styles.hero}>
        {/* Left: photo */}
        <View style={[styles.heroLeft, { backgroundColor: primaryColor }]}>
          {player.photo_url ? (
            <Image source={resolveImageSource(player.photo_url)} style={styles.heroPhoto} resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroPhotoGradient}
          />
          {jerseyDisplay !== '' && <Text style={styles.heroJerseyNum}>{jerseyDisplay}</Text>}
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
          {player.position ? (
            <View style={styles.positionChip}>
              <Text style={styles.positionChipText}>{player.position}</Text>
            </View>
          ) : null}
          {player.secondary_position ? (
            <Text style={styles.secondaryPos}>{player.secondary_position}</Text>
          ) : null}
          {player.nationality && getFlagCode(player.nationality) && (
            <Image
              source={{ uri: `https://flagcdn.com/w40/${getFlagCode(player.nationality)}.png` }}
              style={{ width: 36, height: 24, borderRadius: 2 }}
              resizeMode="contain"
            />
          )}
          <View style={styles.heroSeparator} />
          {clubDisplayName !== '' ? (
            <Text style={styles.clubNameText}>{clubDisplayName}</Text>
          ) : null}
        </View>

        {/* Overlay buttons */}
        <SafeAreaView style={styles.heroButtons} edges={['top']}>
          <TouchableOpacity style={styles.circleBtn} onPress={handleBack}>
            <Text style={styles.circleBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={handleFavourite}>
            <Text style={[styles.circleBtnText, isFavourite ? styles.starActive : null]}>
              {isFavourite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => handleTabPress(i)}>
            <Text style={[styles.tabLabel, activeTab === i ? styles.tabLabelActive : null]}>{tab}</Text>
          </TouchableOpacity>
        ))}
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: tabIndicatorWidth, transform: [{ translateX: tabIndicatorTranslate }] },
          ]}
        />
      </View>

      <Modal
        visible={scopeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScopeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setScopeModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>View Stats For</Text>
            {scopeOptions.map(option => {
              const isActive = scope === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.modalOption, isActive && styles.modalOptionActive]}
                  onPress={() => {
                    console.log('[Player] Scope selected:', option.key);
                    setScope(option.key);
                    setScopeModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                    {option.label}
                  </Text>
                  {isActive && <Text style={styles.modalOptionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
        {/* Overview tab */}
        {activeTab === 0 ? (
          <View>
            {/* Scope header */}
            <TouchableOpacity style={styles.scopeHeader} onPress={() => {
              console.log('[Player] Scope dropdown opened');
              setScopeModalVisible(true);
            }}>
              <Text style={styles.scopeTitle}>{currentScopeLabel}</Text>
              <Text style={styles.scopeChevron}>⌄</Text>
            </TouchableOpacity>

            {/* Two-column layout */}
            <View style={styles.twoCol}>
              {/* Stats column */}
              <View style={styles.statsCol}>
                <View style={styles.statsBar} />
                <Text style={styles.statsSectionLabel}>STATS</Text>
                {statRows.map(s => (
                  <View key={s.label} style={styles.statRow}>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={styles.statValue}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {/* Recent column */}
              <View style={styles.recentCol}>
                <Text style={styles.statsSectionLabel}>RECENT</Text>
                {recentFixtures.length === 0 ? (
                  <Text style={styles.noDataText}>No appearances</Text>
                ) : (
                  recentFixtures.map(({ fixture, events: fEvents }) => {
                    if (!fixture) return null;
                    const homeId = fixture.home_team?.id ?? '';
                    const awayId = fixture.away_team?.id ?? '';
                    const homeScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), homeId);
                    const awayScore = computeScoreForTeam(fEvents.map(e => ({ ...e, fixture })), awayId);
                    const dateDisplay = formatShortDate(fixture.match_date);
                    const scoreDisplay = `${homeScore}–${awayScore}`;
                    const matchupDisplay = `${fixture.home_team?.name ?? '?'} v ${fixture.away_team?.name ?? '?'}`;

                    const fTries = fEvents.filter(e => e.event_type === 'try').length;
                    const fConversions = fEvents.filter(e => e.event_type === 'conversion').length;
                    const fPenalties = fEvents.filter(e => e.event_type === 'penalty').length;
                    const fDropGoals = fEvents.filter(e => e.event_type === 'drop_goal').length;
                    const fRedCards = fEvents.filter(e => e.event_type === 'red_card').length;
                    const fYellowCards = fEvents.filter(e => e.event_type === 'yellow_card').length;

                    const badges = [
                      { label: `T${fTries}`, active: fTries > 0 },
                      { label: `C${fConversions}`, active: fConversions > 0 },
                      { label: `P${fPenalties}`, active: fPenalties > 0 },
                      { label: `D${fDropGoals}`, active: fDropGoals > 0 },
                      { label: `RC${fRedCards}`, active: fRedCards > 0 },
                      { label: `YC${fYellowCards}`, active: fYellowCards > 0 },
                    ];

                    return (
                      <TouchableOpacity
                        key={fixture.id}
                        style={styles.recentCard}
                        onPress={() => handleFixturePress(fixture.id)}
                      >
                        <View style={styles.recentTopRow}>
                          <Text style={styles.recentDate}>{dateDisplay}</Text>
                          <Text style={styles.recentScore}>{scoreDisplay}</Text>
                        </View>
                        <Text style={styles.recentMatchup} numberOfLines={1}>{matchupDisplay}</Text>
                        <View style={styles.recentBadges}>
                          {badges.map(b => (
                            <Text key={b.label} style={[styles.badgeText, b.active ? styles.badgeActive : styles.badgeZero]}>{b.label}</Text>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* Squads section */}
            {registrations.length > 0 ? (
              <View style={styles.squadsSection}>
                <Text style={styles.squadsSectionLabel}>SQUADS</Text>
                {registrations.map(reg => (
                  <View key={reg.team_id} style={styles.squadRow}>
                    <TeamBadge
                      logoUrl={reg.team?.club?.logo_url ?? reg.team?.logo_url}
                      name={reg.team?.name ?? '?'}
                      primaryColor={reg.team?.primary_color}
                      size={44}
                    />
                    <View style={styles.squadInfo}>
                      <Text style={styles.squadTeamName}>{reg.team?.name}</Text>
                      {reg.team?.age_group ? (
                        <Text style={styles.squadAgeGroup}>{reg.team.age_group}</Text>
                      ) : null}
                    </View>
                    {reg.is_primary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* History tab */}
        {activeTab === 1 ? (
          <View style={styles.historyTab}>

            {/* TEAMS PLAYED FOR */}
            {registrations.length > 0 ? (
              <View>
                <Text style={styles.historySectionTitle}>TEAMS PLAYED FOR</Text>
                {registrations.map(reg => (
                  <View key={reg.team_id} style={styles.historyTeamRow}>
                    <TeamBadge
                      logoUrl={reg.team?.club?.logo_url ?? reg.team?.logo_url}
                      name={reg.team?.name ?? '?'}
                      primaryColor={reg.team?.primary_color}
                      size={48}
                    />
                    <View style={styles.historyTeamInfo}>
                      <Text style={styles.historyTeamName}>{reg.team?.name}</Text>
                      <Text style={styles.historyTeamMeta}>
                        {[reg.team?.age_group, '2025–2026'].filter(Boolean).join('  ')}
                      </Text>
                    </View>
                    {reg.is_primary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* ALL GAMES */}
            <View>
              <Text style={styles.historySectionTitle}>ALL GAMES</Text>
              {Array.from(fixtureMap.values()).length === 0 ? (
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

                    const d = new Date(fixture.match_date);
                    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).toUpperCase();

                    const fTries = fEvents.filter(e => e.event_type === 'try').length;
                    const fConversions = fEvents.filter(e => e.event_type === 'conversion').length;
                    const fPenalties = fEvents.filter(e => e.event_type === 'penalty').length;
                    const fDropGoals = fEvents.filter(e => e.event_type === 'drop_goal').length;
                    const fRedCards = fEvents.filter(e => e.event_type === 'red_card').length;
                    const fYellowCards = fEvents.filter(e => e.event_type === 'yellow_card').length;

                    const badges = [
                      { label: `T${fTries}`, active: fTries > 0 },
                      { label: `C${fConversions}`, active: fConversions > 0 },
                      { label: `P${fPenalties}`, active: fPenalties > 0 },
                      { label: `D${fDropGoals}`, active: fDropGoals > 0 },
                      { label: `RC${fRedCards}`, active: fRedCards > 0 },
                      { label: `YC${fYellowCards}`, active: fYellowCards > 0 },
                    ];

                    return (
                      <TouchableOpacity
                        key={fixture.id}
                        style={styles.historyGameRow}
                        onPress={() => handleFixturePress(fixture.id)}
                      >
                        {/* Green date on left */}
                        <Text style={styles.historyDate}>{dateStr}</Text>

                        {/* Centre: home team, v, away team, badges */}
                        <View style={styles.historyMatchup}>
                          <Text style={styles.historyTeamLabel}>{fixture.home_team?.name ?? 'TBC'}</Text>
                          <Text style={styles.historyVs}>v</Text>
                          <Text style={styles.historyTeamLabel}>{fixture.away_team?.name ?? 'TBC'}</Text>
                          <View style={styles.historyBadges}>
                            {badges.map(b => (
                              <Text key={b.label} style={[styles.historyBadgeText, b.active ? styles.badgeActive : styles.badgeZero]}>
                                {b.label}
                              </Text>
                            ))}
                          </View>
                        </View>

                        {/* Score on right */}
                        <Text style={styles.historyScore}>{homeScore}–{awayScore}</Text>
                      </TouchableOpacity>
                    );
                  })
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  loadingContainer: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TEXT_SECONDARY, fontSize: 16 },

  // Hero
  hero: { height: 280, flexDirection: 'row' },
  heroLeft: { width: '45%', position: 'relative', overflow: 'hidden' },
  heroPhoto: { ...StyleSheet.absoluteFillObject },
  heroPhotoGradient: { ...StyleSheet.absoluteFillObject },
  heroJerseyNum: { position: 'absolute', bottom: 12, left: 12, color: BRAND_GREEN, fontSize: 52, fontWeight: '900' },
  heroRight: { flex: 1, backgroundColor: '#111', padding: 16, justifyContent: 'center', gap: 8 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  positionChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: BRAND_GREEN },
  positionChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryPos: { color: TEXT_SECONDARY, fontSize: 13 },
  flagImage: { width: 32, height: 22 },
  heroSeparator: { height: 1, backgroundColor: BORDER_COLOR, marginVertical: 4 },
  clubNameText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  heroButtons: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  starActive: { color: '#f59e0b' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: DARK_BG, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, position: 'relative' },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  tabLabelActive: { color: '#fff', fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: BRAND_GREEN, borderRadius: 1 },

  tabContent: { flex: 1 },
  tabContentInner: { paddingBottom: 120 },

  // Scope header
  scopeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  scopeTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  scopeChevron: { color: TEXT_SECONDARY, fontSize: 18 },

  // Two-column
  twoCol: { flexDirection: 'row', padding: 16, gap: 12 },
  statsCol: { flex: 1, position: 'relative', paddingLeft: 8 },
  statsBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: BRAND_GREEN },
  statsSectionLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  statLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  statValue: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '700' },

  recentCol: { flex: 1 },
  recentCard: { backgroundColor: CARD_BG, borderRadius: 8, padding: 10, marginBottom: 6 },
  recentTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  recentDate: { color: BRAND_GREEN, fontSize: 10, fontWeight: '700' },
  recentScore: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '700' },
  recentMatchup: { color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  recentBadges: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeActive: { color: BRAND_GREEN },
  badgeZero: { color: TEXT_SECONDARY },

  noDataText: { color: TEXT_SECONDARY, fontSize: 12 },

  // Squads
  squadsSection: { borderTopWidth: 1, borderTopColor: BORDER_COLOR, marginTop: 8 },
  squadsSectionLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  squadRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, gap: 12 },
  squadInfo: { flex: 1 },
  squadTeamName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  squadAgeGroup: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 2 },
  primaryBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: BRAND_GREEN },
  primaryBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // History tab
  historyTab: { paddingTop: 8, paddingBottom: 120 },
  historySection: { gap: 8 },
  historySectionTitle: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  historyTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    gap: 14,
  },
  historyTeamInfo: { flex: 1 },
  historyTeamName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '700' },
  historyTeamMeta: { color: TEXT_SECONDARY, fontSize: 13, marginTop: 3 },
  historyGameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    gap: 12,
  },
  historyDate: {
    color: BRAND_GREEN,
    fontSize: 12,
    fontWeight: '700',
    width: 64,
    paddingTop: 2,
  },
  historyMatchup: { flex: 1, gap: 2 },
  historyTeamLabel: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  historyVs: { color: TEXT_SECONDARY, fontSize: 12 },
  historyBadges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  historyBadgeText: { fontSize: 11, fontWeight: '700' },
  historyScore: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', paddingTop: 2 },
  historyEvents: { flexDirection: 'row', gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },

  // Scope modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: CARD_BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER_COLOR, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  modalOptionActive: { backgroundColor: 'rgba(26,71,42,0.3)' },
  modalOptionText: { color: TEXT_PRIMARY, fontSize: 16 },
  modalOptionTextActive: { color: BRAND_GREEN, fontWeight: '700' },
  modalOptionCheck: { color: BRAND_GREEN, fontSize: 16, fontWeight: '700' },
});
