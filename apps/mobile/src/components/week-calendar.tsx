/**
 * The seven-day strip on the Impact tab.
 *
 * Each cell deepens through five greens as more of that day's commitments are
 * completed. The scale is spaced by perceptual lightness rather than by eye, so
 * "greener means I did more" reads as an even progression — see
 * packages/shared/src/theme/colors.ts.
 */

import { Text } from '@/components/text';
import { radius, spacing, useTheme } from '@/theme';
import type { CalendarDay } from '@climatenote/shared';
import { StyleSheet, View } from 'react-native';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeekCalendar({ days }: { days: CalendarDay[] }) {
  const { colors, calendarScale } = useTheme();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.container}>
      <View style={styles.strip}>
        {days.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          const isToday = day.date === today;
          const fill = calendarScale[day.level] ?? calendarScale[0];

          // A filled cell needs light text; an empty one needs dark. Choosing by
          // level rather than measuring keeps this cheap and predictable.
          const numberTone = day.level >= 3 ? colors.background : colors.textSecondary;

          return (
            <View key={day.date} style={styles.dayColumn}>
              <Text variant="caption2" tone="tertiary" serif={false}>
                {WEEKDAY_INITIALS[date.getDay()]}
              </Text>

              <View
                accessible
                accessibilityLabel={
                  day.completed > 0
                    ? `${date.toLocaleDateString(undefined, { weekday: 'long' })}: ${day.completed} of ${day.committed} done`
                    : `${date.toLocaleDateString(undefined, { weekday: 'long' })}: nothing logged`
                }
                style={[
                  styles.cell,
                  { backgroundColor: fill },
                  isToday ? { borderWidth: 2, borderColor: colors.brand } : null,
                ]}
              >
                <Text variant="footnote" serif={false} style={{ color: numberTone }}>
                  {date.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Text variant="caption2" tone="tertiary" serif={false}>
          Less
        </Text>
        {calendarScale.map((color, index) => (
          <View key={index} style={[styles.legendSwatch, { backgroundColor: color }]} />
        ))}
        <Text variant="caption2" tone="tertiary" serif={false}>
          More
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center', gap: spacing.sm, flex: 1 },
  cell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'flex-end' },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
});
