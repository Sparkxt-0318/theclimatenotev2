/**
 * Tab bar icons, drawn as plain views.
 *
 * Deliberately dependency-free: an icon font or SVG library would add a native
 * module and megabytes to the bundle for three glyphs. These are simple enough
 * to build from primitives and scale crisply at any density.
 */

import { View, type ColorValue } from 'react-native';

export type TabIconName = 'read' | 'notes' | 'impact';

export function TabIcon({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: ColorValue;
  focused: boolean;
}) {
  const weight = focused ? 2.5 : 1.8;

  if (name === 'read') {
    // An open publication: two stacked rules of decreasing width.
    return (
      <View style={{ width: 26, height: 26, justifyContent: 'center', gap: 4 }}>
        <View style={{ height: weight, borderRadius: 2, backgroundColor: color, width: 26 }} />
        <View style={{ height: weight, borderRadius: 2, backgroundColor: color, width: 20 }} />
        <View style={{ height: weight, borderRadius: 2, backgroundColor: color, width: 24 }} />
      </View>
    );
  }

  if (name === 'notes') {
    // A checked box.
    return (
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: weight,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 10,
            height: 5,
            borderLeftWidth: weight,
            borderBottomWidth: weight,
            borderColor: color,
            transform: [{ rotate: '-45deg' }],
            marginTop: -2,
          }}
        />
      </View>
    );
  }

  // Impact: a rising bar chart.
  return (
    <View style={{ width: 24, height: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {[8, 14, 20].map((height) => (
        <View
          key={height}
          style={{ width: 5, height, borderRadius: 2, backgroundColor: color, opacity: focused ? 1 : 0.85 }}
        />
      ))}
    </View>
  );
}
