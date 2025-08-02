// ArduinoConnectionScreen.tsx
import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useWebSocket } from '../connection/WebsocketManager';

const ArduinoConnectionScreen: React.FC = () => {
    const {
        isConnected,
        connectionStatus,
        serialConnected,
        serverStatus,
        latestData,
        connectToArduino,
        disconnectFromArduino,
        requestStatus,
        startDetection,
        stopDetection,
        mlStatus
    } = useWebSocket();

    const handleConnect = () => {
        try {
            connectToArduino();
        } catch (error) {
            Alert.alert('Connection Error', 'Failed to connect to Arduino');
        }
    };

    const handleDisconnect = () => {
        try {
            disconnectFromArduino();
        } catch (error) {
            Alert.alert('Disconnection Error', 'Failed to disconnect from Arduino');
        }
    };

    const handleStartDetection = () => {
        try {
            startDetection();
        } catch (error) {
            Alert.alert('Detection Error', 'Failed to start detection');
        }
    };

    const handleStopDetection = () => {
        try {
            stopDetection();
        } catch (error) {
            Alert.alert('Detection Error', 'Failed to stop detection');
        }
    };

    const getConnectionStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return '#4CAF50';
            case 'connecting': return '#FF9800';
            case 'error': return '#F44336';
            case 'disconnected': return '#9E9E9E';
            default: return '#9E9E9E';
        }
    };

    const getConnectionStatusText = () => {
        switch (connectionStatus) {
            case 'connected': return 'Connected to Server';
            case 'connecting': return 'Connecting...';
            case 'error': return 'Connection Error';
            case 'disconnected': return 'Disconnected';
            default: return 'Unknown Status';
        }
    };

    const getMLStatusText = () => {
        if (!mlStatus) return 'No ML Status';
        switch (mlStatus.status) {
            case 'warming_up': return 'ML Model Warming Up';
            case 'ml_ready': return 'ML Model Ready';
            case 'error': return 'ML Model Error';
            default: return 'ML Status Unknown';
        }
    };

    const isDetectionRunning = mlStatus?.status === 'ml_ready';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Arduino Connection & Detection</Text>

            {/* Server Connection Status */}
            <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Server Status</Text>
                <View style={styles.statusRow}>
                    <View style={[styles.statusIndicator, { backgroundColor: getConnectionStatusColor() }]} />
                    <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
                </View>

                {serverStatus && (
                    <Text style={styles.statusDetails}>
                        Connected Clients: {serverStatus.connected_clients}
                    </Text>
                )}
            </View>

            {/* Arduino Connection Status */}
            <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Arduino Status</Text>
                <View style={styles.statusRow}>
                    <View style={[
                        styles.statusIndicator,
                        { backgroundColor: serialConnected ? '#4CAF50' : '#9E9E9E' }
                    ]} />
                    <Text style={styles.statusText}>
                        {serialConnected ? 'Arduino Connected' : 'Arduino Disconnected'}
                    </Text>
                </View>
            </View>

            {/* ML Detection Status */}
            <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Detection Status</Text>
                <View style={styles.statusRow}>
                    <View style={[
                        styles.statusIndicator,
                        { backgroundColor: isDetectionRunning ? '#4CAF50' : '#9E9E9E' }
                    ]} />
                    <Text style={styles.statusText}>
                        {getMLStatusText()}
                    </Text>
                </View>
                {mlStatus && (
                    <View style={styles.mlStatusDetails}>
                        <Text style={styles.statusDetails}>
                            Method: {mlStatus.method || 'Unknown'}
                        </Text>
                        <Text style={styles.statusDetails}>
                            Window: {mlStatus.current_window}/{mlStatus.window_size}
                        </Text>
                        <Text style={styles.statusDetails}>
                            Progress: {(mlStatus.window_progress * 100).toFixed(1)}%
                        </Text>
                    </View>
                )}
            </View>

            {/* Latest Data Display */}
            {latestData && (
                <View style={styles.dataSection}>
                    <Text style={styles.sectionTitle}>Latest Reading</Text>
                    <Text style={styles.dataText}>Voltage: {latestData.voltage.toFixed(3)}V</Text>
                    <Text style={[
                        styles.dataText,
                        { color: latestData.is_anomaly ? '#F44336' : '#4CAF50' }
                    ]}>
                        Anomaly: {latestData.is_anomaly ? 'YES' : 'NO'}
                        ({(latestData.confidence * 100).toFixed(1)}%)
                    </Text>
                    <Text style={styles.dataText}>
                        Score: {latestData.anomaly_score.toFixed(3)}
                    </Text>
                    {latestData.method && (
                        <Text style={styles.dataText}>
                            Method: {latestData.method}
                        </Text>
                    )}
                </View>
            )}

            {/* Connection Controls */}
            <View style={styles.buttonSection}>
                {/* Arduino Connection Button */}
                {!serialConnected ? (
                    <TouchableOpacity
                        style={[styles.button, styles.connectButton]}
                        onPress={handleConnect}
                        disabled={connectionStatus === 'connecting' || !isConnected}
                    >
                        {connectionStatus === 'connecting' ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Connect to Arduino</Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.button, styles.disconnectButton]}
                        onPress={handleDisconnect}
                    >
                        <Text style={styles.buttonText}>Disconnect Arduino</Text>
                    </TouchableOpacity>
                )}

                {/* Detection Control Buttons */}
                {serialConnected && (
                    <>
                        {!isDetectionRunning ? (
                            <TouchableOpacity
                                style={[styles.button, styles.detectionButton]}
                                onPress={handleStartDetection}
                            >
                                <Text style={styles.buttonText}>Start Detection</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.button, styles.stopButton]}
                                onPress={handleStopDetection}
                            >
                                <Text style={styles.buttonText}>Stop Detection</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* Status Refresh Button */}
                {isConnected && (
                    <TouchableOpacity
                        style={[styles.button, styles.statusButton]}
                        onPress={requestStatus}
                    >
                        <Text style={styles.buttonText}>Refresh Status</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Instructions */}
            <View style={styles.instructionsSection}>
                <Text style={styles.instructionsTitle}>Instructions:</Text>
                <Text style={styles.instructionsText}>
                    1. Make sure your Arduino is connected via USB
                </Text>
                <Text style={styles.instructionsText}>
                    2. Ensure the backend server is running on localhost:8000
                </Text>
                <Text style={styles.instructionsText}>
                    3. Click "Connect to Arduino" to establish serial connection
                </Text>
                <Text style={styles.instructionsText}>
                    4. Select an ML model from the login screen before starting detection
                </Text>
                <Text style={styles.instructionsText}>
                    5. Click "Start Detection" to begin real-time anomaly detection
                </Text>
                <Text style={styles.instructionsText}>
                    6. Watch for real-time voltage readings and anomaly alerts
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
        color: '#333',
    },
    statusSection: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    statusText: {
        fontSize: 14,
        color: '#666',
    },
    statusDetails: {
        fontSize: 12,
        color: '#999',
        marginTop: 5,
    },
    mlStatusDetails: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    dataSection: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    dataText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 5,
        fontFamily: 'monospace',
    },
    buttonSection: {
        marginBottom: 20,
    },
    button: {
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    connectButton: {
        backgroundColor: '#4CAF50',
    },
    disconnectButton: {
        backgroundColor: '#F44336',
    },
    detectionButton: {
        backgroundColor: '#2196F3',
    },
    stopButton: {
        backgroundColor: '#FF9800',
    },
    statusButton: {
        backgroundColor: '#9C27B0',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    instructionsSection: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    instructionsText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
        lineHeight: 20,
    },
});

export default ArduinoConnectionScreen;