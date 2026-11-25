import { View } from 'react-native';
import Svg, { Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

export type ModeIconName = 'shuffle' | 'repeat' | 'repeat-one';

type ModeIconProps = {
  name: ModeIconName;
  size: number;
  color: string;
};

/** Feather-style 24x24 stroke icons for the playback mode chips. Decorative: the chip carries the label. */
export function ModeIcon({ name, size, color }: ModeIconProps) {
  return (
    <View
      testID={`mode-icon-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {name === 'shuffle' ? <ShuffleParts /> : <RepeatParts />}
        {name === 'repeat-one' ? (
          <SvgText x={12} y={15} fontSize={10} fontWeight="bold" textAnchor="middle" fill={color} stroke="none">
            1
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

function ShuffleParts() {
  return (
    <>
      <Polyline points="16 3 21 3 21 8" />
      <Line x1="4" y1="20" x2="21" y2="3" />
      <Polyline points="21 16 21 21 16 21" />
      <Line x1="15" y1="15" x2="21" y2="21" />
      <Line x1="4" y1="4" x2="9" y2="9" />
    </>
  );
}

function RepeatParts() {
  return (
    <>
      <Polyline points="17 1 21 5 17 9" />
      <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <Polyline points="7 23 3 19 7 15" />
      <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  );
}
