import { StyleSheet, View } from 'react-native';

export type TransportIconName = 'previous' | 'next' | 'play' | 'pause';

type TransportIconProps = {
  name: TransportIconName;
  size: number;
  color: string;
};

/**
 * Transport icons drawn from Views so iOS never swaps in its emoji or system glyphs for ⏮ ⏭ ▶.
 * Decorative: the button that holds the icon carries the accessibility label.
 */
export function TransportIcon({ name, size, color }: TransportIconProps) {
  return (
    <View
      testID={`transport-icon-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size }]}
    >
      <IconParts name={name} size={size} color={color} />
    </View>
  );
}

function IconParts({ name, size, color }: TransportIconProps) {
  switch (name) {
    case 'play':
      // The row centres the margin box, so a margin of size/4 nets a size/8 shift right: the centroid (a third of the width from the flat edge) lands on the box centre.
      return <Triangle direction="right" width={size * 0.78} height={size * 0.9} color={color} offset={size * 0.25} />;
    case 'pause':
      return (
        <>
          <Bar width={size * 0.26} height={size * 0.8} color={color} />
          <View style={{ width: size * 0.2 }} />
          <Bar width={size * 0.26} height={size * 0.8} color={color} />
        </>
      );
    case 'previous':
      return (
        <>
          <Bar width={size * 0.13} height={size * 0.62} color={color} />
          <Triangle direction="left" width={size * 0.36} height={size * 0.62} color={color} />
          <Triangle direction="left" width={size * 0.36} height={size * 0.62} color={color} />
        </>
      );
    case 'next':
      return (
        <>
          <Triangle direction="right" width={size * 0.36} height={size * 0.62} color={color} />
          <Triangle direction="right" width={size * 0.36} height={size * 0.62} color={color} />
          <Bar width={size * 0.13} height={size * 0.62} color={color} />
        </>
      );
  }
}

function Bar({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <View
      testID="transport-icon-bar"
      style={{ width, height, borderRadius: width / 2, backgroundColor: color }}
    />
  );
}

// A zero-size View whose one coloured border, between two transparent ones, renders as a triangle.
function Triangle({
  direction,
  width,
  height,
  color,
  offset = 0,
}: {
  direction: 'left' | 'right';
  width: number;
  height: number;
  color: string;
  offset?: number;
}) {
  const point =
    direction === 'right'
      ? { borderLeftWidth: width, borderLeftColor: color }
      : { borderRightWidth: width, borderRightColor: color };

  return (
    <View
      testID="transport-icon-triangle"
      style={[styles.triangle, { borderTopWidth: height / 2, borderBottomWidth: height / 2, marginLeft: offset }, point]}
    />
  );
}

const styles = StyleSheet.create({
  box: { direction: 'ltr', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  triangle: { width: 0, height: 0, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});
