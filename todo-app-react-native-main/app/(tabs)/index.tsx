import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";

import { createList, createTodo, getAllLists, getAllTodos, getDBVersion, getSQLiteVersion, updateTodoStatus } from "@/lib/db";
import { TodoItem, TodoList, uuid } from "@/lib/types";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { router, useFocusEffect } from "expo-router";
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

function formatDate(date: string) {
    try {
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch (e) {
        return "Data inválida";
    }
}

function RightAction({ prog, drag, isDone, onPress }: {
    prog: SharedValue<number>;
    drag: SharedValue<number>;
    isDone?: boolean;
    onPress: () => void;
}) {
    const styleAnimation = useAnimatedStyle(() => ({
        transform: [{ translateX: drag.value + 200 }],
    }));

    return (
        <Reanimated.View style={[styleAnimation, { width: 200, height: "100%" }]}>
            <TouchableOpacity
                style={{
                    flex: 1,
                    backgroundColor: isDone ? "orange" : "green",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    height: "100%",
                    borderRadius: 0,
                }}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
                    {isDone ? "Marcar como pendente" : "Marcar como concluído"}
                </Text>
            </TouchableOpacity>
        </Reanimated.View>
    );
}

const ListItem = React.memo(({ todoItem, toggleTodo }: { todoItem: TodoItem; toggleTodo: (id: uuid) => void }) => {
    const swipeableRef = useRef<SwipeableMethods>(null);

    const handlePress = (id: uuid) => {
        swipeableRef.current?.close();

        requestAnimationFrame(() => {
            toggleTodo(id);
        });
    };


    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 1 }}>
            <ReanimatedSwipeable
                ref={swipeableRef}
                containerStyle={styles.itemContainer}
                friction={2}
                enableTrackpadTwoFingerGesture
                rightThreshold={100}
                overshootRight={false} 
                renderRightActions={(prog, drag) => (
                    <RightAction
                        prog={prog}
                        drag={drag}
                        isDone={todoItem.done}
                        onPress={() => handlePress(todoItem.id)}
                    />
                )}
            >
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push({
                        pathname: "/todo/[id]",
                        params: { id: todoItem.id },
                    })}
                >
                <View style={styles.itemContent}>
                {/* TÍTULO */}
                <Text
                    style={[
                    styles.itemTitle,
                    todoItem.done && styles.itemTitleDone,
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                >
                    {todoItem.text}
                </Text>

                <View style={styles.itemMeta}>
                    <Text style={styles.itemListName}>
                    {todoItem.listName}
                    </Text>

                    <Text style={styles.itemDueDate}>
                    {todoItem.dueDate
                        ? `Vence em ${formatDate(todoItem.dueDate)}`
                        : "Sem data de vencimento"}
                    </Text>
                </View>
                </View>
                </TouchableOpacity>
            </ReanimatedSwipeable>
        </View>
    );
});

enum FilterOptions {
    All = "all",
    Pending = "pending",
    Done = "done"
}

function TodosFilter({ selectedValue, setFilter }: { selectedValue: FilterOptions, setFilter: (value: FilterOptions) => void }) {
    return (
        <View style={filterStyles.filterMenu}>
            <TouchableOpacity
                style={[filterStyles.button, filterStyles.buttonAll, selectedValue === FilterOptions.All && filterStyles.buttonAllSelected]}
                onPress={() => setFilter(FilterOptions.All)}
            >
                <Text style={[filterStyles.label, filterStyles.buttonAllLabel, selectedValue === FilterOptions.All && filterStyles.buttonAllSelectedLabel]}>Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[filterStyles.button, filterStyles.buttonPending, selectedValue === FilterOptions.Pending && filterStyles.buttonPendingSelected]}
                onPress={() => setFilter(FilterOptions.Pending)}
            >
                <Text style={[filterStyles.label, filterStyles.buttonPendingLabel, selectedValue === FilterOptions.Pending && filterStyles.buttonPendingSelectedLabel]}>Pendentes</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[filterStyles.button, filterStyles.buttonDone, selectedValue === FilterOptions.Done && filterStyles.buttonDoneSelected]}
                onPress={() => setFilter(FilterOptions.Done)}
            >
                <Text style={[filterStyles.label, filterStyles.buttonDoneLabel, selectedValue === FilterOptions.Done && filterStyles.buttonDoneSelectedLabel]}>Concluídos</Text>
            </TouchableOpacity>
        </View>
    );
}

function AddTodoForm({
  addTodoHandler,
  selectedList,
}: {
  addTodoHandler: (text: string, listId: string) => void;
  selectedList: string | "all";
}) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (selectedList === "all") {
      Alert.alert(
        "Selecione uma lista",
        "Escolha uma lista específica para criar a tarefa."
      );
      return;
    }

    if (!text.trim()) {
      Alert.alert("Atenção", "Digite o nome da tarefa.");
      return;
    }

    addTodoHandler(text.trim(), selectedList);
    setText("");
  };

  return (
    <View style={{ width: "100%", paddingHorizontal: 20, marginTop: 10 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="O que você precisa fazer?"
        style={styles.textInput}
      />

      <Button title="Adicionar tarefa" onPress={handleAdd} />
    </View>
  );
}


function Footer() {
    const db = useSQLiteContext();
    const [sqliteVersion, setSqliteVersion] = useState<string>("");
    const [dbVersion, setDBVersion] = useState<string>();

    useEffect(() => {
        async function setup() {
            const sqliteVersionResult = await getSQLiteVersion(db);
            setSqliteVersion(sqliteVersionResult ? sqliteVersionResult['sqlite_version()'] : 'Erro');

            const dbVersionResult = await getDBVersion(db);
            setDBVersion(dbVersionResult ? dbVersionResult['user_version'].toString() : 'Erro');
        }
        setup();
    }, [db]);

    return (
        <View>
            <Text style={{ padding: 20, textAlign: 'center', color: '#ccc' }}>
                SQLite v{sqliteVersion} / DB v{dbVersion}
            </Text>
        </View>
    );
}

const ListSelector = React.memo(function ListSelector({
    lists,
    selectedListId,
    onChange,
}: {
    lists: TodoList[];
    selectedListId: string | "all";
    onChange: (value: string | "all") => void;
}) {
    return (
        <Picker 
            selectedValue={selectedListId} 
            onValueChange={onChange} 
            style={{ width: "100%", height: 50 }}>
            <Picker.Item label="Todas as listas" value="all" />
            {lists.map(list => (
                <Picker.Item
                    key={list.id}
                    label={list.name}
                    value={list.id}
                />
            ))}
        </Picker>
    );
})


function TodoReload() {
    const [todos, setTodos] = React.useState<TodoItem[]>([]);
    const [lists, setLists] = useState<TodoList[]>([]);
    const [listName, setListName] = useState("");
    const [selectedList, setSelectedList] = useState<string | "all">("all");
    const [filter, setFilter] = React.useState<FilterOptions>(FilterOptions.All);
    const [isLoading, setIsLoading] = useState(false);

    const db = useSQLiteContext();

    const handleListChange = useCallback((value: string | "all") => {
        console.log(`[EVENTO] Lista selecionada alterada para: ${value}`);
        setSelectedList(value);
    }, []); 

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            async function load() {
                try {
                    console.log(`[INFO] Iniciando carregamento de dados. Lista selecionada: ${selectedList}`); 
                    setIsLoading(true);
                    const allTodos = await getAllTodos(db);
                    const allLists = await getAllLists(db);

                    if (isActive) {
                        setLists(allLists);
                        setTodos(allTodos);

                        if (selectedList !== "all" && !allLists.some(l => l.id === selectedList)) {
                            console.log("[WARN] Lista selecionada inválida. Resetando para 'all'.");
                            setSelectedList("all");
                        }
                    }
                } catch (e) {
                    console.error("Erro ao carregar dados iniciais", e);
                    Alert.alert("Erro", "Falha ao carregar dados.");
                } finally {
                    console.log(`[INFO] Carregamento finalizado. Total Todos: ${todos.length}`);
                    if (isActive) setIsLoading(false);
                }
            }

            load();

            return () => {
                isActive = false;
            };
        }, [db])
    );

    const reloadTodos = async () => {
        try {
            console.log("[INFO] Recarregando tarefas...");
            const updatedTodos = await getAllTodos(db);
            setTodos(updatedTodos);
        } catch (e) {
            console.error("Erro ao recarregar todos", e);
        }
    };

    const addTodo = async (text: string, listId: string) => {
        try {
            console.log(`[INFO] Tentando adicionar tarefa: "${text}" na lista ${listId}`);
            await createTodo(db, text, listId);
            await reloadTodos();
        } catch (e) {
            console.error("Erro ao adicionar tarefa", e);
            Alert.alert("Erro", "Não foi possível criar a tarefa.");
        }
    };

    const addList = async (name: string) => {
        try {
            console.log(`[INFO] Tentando adicionar lista: "${name}"`);
            const newList = await createList(db, name);
            if (newList) {
                setLists(prev => [...prev, newList]);
            }
        } catch (e) {
            console.error("Erro ao criar lista", e);
            Alert.alert("Erro", "Não foi possível criar a lista.");
        }
    };

    const toggleTodo = useCallback(async (id: uuid) => {
        try {
            const todo = todos.find(todo => todo.id === id);
            if (!todo) {
              console.log(`[WARN] Tentativa de toggle em Todo não encontrado: ${id}`);
              return;
            }

            console.log(`[INFO] Mudando status do Todo ${id} para: ${!todo.done}`);
            await updateTodoStatus(db, id, !todo.done);
            await reloadTodos();
        } catch (e) {
            console.error("Erro ao atualizar status", e);
            Alert.alert("Erro", "Não foi possível atualizar a tarefa.");
        }
    }, [db, todos]);

    const filteredTodos = useMemo(() => {
        const result = todos.filter(todo => {
            if (selectedList !== "all" && todo.listId !== selectedList) {
                return false;
            }
            switch (filter) {
                case FilterOptions.Pending: return !todo.done;
                case FilterOptions.Done: return todo.done;
                case FilterOptions.All:
                default: return true;
            }
        });
        console.log(`[MEMO] Recalculando filteredTodos. Lista: ${selectedList}, Filtro: ${filter}, Total Todos: ${todos.length}`);
        return result;
    }, [todos, selectedList, filter]); 

    if (isLoading && todos.length === 0) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
                <Text>Carregando...</Text>
            </View>
        )
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <Text style={{ fontSize: 32, fontWeight: "bold", marginTop: 20 }}>
                TODO List
            </Text>

            <ListSelector
                lists={lists}
                selectedListId={selectedList}
                onChange={handleListChange}
            />

            <View style={{ width: "100%", paddingHorizontal: 20 }}>
                <TextInput
                    value={listName}
                    onChangeText={setListName}
                    placeholder="Nome da nova lista"
                    style={styles.textInput}
                />

                <Button
                    title="Criar Lista"
                    onPress={() => {
                        if (!listName.trim()) {
                            Alert.alert("Atenção", "O nome da lista não pode ser vazio.");
                            return;
                        }
                        addList(listName.trim());
                        setListName("");
                    }}
                />
            </View>

            <AddTodoForm
                addTodoHandler={addTodo}
                selectedList={selectedList}
            />

            <TodosFilter selectedValue={filter} setFilter={(value => {
              console.log(`[EVENTO] Opção de filtro alterada para: ${value}`);
              setFilter(value);
            })} />

            <FlatList
                style={styles.list}
                key={`${selectedList}-${filter}`}
                keyExtractor={(item) => item.id.toString()}
                data={filteredTodos}
                renderItem={({ item }) => (
                    <ListItem todoItem={item} toggleTodo={toggleTodo} />
                )}
                ListEmptyComponent={
                    <Text style={{ textAlign: 'center', marginTop: 20, color: '#888' }}>
                        Nenhuma tarefa encontrada.
                    </Text>
                }
            />
        </GestureHandlerRootView>
    );
}

export default function Index() {
    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
                <TodoReload />
                <Footer />
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignContent: "center",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
    },
    textInput: {
        width: "100%",
        borderColor: "#ccc",
        borderWidth: 1,
        marginVertical: 10,
        padding: 10,
        borderRadius: 8,
    },
itemContainer: {
  width: "100%",
  backgroundColor: "white",
  marginVertical: 4,
},

itemContent: {
  paddingHorizontal: 14,
  paddingVertical: 10,
},

itemTitle: {
  fontSize: 18,
  fontWeight: "600",
  color: "#111",
},

itemTitleDone: {
  textDecorationLine: "line-through",
  color: "#aaa",
},

itemMeta: {
  marginTop: 4,
},

itemListName: {
  fontSize: 12,
  color: "#888",
},

itemDueDate: {
  fontSize: 12,
  color: "#666",
  marginTop: 2,
},
    list: {
        width: "100%",
        backgroundColor: "white",
        padding: 10,
        marginTop: 10,
    },
});

const filterStyles = StyleSheet.create({
    filterMenu: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: 20,
        marginTop: 10
    },
    button: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 50,
        alignSelf: 'flex-start',
        marginHorizontal: '1%',
        marginBottom: 6,
        minWidth: '28%',
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    buttonAll: { backgroundColor: 'lightgreen' },
    buttonAllSelected: { backgroundColor: 'darkgreen' },
    buttonAllLabel: { color: 'darkgreen' },
    buttonAllSelectedLabel: { color: 'lightgreen' },

    buttonPending: { backgroundColor: 'oldlace' },
    buttonPendingSelected: { backgroundColor: 'coral' },
    buttonPendingLabel: { color: 'coral' },
    buttonPendingSelectedLabel: { color: 'oldlace' },

    buttonDone: { backgroundColor: 'lightblue' },
    buttonDoneSelected: { backgroundColor: 'royalblue' },
    buttonDoneLabel: { color: 'royalblue' },
    buttonDoneSelectedLabel: { color: 'lightblue' },
});