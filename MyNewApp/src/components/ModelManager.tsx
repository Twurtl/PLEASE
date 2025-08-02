import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
} from 'react-native';
import { useWebSocket } from '../connection/WebsocketManager';
import TrainingDataService from '../services/TrainingDataService';

interface ModelManagerProps {
    onModelSelect?: (modelId: string) => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onModelSelect }) => {
    const { wsGetModels, wsSelectModel, lastMessage } = useWebSocket();
    const [models, setModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [modelName, setModelName] = useState('');
    const [materialType, setMaterialType] = useState('universal');
    const [isTraining, setIsTraining] = useState(false);

    // Load models on component mount
    useEffect(() => {
        setIsLoading(true);
        wsGetModels();
    }, []);

    // Listen for model responses
    useEffect(() => {
        if (lastMessage) {
            console.log('ModelManager received message:', lastMessage.type);
            if (lastMessage.type === 'models_response' && lastMessage.models) {
                console.log('Models received:', lastMessage.models);
                setModels(lastMessage.models);
                setIsLoading(false);
            } else if (lastMessage.type === 'model_selected' && lastMessage.model) {
                console.log('Model selected:', lastMessage.model);
                setSelectedModel(lastMessage.model);
            }
        }
    }, [lastMessage]);

    const handleModelSelect = (model: any) => {
        try {
            wsSelectModel(model.id);
            if (onModelSelect) {
                onModelSelect(model.id);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to select model');
        }
    };

    const handleTrainNewModel = async () => {
        if (!modelName.trim()) {
            Alert.alert('Error', 'Please enter a model name');
            return;
        }

        setIsTraining(true);
        try {
            // First collect training data
            Alert.alert(
                'Training Data Collection',
                'The app will now collect training data. Please ensure your Arduino is connected and ready.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsTraining(false),
                    },
                    {
                        text: 'Start Collection',
                        onPress: async () => {
                            try {
                                // Collect normal data
                                await TrainingDataService.collectTrainingData('normal', materialType);

                                // Collect anomaly data
                                await TrainingDataService.collectTrainingData('anomaly', materialType);

                                // Train the model
                                const result = await TrainingDataService.trainNewModel(modelName, materialType);

                                Alert.alert('Success', `Model "${modelName}" trained successfully with ${result.accuracy?.toFixed(2)}% accuracy`);
                                setShowTrainingModal(false);
                                setModelName('');
                                // Refresh models list
                                wsGetModels();
                            } catch (error) {
                                Alert.alert('Error', 'Failed to train model. Please try again.');
                            } finally {
                                setIsTraining(false);
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to start training process');
            setIsTraining(false);
        }
    };

    const renderModelItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[
                styles.modelItem,
                selectedModel?.id === item.id && styles.selectedModelItem,
            ]}
            onPress={() => handleModelSelect(item)}
        >
            <View style={styles.modelInfo}>
                <Text style={[
                    styles.modelName,
                    selectedModel?.id === item.id && styles.selectedText,
                ]}>
                    {item.name}
                </Text>
                <Text style={[
                    styles.modelDetails,
                    selectedModel?.id === item.id && styles.selectedText,
                ]}>
                    {item.framework || 'TensorFlow'} • {item.is_preset ? 'Preset Model' : 'User Model'}
                    {item.accuracy && ` • ${item.accuracy.toFixed(1)}% accuracy`}
                </Text>
                <Text style={[
                    styles.modelDetails,
                    selectedModel?.id === item.id && styles.selectedText,
                ]}>
                    Status: {item.is_active ? 'Active' : 'Available'}
                </Text>
            </View>
            {selectedModel?.id === item.id && (
                <Text style={styles.checkmark}>✓</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>ML Models</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowTrainingModal(true)}
                >
                    <Text style={styles.addButtonText}>+ Train New</Text>
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" style={styles.loader} />
            ) : models.length > 0 ? (
                <View style={styles.modelList}>
                    {models.map((item) => (
                        <View key={item.id}>
                            {renderModelItem({ item })}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No ML models available</Text>
                    <Text style={styles.emptySubtext}>Train a new model or check your connection</Text>
                </View>
            )}

            <Modal
                visible={showTrainingModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTrainingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Train New Model</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Model Name"
                            value={modelName}
                            onChangeText={setModelName}
                        />

                        <Text style={styles.label}>Material Type:</Text>
                        <View style={styles.materialButtons}>
                            {['concrete', 'wood', 'metal', 'universal'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.materialButton,
                                        materialType === type && styles.selectedMaterialButton,
                                    ]}
                                    onPress={() => setMaterialType(type)}
                                >
                                    <Text style={[
                                        styles.materialButtonText,
                                        materialType === type && styles.selectedMaterialButtonText,
                                    ]}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowTrainingModal(false)}
                                disabled={isTraining}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.trainButton, isTraining && styles.disabledButton]}
                                onPress={handleTrainNewModel}
                                disabled={isTraining}
                            >
                                {isTraining ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.trainButtonText}>Start Training</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    addButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    loader: {
        marginTop: 50,
    },
    modelList: {
        flex: 1,
        padding: 20,
    },
    modelItem: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 10,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    selectedModelItem: {
        backgroundColor: '#007AFF',
    },
    modelInfo: {
        flex: 1,
    },
    modelName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    selectedText: {
        color: '#fff',
    },
    modelDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    checkmark: {
        fontSize: 18,
        color: '#fff',
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    materialButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    materialButton: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
    },
    selectedMaterialButton: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    materialButtonText: {
        color: '#333',
        fontSize: 14,
    },
    selectedMaterialButtonText: {
        color: '#fff',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    trainButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginLeft: 8,
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    trainButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
});

export default ModelManager; 