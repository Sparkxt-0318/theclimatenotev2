import { TabIcon } from '@/components/tab-icon';
import { hairline, useTheme } from '@/theme';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: hairline,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Read',
          tabBarIcon: ({ color, focused }) => <TabIcon name="read" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, focused }) => <TabIcon name="notes" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: ({ color, focused }) => <TabIcon name="impact" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
