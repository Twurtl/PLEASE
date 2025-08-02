import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface MLStatus {
    window_progress: number;
    window_size: number;
    current_window: number;
    status: 'warming_up' | 'ml_ready' | 'error' | 'unknown';
    method: 'ml_model' | 'rule_based' | 'data_processing' | 'unknown';
}

interface Props {
    mlStatus?: MLStatus;
    isConnected: boolean;
}

const MLStatusPanel: React.FC<Props> = ({ mlStatus, isConnected }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ml_ready':
                return '#34C759'; // Green
            case 'warming_up':
                return '#FF9500'; // Orange
            case 'error':
                return '#FF3B30'; // Red
            default:
                return '#8E8E93'; // Gray
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'ml_ready':
                return 'ML Model Active';
            case 'warming_up':
                return 'Warming Up ML Model';
            case 'error':
                return 'ML Model Error';
            default:
                return 'Unknown Status';
        }
    };

    const getMethodText = (method: string) => {
        switch (method) {
            case 'ml_model':
                return 'LSTM Neural Network';
            case 'rule_based':
                return 'Rule-Based Detection';
            default:
                return 'Unknown Method';
        }
    };

    if (!isConnected) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>ML Model Status</Text>
                <View style={styles.statusContainer}>
                    <Text style={[styles.statusText, { color: '#8E8E93' }]}>
                        Not Connected
                    </Text>
                </View>
            </View>
        );
    }

    if (!mlStatus) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>ML Model Status</Text>
                <View style={styles.statusContainer}>
                    <Text style={[styles.statusText, { color: '#8E8E93' }]}>
                        Waiting for data...
                    </Text>
                </View>
            </View>
        );
    }

    const progressPercentage = Math.round(mlStatus.window_progress * 100);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ML Model Status</Text>

            {/* Status Indicator */}
            <View style={styles.statusContainer}>
                <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(mlStatus.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(mlStatus.status) }]}>
                        {getStatusText(mlStatus.status)}
                    </Text>
                </View>

                <Text style={styles.methodText}>
                    {getMethodText(mlStatus.method)}
                </Text>
            </View>

            {/* Rolling Window Progress */}
            <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Rolling Window</Text>
                    <Text style={styles.progressText}>
                        {mlStatus.current_window} / {mlStatus.window_size}
                    </Text>
                </View>

                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progressPercentage}%`,
                                    backgroundColor: getStatusColor(mlStatus.status)
                                }
                            ]}
                        />
                    </View>
                    <Text style={styles.progressPercentage}>{progressPercentage}%</Text>
                </View>
            </View>

            {/* Window Status */}
            <View style={styles.windowStatus}>
                {mlStatus.status === 'warming_up' && (
                    <Text style={styles.windowStatusText}>
                        Collecting data for ML model... ({mlStatus.window_size - mlStatus.current_window} more readings needed)
                    </Text>
                )}
                {mlStatus.status === 'ml_ready' && (
                    <Text style={styles.windowStatusText}>
                        ML model analyzing real-time data with {mlStatus.window_size}-point rolling window
                    </Text>
                )}
                {mlStatus.status === 'error' && (
                    <Text style={styles.windowStatusText}>
                        Error in ML model. Using fallback detection.
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1C1C1E',
        marginBottom: 12,
    },
    statusContainer: {
        marginBottom: 16,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
    },
    methodText: {
        fontSize: 14,
        color: '#8E8E93',
        marginLeft: 16,
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1C1C1E',
    },
    progressText: {
        fontSize: 14,
        color: '#8E8E93',
    },
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBarBackground: {
        flex: 1,
        height: 8,
        backgroundColor: '#E5E5EA',
        borderRadius: 4,
        marginRight: 12,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressPercentage: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        minWidth: 35,
    },
    windowStatus: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
    },
    windowStatusText: {
        fontSize: 13,
        color: '#8E8E93',
        lineHeight: 18,
    },
});

export default MLStatusPanel; 