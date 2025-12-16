import { getTodoById, updateTodoDetails, deleteTodo } from "@/lib/db";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function TodoDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const db = useSQLiteContext();

    const [text, setText] = useState("");
    const [notes, setNotes] = useState("");
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        async function load() {
            try {
                console.log(`[INFO] Carregando detalhes do Todo ID: ${id}`);
                setLoading(true);
                const todo = await getTodoById(db, id);
                if (!todo) {
                    Alert.alert("Erro", "Tarefa não encontrada.");
                    router.back();
                    return;
                }

                setText(todo.text);
                setNotes(todo.notes ?? "");
                setDueDate(todo.dueDate ? new Date(todo.dueDate) : null);
            } catch (error) {
                console.error("Erro ao carregar detalhes:", error);
                Alert.alert("Erro", "Não foi possível carregar os detalhes da tarefa.");
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [id]);

    const handleSave = async () => {
        try {
            console.log(`[INFO] Tentando salvar detalhes do Todo ID: ${id}`);
            await updateTodoDetails(db, id, notes || null, dueDate ? dueDate.toISOString() : null);
            router.back();
        } catch (error) {
            console.error("Erro ao salvar detalhes:", error);
            Alert.alert("Erro", "Falha ao salvar as alterações.");
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const handleDelete = () => {
        Alert.alert(
            "Excluir tarefa",
            "Você tem certeza que deseja excluir esta tarefa?",
            [
            {
                text: "Cancelar",
                style: "cancel",
            },
            {
                text: "Excluir",
                style: "destructive",
                onPress: async () => {
                try {
                    console.log(`[INFO] Tentando excluir Todo ID: ${id}`);
                    await deleteTodo(db, id);
                    router.back();
                } catch (error) {
                    console.error("Erro ao excluir tarefa:", error);
                    Alert.alert("Erro", "Não foi possível excluir a tarefa.");
                }
                },
            },
        ]
    );
    };


    return (
        <View style={{ padding: 20 }}>
            <Stack.Screen options={{ title: "Detalhes da tarefa" }} />

            <Text style={{ fontSize: 20, fontWeight: "bold" }}>{text}</Text>

            <Text style={{ marginTop: 20 }}>Notas</Text>
            <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 10,
                    minHeight: 100,
                    textAlignVertical: "top" 
                }}
            />

            <Text style={{ marginTop: 20 }}>Data de vencimento</Text>
            <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    padding: 12,
                    borderRadius: 6,
                    marginTop: 8,
                }}
            >
                <Text>
                    {dueDate
                        ? dueDate.toLocaleString("pt-BR")
                        : "Selecionar data e hora"}
                </Text>
            </TouchableOpacity>

            {showDatePicker && (
                <DateTimePicker
                    value={dueDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                            const newDate = new Date(selectedDate);
                            if (dueDate) {
                                newDate.setHours(dueDate.getHours());
                                newDate.setMinutes(dueDate.getMinutes());
                            }
                            setDueDate(newDate); 
                            setShowTimePicker(true); 
                        }
                    }}
                />

            )}
            {showTimePicker && (
                <DateTimePicker
                    value={dueDate ?? new Date()}
                    mode="time"
                    display="default"
                    onChange={(_, selectedTime) => {
                        setShowTimePicker(false);

                        if (selectedTime) {
                            const base = dueDate ?? new Date();
                            const merged = new Date(base);
                            merged.setHours(selectedTime.getHours());
                            merged.setMinutes(selectedTime.getMinutes());

                            setDueDate(merged);
                        }
                    }}
                />
            )}

            <View style={{ marginTop: 16 }}>
                <TouchableOpacity
                    onPress={handleSave}
                    activeOpacity={0.8}
                    style={{
                    backgroundColor: "#3be7a5ff",
                    paddingVertical: 14,
                    borderRadius: 6,
                    alignItems: "center",
                    }}
                >                    
                    <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                        Salvar
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={{ marginTop: 16 }}>
                <TouchableOpacity
                    onPress={handleDelete}
                    activeOpacity={0.8}
                    style={{
                    backgroundColor: "#d32f2f",
                    paddingVertical: 14,
                    borderRadius: 6,
                    alignItems: "center",
                    }}
                >
                    <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                    Excluir tarefa
                    </Text>
                </TouchableOpacity>
            </View>

        </View>
    );
}