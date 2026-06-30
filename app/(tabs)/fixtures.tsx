import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import FixtureRow, { FixtureLite } from '@/components/rugby/FixtureRow';
import TeamBadge from '@/components/rugby/TeamBadge';
import SkeletonLoader from '@/components/rugby/SkeletonLoader';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN,
} from '@/constants/Colors';

interface FavouriteTeam {
  id: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
  club?: { logo_url: string | null; name: string | null } | null;
}

interface FavouriteEntry {
  id: string;
  team_id: string | null;
  team: FavouriteTeam;
}

interface TeamWithFixtures {
  team: FavouriteTeam;
  fixtures: FixtureLite[];
}

interface FavouritePlayer {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  photo_url: string | null;
  primaryTeam: FavouriteTeam | null;
}

export default function FavouritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [teamData, setTeamData] = useState<TeamWithFixtures[]>([]);
  const [playerData, setPlayerData] = useState<FavouritePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    console.log('[Favourites] Fetching favourites for user:', user.id);

    // Fetch team favourites and player favourites in parallel
    const [teamFavResult, playerFavResult] = await Promise.all([
      supabase
        .from('fan_favourites')
        .select('id, team_id, team:teams(id, name, primary_color, logo_url, club:clubs(logo_url, name))')
        .eq('user_id', user.id)
        .eq('entity_type', 'team'),
      supabase
        .from('fan_favourites')
        .select('id, entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'player'),
    ]);

    if (teamFavResult.error) {
      console.log('[Favourites] Error fetching team favourites:', teamFavResult.error.message);
    }
    if (playerFavResult.error) {
      console.log('[Favourites] Error fetching player favourites:', playerFavResult.error.message);
    }

    // --- Teams ---
    const favourites = (teamFavResult.data ?? []) as unknown as FavouriteEntry[];
    console.log('[Favourites] Found', favourites.length, 'favourite teams');

    const teamResults = await Promise.all(
      favourites.map(async (fav) => {
        const teamId = fav.team?.id ?? fav.team_id;
        if (!teamId) {
          console.warn('[Favourites] Skipping favourite with null team id');
          return null;
        }
        console.log('[Favourites] Fetching fixtures for team:', teamId);

        const { data: fixtureData, error: fixtureError } = await supabase
          .from('fixtures')
          .select(`
            *,
            home_team:teams!fixtures_home_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url)),
            away_team:teams!fixtures_away_team_id_fkey(id, name, primary_color, logo_url, club:clubs(logo_url)),
            competition:competitions(id, name),
            match_events(id, event_type, owning_team_id)
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .in('status', ['upcoming', 'in_progress'])
          .order('match_date', { ascending: true })
          .limit(5);

        if (fixtureError) {
          console.log('[Favourites] Error fetching fixtures for team', teamId, ':', fixtureError.message);
        } else {
          console.log('[Favourites] Fetched', fixtureData?.length ?? 0, 'fixtures for team', teamId);
        }

        return {
          team: fav.team,
          fixtures: (fixtureData ?? []) as FixtureLite[],
        };
      })
    );
    const resolvedTeams: TeamWithFixtures[] = teamResults.filter((r): r is TeamWithFixtures => r !== null);
    setTeamData(resolvedTeams);

    // --- Players ---
    const playerFavRows = (playerFavResult.data ?? []) as { id: string; entity_id: string | null }[];
    console.log('[Favourites] Found', playerFavRows.length, 'favourite players');

    const playerResults = await Promise.all(
      playerFavRows.map(async (row) => {
        const playerId = row.entity_id;
        if (!playerId) {
          console.warn('[Favourites] Skipping player favourite with null entity_id');
          return null;
        }
        console.log('[Favourites] Fetching player details for:', playerId);

        const { data: playerRaw, error: playerError } = await supabase
          .from('public_players')
          .select(`
            id, first_name, last_name, position, photo_url,
            player_team_registrations(
              is_primary,
              team:teams(id, name, primary_color, logo_url, club:clubs(logo_url, name))
            )
          `)
          .eq('id', playerId)
          .single();

        if (playerError) {
          console.log('[Favourites] Error fetching player', playerId, ':', playerError.message);
          return null;
        }

        const registrations = (playerRaw as any)?.player_team_registrations ?? [];
        const primaryReg = registrations.find((r: any) => r.is_primary) ?? registrations[0] ?? null;
        const primaryTeam: FavouriteTeam | null = primaryReg?.team ?? null;

        return {
          id: playerRaw.id as string,
          first_name: playerRaw.first_name as string,
          last_name: playerRaw.last_name as string,
          position: (playerRaw.position as string | null) ?? null,
          photo_url: (playerRaw.photo_url as string | null) ?? null,
          primaryTeam,
        } as FavouritePlayer;
      })
    );
    const resolvedPlayers: FavouritePlayer[] = playerResults.filter((r): r is FavouritePlayer => r !== null);
    console.log('[Favourites] Resolved', resolvedPlayers.length, 'player records');
    setPlayerData(resolvedPlayers);
  }, [user]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    await fetchFavourites();
    if (!isRefresh) setLoading(false);
    setRefreshing(false);
  }, [fetchFavourites]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    console.log('[Favourites] Pull-to-refresh triggered');
    setRefreshing(true);
    load(true);
  };

  const handleFixturePress = (id: string) => {
    console.log('[Favourites] Fixture pressed:', id);
    router.push(`/match/${id}`);
  };

  const handleTeamPress = (teamId: string) => {
    console.log('[Favourites] Team header pressed:', teamId);
    router.push(`/team/${teamId}`);
  };

  const handlePlayerPress = (playerId: string) => {
    console.log('[Favourites] Player row pressed:', playerId);
    router.push(`/player/${playerId}`);
  };

  const handleSignInPress = () => {
    console.log('[Favourites] Sign In button pressed');
    router.push('/(auth)/sign-in');
  };

  const handleBrowseTeamsPress = () => {
    console.log('[Favourites] Browse Teams button pressed');
    router.push('/(tabs)/teams');
  };

  // Not logged in
  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Favourites</Text>
        </View>
        <View style={styles.centred}>
          <Text style={styles.guestText}>
            Sign in to save your favourite teams and see their upcoming fixtures
          </Text>
          <TouchableOpacity style={styles.signInButton} onPress={handleSignInPress}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Favourites</Text>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.skeletonSection}>
              <SkeletonLoader width={160} height={20} borderRadius={6} style={styles.skeletonTeamName} />
              {[1, 2].map(j => (
                <SkeletonLoader key={j} width="100%" height={72} borderRadius={12} style={styles.skeletonItem} />
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const hasTeams = teamData.length > 0;
  const hasPlayers = playerData.length > 0;
  const isEmpty = !hasTeams && !hasPlayers;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favourites</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
        }
      >
        {isEmpty ? (
          <View style={styles.centredInline}>
            <Text style={styles.emptyText}>No favourites yet</Text>
            <Text style={styles.emptySubText}>
              Star a team or player to follow them here
            </Text>
            <TouchableOpacity style={styles.browseButton} onPress={handleBrowseTeamsPress}>
              <Text style={styles.browseButtonText}>Browse Teams</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* TEAMS SECTION */}
            {hasTeams && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>TEAMS</Text>
                </View>
                {teamData.map(({ team, fixtures }) => (
                  <View key={team.id} style={styles.teamSection}>
                    <TouchableOpacity style={styles.teamHeader} onPress={() => handleTeamPress(team.id)}>
                      <TeamBadge
                        logoUrl={team.logo_url ?? team.club?.logo_url}
                        name={team.name}
                        primaryColor={team.primary_color}
                        size={36}
                      />
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamChevron}>›</Text>
                    </TouchableOpacity>

                    {fixtures.length === 0 ? (
                      <Text style={styles.noFixturesText}>No upcoming fixtures</Text>
                    ) : (
                      fixtures.map(fixture => (
                        <FixtureRow
                          key={fixture.id}
                          fixture={fixture}
                          onPress={() => handleFixturePress(fixture.id)}
                        />
                      ))
                    )}
                  </View>
                ))}
              </>
            )}

            {/* PLAYERS SECTION */}
            {hasPlayers && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>PLAYERS</Text>
                </View>
                <View style={styles.playersSection}>
                  {playerData.map((player) => {
                    const fullName = player.first_name + ' ' + player.last_name;
                    const teamLogoUrl = player.primaryTeam?.logo_url ?? player.primaryTeam?.club?.logo_url ?? null;
                    const teamName = player.primaryTeam?.name ?? 'Unknown Team';
                    const teamColor = player.primaryTeam?.primary_color ?? null;
                    const positionText = player.position ?? '—';

                    return (
                      <TouchableOpacity
                        key={player.id}
                        style={styles.playerRow}
                        onPress={() => handlePlayerPress(player.id)}
                        activeOpacity={0.7}
                      >
                        <TeamBadge
                          logoUrl={teamLogoUrl}
                          name={teamName}
                          primaryColor={teamColor}
                          size={40}
                        />
                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName}>{fullName}</Text>
                          <Text style={styles.playerPosition}>{positionText}</Text>
                        </View>
                        <Text style={styles.playerChevron}>›</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
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
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  centredInline: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  guestText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  skeletonContainer: {
    padding: 16,
    gap: 24,
  },
  skeletonSection: {
    gap: 8,
  },
  skeletonTeamName: {
    marginBottom: 4,
  },
  skeletonItem: {
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 120,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    marginBottom: 4,
  },
  sectionHeaderText: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  teamSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    marginBottom: 8,
  },
  teamName: {
    color: '#f5f0e8',
    fontSize: 16,
    fontWeight: '700',
  },
  noFixturesText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    paddingVertical: 10,
    paddingLeft: 4,
  },
  emptyText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySubText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  browseButton: {
    marginTop: 16,
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  teamChevron: {
    color: '#9aab9e',
    fontSize: 18,
    marginLeft: 'auto',
  },
  playersSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  playerPosition: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  playerChevron: {
    color: '#9aab9e',
    fontSize: 18,
  },
});
