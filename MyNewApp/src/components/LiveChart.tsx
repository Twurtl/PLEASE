import React, { useMemo } from 'react';
import { View, Text, Dimensions, StyleSheet, ScrollView } from 'react-native';
import { AnomalyResult } from '../connection/WebsocketManager';

// Simple fallback chart component if react-native-chart-kit is not available
const SimpleChart: React.FC<{ data: any; width: number; height: number; chartConfig: any; style: any }> = ({ 
  data, width, height, style 
}) => {
  const voltageData = data.datasets[0]?.data || [];
  const maxVoltage = Math.max(...voltageData, 1);
  const minVoltage = Math.min(...voltageData, 0);
  const range = maxVoltage - minVoltage || 1;

  return (
    <View style={[{ width, height, backgroundColor: '#f8f9fa', borderRadius: 16, padding: 16 }, style]}>
      <Text style={{ textAlign: 'center', marginBottom: 8, fontSize: 12, color: '#666' }}>
        Simple Chart View (Install react-native-chart-kit for full features)
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
        {voltageData.slice(-20).map((value: number, index: number) => {
          const heightPercent = ((value - minVoltage) / range) * 80 + 10;
          return (
            <View
              key={index}
              style={{
                width: 8,
                height: `${heightPercent}%`,
                backgroundColor: '#007AFF',
                marginHorizontal: 1,
                borderRadius: 2,
              }}
            />
          );
        })}
      </View>
      <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: '#666' }}>
        Range: {minVoltage.toFixed(3)}V - {maxVoltage.toFixed(3)}V
      </Text>
    </View>
  );
};

// Try to import react-native-chart-kit, fallback to simple chart
let LineChart: any;
try {
  const { LineChart: LineChartType } = require('react-native-chart-kit');
  LineChart = LineChartType;
} catch (error) {
  console.log('react-native-chart-kit not available, using simple chart fallback');
  LineChart = SimpleChart;
}
const screenWidth = Dimensions.get('window').width;

type Props = {
  data: AnomalyResult[];
};

const LiveChart: React.FC<Props> = ({ data }) => {
  // Process data for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [0],
          color: () => '#007AFF',
          strokeWidth: 2,
        }],
      };
    }

    // Get the last 50 data points for better performance
    const recentData = data.slice(-50);
    
    // Create labels (time or index)
    const labels = recentData.map((_, index) => {
      if (index % 10 === 0) { // Show every 10th label
        return `${index}`;
      }
      return '';
    });

    // Voltage data
    const voltageData = recentData.map(d => d.voltage);
    
    // Anomaly score data (scaled to be visible)
    const anomalyData = recentData.map(d => d.anomaly_score * 5); // Scale up for visibility

    return {
      labels,
      datasets: [
        {
          data: voltageData,
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`, // Blue for voltage
          strokeWidth: 2,
        },
        {
          data: anomalyData,
          color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`, // Red for anomaly score
          strokeWidth: 2,
        }
      ],
    };
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    const recentData = data.slice(-50);
    const voltages = recentData.map(d => d.voltage);
    const anomalyScores = recentData.map(d => d.anomaly_score);
    
    return {
      currentVoltage: voltages[voltages.length - 1]?.toFixed(3) || 'N/A',
      avgVoltage: (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(3),
      maxVoltage: Math.max(...voltages).toFixed(3),
      minVoltage: Math.min(...voltages).toFixed(3),
      avgAnomalyScore: ((anomalyScores.reduce((a, b) => a + b, 0) / anomalyScores.length) * 100).toFixed(1),
      anomaliesInView: recentData.filter(d => d.is_anomaly).length,
    };
  }, [data]);

  // Anomaly points for highlighting
  const anomalyPoints = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const recentData = data.slice(-50);
    return recentData
      .map((d, index) => ({ ...d, index }))
      .filter(d => d.is_anomaly);
  }, [data]);

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 3,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16
    },
    propsForDots: {
      r: '2',
      strokeWidth: '1',
      stroke: '#ffa726'
    },
    fillShadowGradient: '#ffffff',
    fillShadowGradientOpacity: 0,
  };

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Real-Time Voltage Signal</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
          <Text style={styles.noDataSubtext}>
            Waiting for sensor readings... {data ? `(${data.length} points)` : '(no data)'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Real-Time Voltage Signal</Text>
      
      {/* Chart Statistics */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statValue}>{stats.currentVoltage}V</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>{stats.avgVoltage}V</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Range</Text>
              <Text style={styles.statValue}>{stats.minVoltage} - {stats.maxVoltage}V</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Avg Anomaly Score</Text>
              <Text style={styles.statValue}>{stats.avgAnomalyScore}%</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Anomalies in View</Text>
              <Text style={[styles.statValue, { color: stats.anomaliesInView > 0 ? '#FF3B30' : '#34C759' }]}>
                {stats.anomaliesInView}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Data Points</Text>
              <Text style={styles.statValue}>{Math.min(data.length, 50)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#007AFF' }]} />
          <Text style={styles.legendText}>Voltage</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF3B30' }]} />
          <Text style={styles.legendText}>Anomaly Score (×5)</Text>
        </View>
      </View>

      {/* Scrollable Chart Container */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContainer}
      >
        <LineChart
          data={chartData}
          width={Math.max(screenWidth - 64, data.length * 8)} // Dynamic width based on data points
          height={240}
          chartConfig={chartConfig}
          bezier={false} // Disable bezier for better performance with real-time data
          style={styles.chart}
          withDots={data.length <= 20} // Only show dots when we have few data points
          withShadow={false} // Disable shadow for better performance
          withVerticalLabels={true}
          withHorizontalLabels={true}
          segments={4} // Number of horizontal grid lines
        />
      </ScrollView>

      {/* Anomaly Indicators */}
      {anomalyPoints.length > 0 && (
        <View style={styles.anomalyIndicators}>
          <Text style={styles.anomalyTitle}>Recent Anomalies:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {anomalyPoints.slice(-5).map((anomaly, index) => (
              <View key={`${anomaly.timestamp}-${index}`} style={styles.anomalyChip}>
                <Text style={styles.anomalyChipText}>
                  {anomaly.voltage.toFixed(3)}V ({(anomaly.anomaly_score * 100).toFixed(1)}%)
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  statsContainer: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  chartScrollContainer: {
    paddingHorizontal: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  anomalyIndicators: {
    marginTop: 12,
  },
  anomalyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  anomalyChip: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  anomalyChipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default LiveChart;