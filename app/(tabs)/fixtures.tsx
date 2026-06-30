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

export default function FavouritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<TeamWithFixtures[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    console.log('[Favourites] Fetching favourites for user:', user.id);

    const { data: favData, error: favError } = await supabase
      .from('fan_favourites')
      .select('id, team_id, team:teams(id, name, primary_color, logo_url, club:clubs(logo_url, name))')
      .eq('user_id', user.id);

    if (favError) {
      console.log('[Favourites] Error fetching fan_favourites:', favError.message);
      return;
    }

    const favourites = (favData ?? []) as unknown as FavouriteEntry[];
    console.log('[Favourites] Found', favourites.length, 'favourite teams');

    const allResults = await Promise.all(
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
    const results: TeamWithFixtures[] = allResults.filter((r): r is TeamWithFixtures => r !== null);

    setData(results);
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

  const handleSignInPress = () => {
    console.log('[Favourites] Sign In button pressed');
    router.push('/(auth)/sign-in');
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
        {data.length === 0 ? (
          <View style={styles.centredInline}>
            <Text style={styles.emptyText}>
              No favourite teams yet
            </Text>
            <Text style={styles.emptySubText}>
              Star a team from the Teams tab to follow their fixtures here
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/(tabs)/teams')}
            >
              <Text style={styles.browseButtonText}>Browse Teams</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data.map(({ team, fixtures }) => (
            <View key={team.id} style={styles.teamSection}>
              {/* Team header */}
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

              {/* Fixtures */}
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
          ))
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
  emptySubText: { color: TEXT_SECONDARY, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  browseButton: { marginTop: 16, backgroundColor: BRAND_GREEN, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  browseButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  teamChevron: { color: '#9aab9e', fontSize: 18, marginLeft: 'auto' },
});
