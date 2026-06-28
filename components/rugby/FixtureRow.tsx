import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import TeamBadge from './TeamBadge';
import { CARD_BG, BORDER_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, LIVE_RED, LIVE_GREEN } from '@/constants/Colors';

export interface MatchEventLite {
  id: string;
  event_type: string;
  owning_team_id: string | null;
  minute?: number | null;
}

export interface TeamLite {
  id: string;
  name: string;
  primary_color?: string | null;
  logo_url?: string | null;
}

export interface FixtureLite {
  id: string;
  match_date: string;
  status: string;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
  competition?: { id: string; name: string } | null;
  match_events?: MatchEventLite[];
}

interface FixtureRowProps {
  fixture: FixtureLite;
  onPress: () => void;
  teamId?: string;
}

function computeScore(events: MatchEventLite[], teamId: string): number {
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

function formatKickOff(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getResult(events: MatchEventLite[], homeId: string, awayId: string, teamId: string): 'W' | 'D' | 'L' | null {
  const homeScore = computeScore(events, homeId);
  const awayScore = computeScore(events, awayId);
  const isHome = teamId === homeId;
  const myScore = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;
  if (myScore > oppScore) return 'W';
  if (myScore === oppScore) return 'D';
  return 'L';
}

export default function FixtureRow({ fixture, onPress, teamId }: FixtureRowProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isLive = fixture.status === 'in_progress';
  const isCompleted = fixture.status === 'completed';
  const events = fixture.match_events ?? [];
  const homeId = fixture.home_team?.id ?? '';
  const awayId = fixture.away_team?.id ?? '';

  const homeScore = computeScore(events, homeId);
  const awayScore = computeScore(events, awayId);

  useEffect(() => {
    if (!isLive) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isLive, pulseAnim]);

  const result = isCompleted && teamId ? getResult(events, homeId, awayId, teamId) : null;
  const resultColor = result === 'W' ? LIVE_GREEN : result === 'D' ? '#f59e0b' : result === 'L' ? LIVE_RED : 'transparent';

  const centreDisplay = isLive || isCompleted
    ? `${homeScore} - ${awayScore}`
    : formatKickOff(fixture.match_date);

  const centreLabel = isCompleted ? 'FT' : isLive ? 'LIVE' : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {result && <View style={[styles.resultBar, { backgroundColor: resultColor }]} />}
      <View style={styles.row}>
        {/* Home team */}
        <View style={styles.teamSide}>
          <TeamBadge
            logoUrl={fixture.home_team?.logo_url}
            name={fixture.home_team?.name ?? '?'}
            primaryColor={fixture.home_team?.primary_color}
            size={32}
          />
          <Text style={styles.teamName} numberOfLines={2}>{fixture.home_team?.name ?? 'TBC'}</Text>
        </View>

        {/* Centre */}
        <View style={styles.centre}>
          {isLive && (
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <Text style={[styles.score, isLive && styles.scoreGreen]}>{centreDisplay}</Text>
          {centreLabel !== '' && centreLabel !== 'LIVE' && (
            <Text style={styles.centreLabel}>{centreLabel}</Text>
          )}
        </View>

        {/* Away team */}
        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={2}>
            {fixture.away_team?.name ?? 'TBC'}
          </Text>
          <TeamBadge
            logoUrl={fixture.away_team?.logo_url}
            name={fixture.away_team?.name ?? '?'}
            primaryColor={fixture.away_team?.primary_color}
            size={32}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  resultBar: {
    height: 3,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  teamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamSideRight: {
    justifyContent: 'flex-end',
  },
  teamName: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  teamNameRight: {
    textAlign: 'right',
  },
  centre: {
    width: 80,
    alignItems: 'center',
    gap: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIVE_RED,
  },
  liveText: {
    color: LIVE_RED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  score: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreGreen: {
    color: LIVE_GREEN,
  },
  centreLabel: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
