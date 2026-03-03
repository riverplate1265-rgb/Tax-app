import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, G, Text as SvgText } from "react-native-svg";

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
  subLabel?: string;
}

interface BarChartProps {
  data: BarChartData[];
  width?: number;
  height?: number;
  barColor?: string;
  accentColor?: string;
  unit?: string;
  highlightIndex?: number;
}

export function BarChart({
  data,
  width = 320,
  height = 180,
  barColor = "#1A6FD4",
  accentColor = "#2ECC71",
  unit = "万円",
  highlightIndex,
}: BarChartProps) {
  if (!data || data.length === 0) return null;

  const paddingLeft = 8;
  const paddingRight = 8;
  const paddingTop = 16;
  const paddingBottom = 36;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = chartWidth / data.length;
  const barPadding = barWidth * 0.25;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <G>
          {data.map((item, index) => {
            const barH = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
            const x = paddingLeft + index * barWidth + barPadding / 2;
            const y = paddingTop + chartHeight - barH;
            const bw = barWidth - barPadding;
            const isHighlight = index === highlightIndex;
            const color = item.color ?? (isHighlight ? accentColor : barColor);

            return (
              <G key={index}>
                <Rect
                  x={x}
                  y={y}
                  width={bw}
                  height={barH}
                  fill={color}
                  rx={4}
                  ry={4}
                  opacity={isHighlight ? 1 : 0.75}
                />
                {/* ラベル */}
                <SvgText
                  x={x + bw / 2}
                  y={height - paddingBottom + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#5E7491"
                >
                  {item.label}
                </SvgText>
                {/* 値ラベル（上部） */}
                {barH > 20 && (
                  <SvgText
                    x={x + bw / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={color}
                    fontWeight="600"
                  >
                    {item.value}
                  </SvgText>
                )}
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

/**
 * 横棒グラフ（節税提案などに使用）
 */
interface HorizontalBarProps {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
  unit?: string;
}

export function HorizontalBar({
  label,
  value,
  maxValue,
  color = "#1A6FD4",
  unit = "万円",
}: HorizontalBarProps) {
  const ratio = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: "#0D1B2A", fontWeight: "500" }}>{label}</Text>
        <Text style={{ fontSize: 13, color, fontWeight: "700" }}>
          {Math.round(value / 10_000).toLocaleString()}{unit}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: "#D8E3EF", borderRadius: 4, overflow: "hidden" }}>
        <View
          style={{
            height: 8,
            width: `${ratio * 100}%`,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}
