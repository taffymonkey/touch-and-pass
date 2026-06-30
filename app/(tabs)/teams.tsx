import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import TeamBadge from '@/components/rugby/TeamBadge';
import SkeletonLoader from '@/components/rugby/SkeletonLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  DARK_BG, CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BRAND_GREEN, LIVE_GREEN,
} from '@/constants/Colors';

const AGE_GROUP_ORDER = [
  'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18',
  'Colts', "Women's", 'Senior', 'Veterans',
];

interface TeamRow {
  id: string;
  name: string;
  age_group: string | null;
  primary_color: string | null;
  logo_url: string | null;
  is_subscribed: boolean;
}

interface ClubRow {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  teams: TeamRow[];
}

type ViewMode = 'club' | 'age_group';

export default function TeamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sendTag, deleteTag } = useNotifications();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('club');
  const [searchText, setSearchText] = useState('');
  const [expandedClubs, setExpandedClubs] = useState<Set<string>>(new Set());
  const [favourites, setFavourites] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    console.log('[Teams] Fetching clubs and teams');
    const { data, error } = await supabase
      .from('clubs')
      .select(`*, teams(id, name, age_group, primary_color, logo_url, is_subscribed)`)
      .order('name', { ascending: true });

    if (error) {
      console.log('[Teams] Fetch error:', error.message);
    } else {
      console.log('[Teams] Fetched', data?.length ?? 0, 'clubs');
    }
    return (data ?? []) as ClubRow[];
  }, []);

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    console.log('[Teams] Fetching favourites for user:', user.id);
    const { data } = await supabase
      .from('fan_favourites')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'team');
    const ids = new Set((data ?? []).map((f: { entity_id: string }) => f.entity_id));
    setFavourites(ids);
  }, [user]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const [clubData] = await Promise.all([fetchData(), fetchFavourites()]);
    setClubs(clubData);
    if (!isRefresh) setLoading(false);
    setRefreshing(false);
  }, [fetchData, fetchFavourites]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const toggleExpand = (clubId: string) => {
    console.log('[Teams] Toggle club expand:', clubId);
    setExpandedClubs(prev => {
      const next = new Set(prev);
      if (next.has(clubId)) next.delete(clubId);
      else next.add(clubId);
      return next;
    });
  };

  const toggleFavourite = async (teamId: string) => {
    console.log('[Teams] Toggle favourite for team:', teamId);
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save favourites');
      return;
    }
    const isFav = favourites.has(teamId);
    if (isFav) {
      await supabase
        .from('fan_favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('entity_type', 'team')
        .eq('entity_id', teamId);
      setFavourites(prev => { const n = new Set(prev); n.delete(teamId); return n; });
      deleteTag(`fav_team_${teamId}`);
      console.log('[Teams] Removed favourite:', teamId);
    } else {
      await supabase
        .from('fan_favourites')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ user_id: user.id, entity_type: 'team', entity_id: teamId, team_id: teamId } as any);
      setFavourites(prev => new Set([...prev, teamId]));
      sendTag(`fav_team_${teamId}`, 'true');
      console.log('[Teams] Added favourite:', teamId);
    }
  };

  const handleTeamPress = (teamId: string) => {
    console.log('[Teams] Team pressed:', teamId);
    router.push(`/team/${teamId}`);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    console.log('[Teams] View mode changed to:', mode);
    setViewMode(mode);
  };

  // All teams flat
  const allTeams = clubs.flatMap(c => c.teams.map(t => ({ ...t, clubName: c.name, clubLogo: c.logo_url })));

  // Search filter
  const searchResults = searchText
    ? allTeams.filter(t =>
        t.name.toLowerCase().includes(searchText.toLowerCase()) ||
        t.clubName.toLowerCase().includes(searchText.toLowerCase()) ||
        (t.age_group ?? '').toLowerCase().includes(searchText.toLowerCase())
      )
    : null;

  // By club sections
  const clubSections = clubs.map(c => ({
    title: c.name,
    data: [{
      ...c,
      teams: [...c.teams].sort((a, b) => {
        const ai = AGE_GROUP_ORDER.indexOf(a.age_group ?? '');
        const bi = AGE_GROUP_ORDER.indexOf(b.age_group ?? '');
        const aIdx = ai === -1 ? 999 : ai;
        const bIdx = bi === -1 ? 999 : bi;
        return aIdx - bIdx;
      }),
    }],
  }));

  // By age group sections
  const ageGroupMap = new Map<string, typeof allTeams>();
  allTeams.forEach(t => {
    const key = t.age_group ?? 'Other';
    if (!ageGroupMap.has(key)) ageGroupMap.set(key, []);
    ageGroupMap.get(key)!.push(t);
  });
  const ageGroupSections = AGE_GROUP_ORDER
    .filter(ag => ageGroupMap.has(ag))
    .map(ag => ({ title: ag, data: ageGroupMap.get(ag)! }));
  const otherTeams = ageGroupMap.get('Other');
  if (otherTeams) ageGroupSections.push({ title: 'Other', data: otherTeams });

  const renderTeamRow = (team: typeof allTeams[0]) => (
    <TouchableOpacity
      key={team.id}
      style={styles.teamRow}
      onPress={() => handleTeamPress(team.id)}
    >
      <TeamBadge logoUrl={team.logo_url ?? team.clubLogo} name={team.name} primaryColor={team.primary_color} size={36} />
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{team.name}</Text>
        <View style={styles.teamMeta}>
          {team.age_group && (
            <View style={styles.agePill}>
              <Text style={styles.agePillText}>{team.age_group}</Text>
            </View>
          )}
          {team.is_subscribed && (
            <View style={styles.subscribedBadge}>
              <Text style={styles.subscribedText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.starBtn}
        onPress={() => toggleFavourite(team.id)}
      >
        <Text style={[styles.starIcon, favourites.has(team.id) && styles.starActive]}>
          {favourites.has(team.id) ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teams</Text>
      </View>

      {/* View mode toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.togglePill, viewMode === 'club' && styles.togglePillActive]}
          onPress={() => handleViewModeChange('club')}
        >
          <Text style={[styles.toggleText, viewMode === 'club' && styles.toggleTextActive]}>By Club</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.togglePill, viewMode === 'age_group' && styles.togglePillActive]}
          onPress={() => handleViewModeChange('age_group')}
        >
          <Text style={[styles.toggleText, viewMode === 'age_group' && styles.toggleTextActive]}>By Age Group</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams..."
          placeholderTextColor={TEXT_SECONDARY}
          value={searchText}
          onChangeText={text => {
            console.log('[Teams] Search text changed:', text);
            setSearchText(text);
          }}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonLoader key={i} width="100%" height={60} borderRadius={10} style={styles.skeletonItem} />
          ))}
        </View>
      ) : searchResults ? (
        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderTeamRow(item)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No teams found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
          }
        />
      ) : viewMode === 'club' ? (
        <SectionList
          sections={clubSections}
          keyExtractor={item => item.id}
          renderItem={({ item: club }) => (
            <View>
              <TouchableOpacity
                style={styles.clubRow}
                onPress={() => toggleExpand(club.id)}
              >
                <TeamBadge logoUrl={club.logo_url} name={club.name} primaryColor={club.primary_color} size={40} />
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  <Text style={styles.clubTeamCount}>{club.teams.length} team{club.teams.length !== 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.chevron}>{expandedClubs.has(club.id) ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {expandedClubs.has(club.id) && club.teams.map(t =>
                renderTeamRow({ ...t, clubName: club.name, clubLogo: club.logo_url })
              )}
            </View>
          )}
          renderSectionHeader={() => null}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
          }
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <SectionList
          sections={ageGroupSections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderTeamRow(item)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  togglePill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: CARD_BG,
  },
  togglePillActive: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
  toggleText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: TEXT_PRIMARY,
    fontSize: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  skeletonContainer: { padding: 16, gap: 8 },
  skeletonItem: { marginBottom: 4 },
  listContent: { paddingBottom: 120 },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    gap: 12,
  },
  clubInfo: { flex: 1 },
  clubName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  clubTeamCount: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  chevron: { color: TEXT_SECONDARY, fontSize: 12 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingLeft: 28,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    gap: 10,
    backgroundColor: 'rgba(26,46,31,0.5)',
  },
  teamInfo: { flex: 1 },
  teamName: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: '600' },
  teamMeta: { flexDirection: 'row', gap: 6, marginTop: 3 },
  agePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: BRAND_GREEN,
  },
  agePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  subscribedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: LIVE_GREEN,
  },
  subscribedText: { color: LIVE_GREEN, fontSize: 10, fontWeight: '700' },
  starBtn: { padding: 6 },
  starIcon: { fontSize: 20, color: TEXT_SECONDARY },
  starActive: { color: '#f59e0b' },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: DARK_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  sectionHeaderText: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 15 },
});
