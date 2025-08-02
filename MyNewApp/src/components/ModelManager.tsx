import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
} from 'react-native';
import { useContext } from 'react';
import { MaterialContext } from '../services/MaterialProfileService';
import TrainingDataService from '../services/TrainingDataService';

interface ModelManagerProps {
    onModelSelect?: (modelId: string) => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ onModelSelect }) => {
    const {
        userModels,
        presetModels,
        selectedModel,
        selectModel,
        refreshModels,
        isLoading,
    } = useContext(MaterialContext);

    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [modelName, setModelName] = useState('');
    const [materialType, setMaterialType] = useState('universal');
    const [isTraining, setIsTraining] = useState(false);

    const allModels = [...presetModels, ...userModels];

    const handleModelSelect = async (model: any) => {
        try {
            await selectModel(model);
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
                                refreshModels();
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
                    {item.material_type} • {item.is_preset ? 'Preset' : 'Custom'}
                    {item.accuracy && ` • ${item.accuracy.toFixed(1)}% accuracy`}
                </Text>
                {item.training_data_count > 0 && (
                    <Text style={[
                        styles.modelDetails,
                        selectedModel?.id === item.id && styles.selectedText,
                    ]}>
                        Trained with {item.training_data_count} samples
                    </Text>
                )}
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
            ) : (
                <FlatList
                    data={allModels}
                    renderItem={renderModelItem}
                    keyExtractor={(item) => item.id}
                    style={styles.modelList}
                    showsVerticalScrollIndicator={false}
                />
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
});

export default ModelManager; 