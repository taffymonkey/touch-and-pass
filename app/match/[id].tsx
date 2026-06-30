import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/app/integrations/supabase/client';
import TeamBadge from '@/components/rugby/TeamBadge';
import EventIcon from '@/components/rugby/EventIcon';
import { useAuth } from '@/contexts/AuthContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY,
  BRAND_GREEN, LIVE_RED, LIVE_GREEN, YELLOW_CARD,
} from '@/constants/Colors';

interface FixtureDetail {
  id: string;
  match_date: string;
  status: string;
  match_phase: string | null;
  venue: string | null;
  game_type: string | null;
  is_final: boolean | null;
  home_team: { id: string; name: string; primary_color: string | null; logo_url: string | null; club?: { logo_url: string | null; primary_color: string | null } | null } | null;
  away_team: { id: string; name: string; primary_color: string | null; logo_url: string | null; club?: { logo_url: string | null; primary_color: string | null } | null } | null;
  competition: { id: string; name: string } | null;
}

interface MatchEvent {
  id: string;
  fixture_id: string;
  event_type: string;
  owning_player_id: string | null;
  replaced_by_player_id: string | null;
  owning_team_id: string | null;
  minute: number | null;
  notes: string | null;
  player?: { id: string; first_name: string; last_name: string } | null;
  replaced_by?: { id: string; first_name: string; last_name: string } | null;
}

interface Selection {
  id: string;
  fixture_id: string;
  player_id: string;
  team_id: string;
  jersey_number: number | null;
  is_substitute: boolean;
  is_captain: boolean;
  player?: { id: string; first_name: string; last_name: string; position: string | null; photo_url: string | null } | null;
}

function computeScore(events: MatchEvent[], teamId: string): number {
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const TABS = ['Info', 'Line-up', 'Live', 'Stats'];

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [fixture, setFixture] = useState<FixtureDetail | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [isFavourite, setIsFavourite] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(1)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  const PlayerAvatar = ({ name, photoUrl, bench = false }: { name: string; photoUrl?: string | null; bench?: boolean }) => {
    const size = 28;
    if (photoUrl) {
      return (
        <Image
          source={{ uri: photoUrl }}
          style={[styles.playerAvatar, bench && styles.playerAvatarBench, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
        />
      );
    }
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2);
    return (
      <View style={[styles.playerInitials, bench && styles.playerInitialsBench]}>
        <Text style={styles.playerInitialsText}>{initials}</Text>
      </View>
    );
  };

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

  const fetchData = useCallback(async () => {
    if (!id) return;
    console.log('[Match] Fetching match data for id:', id);
    const [fixtureRes, selectionsRes, eventsRes] = await Promise.all([
      supabase
        .from('fixtures')
        .select(`*, home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url, primary_color)), away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url, primary_color)), competition:competitions(id, name)`)
        .eq('id', id)
        .single(),
      supabase
        .from('fixture_selections')
        .select(`*, player:players(id, first_name, last_name, position, photo_url)`)
        .eq('fixture_id', id)
        .order('jersey_number', { ascending: true }),
      supabase
        .from('match_events')
        .select(`*, player:players!match_events_player_id_fkey(id, first_name, last_name), replaced_by:players!match_events_replaced_by_player_id_fkey(id, first_name, last_name)`)
        .eq('fixture_id', id)
        .order('minute', { ascending: true }),
    ]);

    if (fixtureRes.error) console.log('[Match] Fixture fetch error:', fixtureRes.error.message);
    if (selectionsRes.error) console.log('[Match] Selections fetch error:', selectionsRes.error.message);
    if (eventsRes.error) console.log('[Match] Events fetch error:', eventsRes.error.message);

    setFixture(fixtureRes.data as FixtureDetail | null);
    setSelections((selectionsRes.data ?? []) as Selection[]);
    setEvents((eventsRes.data ?? []) as MatchEvent[]);
    setLoading(false);
    console.log('[Match] Data loaded, events:', eventsRes.data?.length ?? 0);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    console.log('[Match] Setting up realtime for fixture:', id);
    const channel = supabase
      .channel(`match-events-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events', filter: `fixture_id=eq.${id}` }, payload => {
        console.log('[Match] New event received:', payload.new);
        setEvents(prev => [...prev, payload.new as MatchEvent]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Check favourite
  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('fan_favourites')
      .select('id')
      .eq('user_id', user.id)
      .eq('entity_type', 'fixture')
      .eq('entity_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [user, id]);

  const handleTabPress = (index: number) => {
    console.log('[Match] Tab pressed:', TABS[index]);
    setActiveTab(index);
    Animated.spring(tabAnim, { toValue: index, useNativeDriver: true, damping: 20, stiffness: 120 }).start();
    if (index === 3) {
      Animated.timing(statsAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    }
  };

  const handleBack = () => {
    console.log('[Match] Back button pressed');
    router.back();
  };

  const handleFavourite = async () => {
    console.log('[Match] Favourite button pressed');
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save favourites');
      return;
    }
    if (isFavourite) {
      await supabase.from('fan_favourites').delete().eq('user_id', user.id).eq('entity_type', 'fixture').eq('entity_id', id!);
      setIsFavourite(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('fan_favourites').upsert({ user_id: user.id, entity_type: 'fixture', entity_id: id! } as any);
      setIsFavourite(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (!fixture) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Match not found</Text>
      </View>
    );
  }

  const homeId = fixture.home_team?.id ?? '';
  const awayId = fixture.away_team?.id ?? '';
  const homeScore = computeScore(events, homeId);
  const awayScore = computeScore(events, awayId);
  const isLive = fixture.status === 'in_progress';
  const isCompleted = fixture.status === 'completed';
  const isUpcoming = fixture.status === 'upcoming';

  const homeColor = fixture.home_team?.club?.primary_color ?? fixture.home_team?.primary_color ?? BRAND_GREEN;
  const awayColor = fixture.away_team?.club?.primary_color ?? fixture.away_team?.primary_color ?? '#1e3a5f';

  // Stats
  const countEvents = (teamId: string, type: string) =>
    events.filter(e => e.owning_team_id === teamId && e.event_type === type).length;

  const statRows = [
    { label: 'Tries', home: countEvents(homeId, 'try'), away: countEvents(awayId, 'try') },
    { label: 'Conversions', home: countEvents(homeId, 'conversion'), away: countEvents(awayId, 'conversion') },
    { label: 'Penalties', home: countEvents(homeId, 'penalty'), away: countEvents(awayId, 'penalty') },
    { label: 'Drop Goals', home: countEvents(homeId, 'drop_goal'), away: countEvents(awayId, 'drop_goal') },
    { label: 'Yellow Cards', home: countEvents(homeId, 'yellow_card'), away: countEvents(awayId, 'yellow_card') },
    { label: 'Red Cards', home: countEvents(homeId, 'red_card'), away: countEvents(awayId, 'red_card') },
  ];

  // Lineup
  const homeStarters = selections.filter(s => s.team_id === homeId && !s.is_substitute).sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
  const homeBench = selections.filter(s => s.team_id === homeId && s.is_substitute);
  const awayStarters = selections.filter(s => s.team_id === awayId && !s.is_substitute).sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
  const awayBench = selections.filter(s => s.team_id === awayId && s.is_substitute);

  const tabIndicatorWidth = 80;
  const tabIndicatorTranslate = tabAnim.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [0, tabIndicatorWidth * (TABS.length - 1)],
  });

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={[homeColor, '#0a0a0a', '#0a0a0a', awayColor]}
        locations={[0, 0.42, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.hero}
      >

        {/* Home watermark logo */}
        {(fixture.home_team?.logo_url ?? fixture.home_team?.club?.logo_url) ? (
          <Image
            source={{ uri: (fixture.home_team?.logo_url ?? fixture.home_team?.club?.logo_url) as string }}
            style={styles.heroWatermarkLeft}
            resizeMode="contain"
          />
        ) : null}

        {/* Away watermark logo */}
        {(fixture.away_team?.logo_url ?? fixture.away_team?.club?.logo_url) ? (
          <Image
            source={{ uri: (fixture.away_team?.logo_url ?? fixture.away_team?.club?.logo_url) as string }}
            style={styles.heroWatermarkRight}
            resizeMode="contain"
          />
        ) : null}

        <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
          {/* Top row: back + star */}
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.circleBtn} onPress={handleBack}>
              <Text style={styles.circleBtnText}>‹</Text>
            </TouchableOpacity>
            {isLive && (
              <View style={styles.liveBadge}>
                <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <TouchableOpacity style={styles.circleBtn} onPress={handleFavourite}>
              <Text style={[styles.circleBtnText, isFavourite && styles.starActive]}>
                {isFavourite ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Score centre */}
          <View style={styles.heroCentre}>
            {isUpcoming ? (
              <Text style={styles.heroKickOff}>{formatTime(fixture.match_date)}</Text>
            ) : (
              <Text style={styles.heroScore}>{homeScore} – {awayScore}</Text>
            )}
            {isCompleted && <Text style={styles.heroFT}>FT</Text>}
            {fixture.match_phase && !isCompleted && (
              <Text style={styles.heroPhase}>{fixture.match_phase}</Text>
            )}
          </View>

          {/* Bottom row: team names */}
          <View style={styles.heroBottomRow}>
            <Text style={styles.heroTeamNameLeft} numberOfLines={2}>
              {fixture.home_team?.name ?? 'TBC'}
            </Text>
            <Text style={styles.heroPhaseBottom}>
              {isCompleted ? 'FULL TIME' : isLive ? fixture.match_phase ?? '' : formatDate(fixture.match_date)}
            </Text>
            <Text style={styles.heroTeamNameRight} numberOfLines={2}>
              {fixture.away_team?.name ?? 'TBC'}
            </Text>
          </View>
        </SafeAreaView>
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

      {/* Tab content */}
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
        {/* Info tab */}
        {activeTab === 0 && (
          <View style={styles.infoTab}>
            <View style={styles.infoCard}>
              {[
                { label: 'Date', value: formatDate(fixture.match_date) },
                { label: 'Kick-off', value: formatTime(fixture.match_date) },
                { label: 'Venue', value: fixture.venue ?? 'TBC' },
                { label: 'Type', value: fixture.game_type ?? 'League' },
                { label: 'Status', value: fixture.status.replace('_', ' ').toUpperCase() },
                { label: 'Competition', value: fixture.competition?.name ?? 'N/A' },
              ].map((row, i, arr) => (
                <View key={row.label} style={[styles.infoRow, i === arr.length - 1 && styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.pointsCard}>
              <Text style={styles.pointsTitle}>Points System</Text>
              <View style={styles.pointsGrid}>
                {[
                  { label: 'Try', pts: 5 },
                  { label: 'Conversion', pts: 2 },
                  { label: 'Penalty', pts: 3 },
                  { label: 'Drop Goal', pts: 3 },
                ].map(p => (
                  <View key={p.label} style={styles.pointsItem}>
                    <Text style={styles.pointsPts}>{p.pts}</Text>
                    <Text style={styles.pointsLabel}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Line-up tab */}
        {activeTab === 1 && (
          <View style={styles.lineupTab}>
            {selections.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Team not selected yet</Text>
              </View>
            ) : (
              <>
                <View style={styles.lineupHeader}>
                  <Text style={styles.lineupTeamName}>{fixture.home_team?.name}</Text>
                  <Text style={styles.lineupPos}>Pos</Text>
                  <Text style={[styles.lineupTeamName, styles.lineupTeamNameRight]}>{fixture.away_team?.name}</Text>
                </View>
                {homeStarters.map((sel, i) => {
                  const away = awayStarters[i];
                  const playerName = sel.player ? `${sel.player.first_name} ${sel.player.last_name}` : 'TBC';
                  const awayName = away?.player ? `${away.player.first_name} ${away.player.last_name}` : '';
                  const pos = sel.player?.position?.substring(0, 3).toUpperCase() ?? `${sel.jersey_number ?? i + 1}`;
                  return (
                    <View key={sel.id} style={styles.lineupRow}>
                      <View style={styles.lineupPlayerLeft}>
                        <PlayerAvatar name={playerName} photoUrl={sel.player?.photo_url} />
                        <Text style={styles.lineupPlayerName} numberOfLines={1}>
                          {playerName}{sel.is_captain ? ' (C)' : ''}
                        </Text>
                      </View>
                      <View style={styles.lineupPosBadge}>
                        <Text style={styles.lineupPosBadgeText}>{pos}</Text>
                      </View>
                      <View style={styles.lineupPlayerRight}>
                        {away && (
                          <>
                            <Text style={[styles.lineupPlayerName, styles.lineupPlayerNameRight]} numberOfLines={1}>
                              {awayName}{away.is_captain ? ' (C)' : ''}
                            </Text>
                            <PlayerAvatar name={awayName} photoUrl={away.player?.photo_url} />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
                {(homeBench.length > 0 || awayBench.length > 0) && (
                  <View style={styles.benchDivider}>
                    <Text style={styles.benchLabel}>BENCH</Text>
                  </View>
                )}
                {homeBench.map((sel, i) => {
                  const away = awayBench[i];
                  const playerName = sel.player ? `${sel.player.first_name} ${sel.player.last_name}` : 'TBC';
                  const awayName = away?.player ? `${away.player.first_name} ${away.player.last_name}` : '';
                  return (
                    <View key={sel.id} style={[styles.lineupRow, styles.lineupRowBench]}>
                      <View style={styles.lineupPlayerLeft}>
                        <PlayerAvatar name={playerName} photoUrl={sel.player?.photo_url} bench />
                        <Text style={styles.lineupPlayerName} numberOfLines={1}>{playerName}</Text>
                      </View>
                      <View style={styles.lineupPosBadge}>
                        <Text style={styles.lineupPosBadgeText}>{sel.jersey_number ?? '—'}</Text>
                      </View>
                      <View style={styles.lineupPlayerRight}>
                        {away && (
                          <>
                            <Text style={[styles.lineupPlayerName, styles.lineupPlayerNameRight]} numberOfLines={1}>{awayName}</Text>
                            <PlayerAvatar name={awayName} photoUrl={away.player?.photo_url} bench />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* Live / Timeline tab */}
        {activeTab === 2 && (
          <View style={styles.timelineTab}>
            {/* Team name header */}
            <View style={styles.timelineTeamHeader}>
              <Text style={styles.timelineTeamNameLeft} numberOfLines={1}>
                {fixture.home_team?.name?.toUpperCase() ?? 'HOME'}
              </Text>
              <Text style={styles.timelineTeamNameRight} numberOfLines={1}>
                {fixture.away_team?.name?.toUpperCase() ?? 'AWAY'}
              </Text>
            </View>

            {events.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {isUpcoming ? 'Match has not started yet' : 'No events recorded'}
                </Text>
              </View>
            ) : (() => {
              const sortedEvents = [...events].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
              const secondHalf = sortedEvents.filter(e => (e.minute ?? 0) > 40);
              const firstHalf = sortedEvents.filter(e => (e.minute ?? 0) <= 40);

              const renderEventRow = (event: MatchEvent) => {
                const isHome = event.owning_team_id === homeId;
                const playerFirst = event.player?.first_name ?? '';
                const playerLast = event.player?.last_name ?? '';
                const playerName = (playerFirst || playerLast) ? `${playerFirst} ${playerLast}`.trim() : '';
                const replacedFirst = event.replaced_by?.first_name ?? '';
                const replacedLast = event.replaced_by?.last_name ?? '';
                const replacedName = (replacedFirst || replacedLast) ? `${replacedFirst} ${replacedLast}`.trim() : '';
                const minuteStr = event.minute != null ? `${event.minute}'` : '';
                const eventTypeUpper = event.event_type.replace(/_/g, ' ').toUpperCase();
                const isSubstitution = event.event_type === 'substitution';

                const iconSource = (() => {
                  switch (event.event_type) {
                    case 'try': return require('@/assets/images/9bb7166f-9f6e-4a95-acdc-e3128ec52383.jpeg');
                    case 'conversion': return require('@/assets/images/3169e311-8546-4438-aec1-eafe2047abc1.png');
                    case 'penalty': return require('@/assets/images/e1f57668-e9fe-4e1c-9621-cc483572ff3b.jpeg');
                    case 'drop_goal': return require('@/assets/images/e1f57668-e9fe-4e1c-9621-cc483572ff3b.jpeg');
                    case 'substitution': return require('@/assets/images/18f1157f-e74d-4379-9816-9931a2134689.jpeg');
                    case 'yellow_card': return require('@/assets/images/ca550a3c-9a7d-4850-9f91-c2fead4dc194.jpeg');
                    case 'red_card': return require('@/assets/images/ca550a3c-9a7d-4850-9f91-c2fead4dc194.jpeg');
                    default: return require('@/assets/images/9bb7166f-9f6e-4a95-acdc-e3128ec52383.jpeg');
                  }
                })();

                const textBlock = (
                  <View style={isHome ? styles.tlTextBlockHome : styles.tlTextBlockAway}>
                    <Text style={styles.tlEventType}>{eventTypeUpper}</Text>
                    {isSubstitution ? (
                      <>
                        {playerName !== '' && (
                          <Text style={styles.tlPlayerName}>
                            {'↑ '}
                            {playerName}
                          </Text>
                        )}
                        {replacedName !== '' && (
                          <Text style={styles.tlPlayerName}>
                            {'↓ '}
                            {replacedName}
                          </Text>
                        )}
                      </>
                    ) : (
                      playerName !== '' && <Text style={styles.tlPlayerName}>{playerName}</Text>
                    )}
                    <Text style={styles.tlMinute}>{minuteStr}</Text>
                  </View>
                );

                const iconCircle = (
                  <View style={styles.tlIconCircle}>
                    <Image source={iconSource} style={styles.tlIconImage} tintColor="#ffffff" resizeMode="contain" />
                  </View>
                );

                return (
                  <View key={event.id} style={styles.tlEventRow}>
                    {isHome ? (
                      <>
                        {textBlock}
                        {iconCircle}
                        <View style={styles.tlSpacer} />
                      </>
                    ) : (
                      <>
                        <View style={styles.tlSpacer} />
                        {iconCircle}
                        {textBlock}
                      </>
                    )}
                  </View>
                );
              };

              return (
                <View style={styles.tlContainer}>
                  {/* Vertical centre line */}
                  <View style={styles.tlCentreLine} />

                  {/* FULL TIME divider */}
                  <View style={styles.tlDivider}>
                    <View style={styles.tlDividerLine} />
                    <Text style={styles.tlDividerLabel}>FULL TIME</Text>
                    <View style={styles.tlDividerLine} />
                  </View>

                  {secondHalf.map(renderEventRow)}

                  {/* HALF TIME divider */}
                  <View style={styles.tlDivider}>
                    <View style={styles.tlDividerLine} />
                    <Text style={styles.tlDividerLabel}>HALF TIME</Text>
                    <View style={styles.tlDividerLine} />
                  </View>

                  {firstHalf.map(renderEventRow)}
                </View>
              );
            })()}
          </View>
        )}

        {/* Stats tab */}
        {activeTab === 3 && (
          <View style={styles.statsTab}>
            {statRows.map(row => {
              const maxVal = Math.max(row.home, row.away, 1);
              const homeWidth = (row.home / maxVal) * 100;
              const awayWidth = (row.away / maxVal) * 100;
              return (
                <View key={row.label} style={styles.statRow}>
                  <Text style={styles.statValue}>{row.home}</Text>
                  <View style={styles.statBars}>
                    <Text style={styles.statLabel}>{row.label}</Text>
                    <View style={styles.statBarRow}>
                      <View style={styles.statBarHome}>
                        <Animated.View
                          style={[
                            styles.statBarFill,
                            styles.statBarFillHome,
                            {
                              width: statsAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', `${homeWidth}%`],
                              }),
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.statBarAway}>
                        <Animated.View
                          style={[
                            styles.statBarFill,
                            styles.statBarFillAway,
                            {
                              width: statsAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', `${awayWidth}%`],
                              }),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.statValue, styles.statValueRight]}>{row.away}</Text>
                </View>
              );
            })}
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
  hero: { minHeight: 220, position: 'relative', overflow: 'hidden' },
  heroWatermarkLeft: {
    position: 'absolute',
    left: -20,
    top: 0,
    bottom: 0,
    width: '55%',
    opacity: 0.35,
  },
  heroWatermarkRight: {
    position: 'absolute',
    right: -20,
    top: 0,
    bottom: 0,
    width: '55%',
    opacity: 0.35,
  },
  heroSafeArea: { flex: 1 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  circleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 28 },
  starActive: { color: '#f59e0b' },
  heroCentre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  heroScore: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  heroFT: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  heroKickOff: { color: '#fff', fontSize: 32, fontWeight: '800' },
  heroPhase: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  heroTeamNameLeft: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'left',
  },
  heroTeamNameRight: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  heroPhaseBottom: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    flexShrink: 1,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIVE_RED },
  liveText: { color: LIVE_RED, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    position: 'relative',
  },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: BRAND_GREEN },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: BRAND_GREEN,
    borderRadius: 1,
  },
  tabContent: { flex: 1 },
  tabContentInner: { paddingBottom: 120 },
  // Info tab
  infoTab: { padding: 16, gap: 16 },
  infoCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER_COLOR, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: TEXT_SECONDARY, fontSize: 13 },
  infoValue: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  pointsCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER_COLOR, padding: 16 },
  pointsTitle: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  pointsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  pointsItem: { alignItems: 'center', gap: 4 },
  pointsPts: { color: BRAND_GREEN, fontSize: 22, fontWeight: '800' },
  pointsLabel: { color: TEXT_SECONDARY, fontSize: 11 },
  // Lineup tab
  lineupTab: { padding: 12 },
  lineupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  lineupTeamName: { flex: 1, color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  lineupTeamNameRight: { textAlign: 'right' },
  lineupPos: { width: 40, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700' },
  lineupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  lineupRowBench: { opacity: 0.75 },
  lineupPlayerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineupPlayerRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  lineupPosBadge: { width: 40, height: 24, borderRadius: 6, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center' },
  lineupPosBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  lineupPlayerName: { flex: 1, color: TEXT_PRIMARY, fontSize: 12, fontWeight: '600' },
  lineupPlayerNameRight: { textAlign: 'right' },
  playerInitials: { width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND_GREEN, alignItems: 'center', justifyContent: 'center' },
  playerInitialsBench: { backgroundColor: '#2d4a33' },
  playerInitialsText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  playerAvatar: { backgroundColor: CARD_BG },
  playerAvatarBench: { opacity: 0.7 },
  benchDivider: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER_COLOR, marginVertical: 4 },
  benchLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },
  // Timeline tab
  timelineTab: { paddingBottom: 12 },
  timelineTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timelineTeamNameLeft: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  timelineTeamNameRight: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  tlContainer: {
    position: 'relative',
    paddingHorizontal: 0,
  },
  tlCentreLine: {
    position: 'absolute',
    width: 1,
    top: 0,
    bottom: 0,
    left: '50%',
    backgroundColor: '#2a2a2a',
    zIndex: 0,
  },
  tlEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  tlSpacer: { flex: 1 },
  tlIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    flexShrink: 0,
  },
  tlIconImage: {
    width: 26,
    height: 26,
  },
  tlTextBlockHome: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  tlTextBlockAway: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  tlEventType: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tlPlayerName: {
    color: '#9aab9e',
    fontSize: 12,
    marginTop: 1,
  },
  tlMinute: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tlDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 1,
  },
  tlDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  tlDividerLabel: {
    color: '#9aab9e',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginHorizontal: 10,
  },
  // Legacy event styles (kept for any other usage)
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  eventRowHome: {},
  eventRowAway: {},
  eventMinute: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', width: 28 },
  eventMinuteRight: { textAlign: 'right' },
  eventInfo: { flex: 1 },
  eventType: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  eventTypeRight: { textAlign: 'right' },
  eventPlayer: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 1 },
  eventPlayerRight: { textAlign: 'right' },
  eventSpacer: { flex: 1 },
  // Stats tab
  statsTab: { padding: 16, gap: 16 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statValue: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800', width: 28, textAlign: 'left' },
  statValueRight: { textAlign: 'right' },
  statBars: { flex: 1, gap: 4 },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statBarRow: { flexDirection: 'row', gap: 4 },
  statBarHome: { flex: 1, height: 8, backgroundColor: BORDER_COLOR, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', justifyContent: 'flex-end' },
  statBarAway: { flex: 1, height: 8, backgroundColor: BORDER_COLOR, borderRadius: 4, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 4 },
  statBarFillHome: { backgroundColor: BRAND_GREEN, alignSelf: 'flex-end' },
  statBarFillAway: { backgroundColor: YELLOW_CARD },
});
