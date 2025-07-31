import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart as LineChartType } from 'react-native-chart-kit';
import { AnomalyResult } from '../connection/WebsocketManager';

const LineChart = LineChartType as any;
const screenWidth = Dimensions.get('window').width;

type Props = {
  data: AnomalyResult[];
};

const LiveChart: React.FC<Props> = ({ data }) => {
  const voltages = data.map(d => d.voltage);

  return (
    <View>
      <Text style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>
        Real-Time Voltage Signal 
      </Text>
      <LineChart
        data={{
          labels: [],
          datasets: [
            {
              data: voltages,
            },
          ],
        }}
        width={screenWidth - 32}
        height={220}
        yAxisSuffix="V"
        chartConfig={{
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 2,
          color: () => `#ff6600`,
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
};

export default LiveChart;
