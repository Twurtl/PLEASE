import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart as BarChartType } from 'react-native-chart-kit';
const BarChart = BarChartType as any;

interface FrequencyAnalyzerProps {
  data: number[];
}

export default function FrequencyAnalyzer({ data }: FrequencyAnalyzerProps) {
  const labels = data.map((_, i) => i.toString());
  const chartData = {
    labels,
    datasets: [{ data }],
  };

  const chartConfig = {
    backgroundGradientFrom: '#1E2923',
    backgroundGradientTo: '#08130D',
    color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
    strokeWidth: 2,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Frequency Spectrum</Text>
      <BarChart
        data={chartData}
        width={320}
        height={200}
        chartConfig={chartConfig}
        withInnerLines={false}
        showBarTops={false}
        fromZero
        yAxisLabel=""
        yAxisSuffix=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
});
