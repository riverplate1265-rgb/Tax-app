import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

interface Segment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function DonutChart({
  segments,
  size = 220,
  strokeWidth = 36,
  centerLabel,
  centerSubLabel,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  let cumulativePercent = 0;

  // SVGのCircleはデフォルトで3時の方向から始まるため、-90度回転させて12時から始める
  const rotation = -90;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <G rotation={rotation} origin={`${cx}, ${cy}`}>
          {segments.map((segment, index) => {
            const percent = segment.value / total;
            const dashArray = `${circumference * percent} ${circumference * (1 - percent)}`;
            const dashOffset = -circumference * cumulativePercent;
            cumulativePercent += percent;

            return (
              <Circle
                key={index}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
      {/* 中央のテキスト */}
      {(centerLabel || centerSubLabel) && (
        <View
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerSubLabel && (
            <Text
              style={{
                fontSize: 11,
                color: "#5E7491",
                marginBottom: 2,
              }}
            >
              {centerSubLabel}
            </Text>
          )}
          {centerLabel && (
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#0D1B2A",
                letterSpacing: -0.5,
              }}
            >
              {centerLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
