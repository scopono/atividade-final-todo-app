import { View, Text, TextInput, Button, Platform, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { getTodoById, updateTodoDetails } from "@/lib/db";
import DateTimePicker from "@react-native-community/datetimepicker";



export default function TodoDetailsScreen() {
    const { id, refresh } = useLocalSearchParams<{ id: string; refresh?: string }>();
    const db = useSQLiteContext();

    const [text, setText] = useState("");
    const [notes, setNotes] = useState("");
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);



    useEffect(() => {
        if (!id) return;

        async function load() {
        const todo = await getTodoById(db, id);
        if (!todo) return;

        setText(todo.text);
        setNotes(todo.notes ?? "");
        setDueDate(todo.dueDate ? new Date(todo.dueDate) : null);
        }

        load();
    }, [id]);

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
                        const base = dueDate ?? new Date();
                        const merged = new Date(selectedDate);
                        merged.setHours(base.getHours());
                        merged.setMinutes(base.getMinutes());
                        setDueDate(merged);
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

            <Button
                title="Salvar"
                onPress={async () => {
                await updateTodoDetails(db, id, notes || null, dueDate ? dueDate.toISOString(): null);
                router.back();
                }}
            />
        </View>
  );
}
