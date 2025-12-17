import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";

import { Alert } from "react-native";

import { createTodo, createList, getAllTodos, getAllLists, getDBVersion, getSQLiteVersion, updateTodoStatus } from "@/lib/db";
import { TodoItem, TodoList, uuid } from "@/lib/types";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { FadeIn, FadeOut, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";

// No componente RightAction, os parâmetros prog e drag são valores compartilhados (SharedValue) fornecidos pelo ReanimatedSwipeable:

// prog (progress): representa o progresso do swipe, normalmente variando de 0 (sem swipe) até 1 (swipe completo). Pode ser usado para animar elementos conforme o usuário desliza.
// drag: representa o deslocamento horizontal do swipe, ou seja, quantos pixels o item foi arrastado para o lado. Usado para animar a posição ou outros estilos do botão de ação.
// Esses valores permitem criar animações reativas e dinâmicas no botão de ação, tornando a experiência de swipe mais fluida e visualmente agradável.
function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function ListItem({ todoItem, toggleTodo }: { todoItem: TodoItem; toggleTodo: (id: uuid) => void }) {

  const swipeableRef = useRef<SwipeableMethods>(null);

  const handlePress = (id: uuid) => {
    swipeableRef.current?.close();
    toggleTodo(id); // remove do estado imediatamente, animação de saída será aplicada
  };

  return (
    <Reanimated.View exiting={FadeOut} entering={FadeIn}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ReanimatedSwipeable
          ref={swipeableRef}
          containerStyle={styles.item}
          friction={1}
          enableTrackpadTwoFingerGesture
          rightThreshold={200}
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
                params: {
                  id: todoItem.id,
                  refresh: "true",
                },
              })
            }
          >
            <Text style={todoItem.done ? styles.itemdone : styles.item}>{todoItem.text}</Text>
            <Text style={{ fontSize: 12, color: "#888" }}>
            {todoItem.listName}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {todoItem.dueDate
                ? `Vence em ${formatDate(todoItem.dueDate)}`
                : "Sem data de vencimento"}
            </Text>
          </TouchableOpacity>
        </ReanimatedSwipeable>
      </View>
    </Reanimated.View>
  );
}

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
  onAddTodo,
}: {
  onAddTodo: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    onAddTodo(text.trim());
    setText("");
    Keyboard.dismiss();
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="O que precisa ser feito?"
        style={styles.textInput}
      />
      <Button title="Adicionar Tarefa" onPress={handleAdd} color="#4CAF50" />
    </View>
  );
}


function AddListForm({ onAddList }: { onAddList: (name: string) => void }) {
  const [listName, setListName] = useState("");

  const handleAdd = () => {
    if (!listName.trim()) return;
    onAddList(listName.trim());
    setListName("");
    Keyboard.dismiss();
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        value={listName}
        onChangeText={setListName}
        placeholder="Nome da nova lista (ex: Trabalho)"
        style={styles.textInput}
      />
      <Button title="Criar Lista" onPress={handleAdd} color="#2196F3" />
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
      if (sqliteVersionResult) {
        setSqliteVersion(sqliteVersionResult['sqlite_version()']);
      }
      else {
        setSqliteVersion('unknown');
      }

      const dbVersionResult = await getDBVersion(db);

      if (dbVersionResult) {
        setDBVersion(dbVersionResult['user_version'].toString());
      }
      else {
        setDBVersion('unknown');
      }
    }

    setup();
  }, [db]);

  return (
    <View>
      <Text style={{ padding: 20 }}>SQLite version: {sqliteVersion} / DBVersion: {dbVersion}</Text>
    </View>
  );
}

function ListSelector({
  lists,
  selectedListId,
  onChange,
}: {
  lists: TodoList[];
  selectedListId: string | "all";
  onChange: (value: string | "all") => void;
}) {
  return (
    <Picker selectedValue={selectedListId} onValueChange={onChange} style={{ width: "100%", height: 50 }}>
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
}


function TodoListView() {

  const [todos, setTodos] = React.useState<TodoItem[]>([]);
  const [lists, setLists] = useState<TodoList[]>([]);
  const [selectedList, setSelectedList] = useState<string | "all">("all");


  const db = useSQLiteContext();

  useEffect(() => {
    async function load() {
      const allTodos = await getAllTodos(db);
      const allLists = await getAllLists(db);
      setLists(allLists);
      setTodos(allTodos);
    }

    load();

  }, [db])
  console.log(selectedList);
  const [filter, setFilter] = React.useState<FilterOptions>(FilterOptions.All);

  const reloadTodos = async () => {
    const updatedTodos = await getAllTodos(db);
    setTodos(updatedTodos);
  };

  useFocusEffect(
    useCallback(() => {
      reloadTodos();
    }, [db])
  );
const addTodo = async (text: string) => {
  if (selectedList === "all") {
    Alert.alert(
      "Selecione uma lista",
      "Para adicionar uma tarefa, escolha uma lista específica."
    );
    return;
  }

  await createTodo(db, text, selectedList);
  await reloadTodos();
};



  const addList = async (name: string) => {
    const newList = await createList(db, name);
    setLists(prev => [...prev, newList]);
};

  const toggleTodo = async (id: uuid) => {
    await updateTodoStatus(
      db,
      id,
      !todos.find(todo => todo.id === id)?.done
    );
  await reloadTodos();
};


  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={{ fontSize: 32, fontWeight: "bold", marginTop: 20 }}>
        TODO List
      </Text>
      <ListSelector
        lists={lists}
        selectedListId={selectedList}
        onChange={(value) => setSelectedList(value)}
      />

      <AddListForm onAddList={addList} />
      <View style={{ height: 1, backgroundColor: '#eee', width: '90%', marginVertical: 10 }} />
      <AddTodoForm onAddTodo={addTodo} />

      <TodosFilter selectedValue={filter} setFilter={setFilter} />
      <FlatList
        style={styles.list}
        data={todos.filter(todo => {

            if (selectedList === "all") return true;
            return todo.listId === selectedList;
        }).filter(todo => { 
          switch (filter) {
            case FilterOptions.All:
              return true;
            case FilterOptions.Pending:
              return !todo.done;
            case FilterOptions.Done:
              return todo.done;
            default:
              return true;
          }
        })}
        renderItem={({ item }) => (
          <ListItem todoItem={item} toggleTodo={toggleTodo} />
        )}
        contentContainerStyle={{
          paddingBottom: 100
        }}
      />
    </GestureHandlerRootView>
  );
}


export default function Index() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
        <TodoListView />
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
    borderColor: "black",
    borderWidth: 1,
    margin: 10,
    padding: 10,
    borderRadius: 50,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
    width: "100%"
  },
  itemdone: {
    padding: 10,
    fontSize: 18,
    height: 44,
    textDecorationLine: "line-through",
    width: "100%"
  },
  list: {
    width: "100%",
    backgroundColor: "white",
    padding: 10,
    marginTop: 20,
  },
  formContainer: {
    width: "100%",
    paddingHorizontal: 20,
    marginVertical: 10,
    alignItems: "center",
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

  buttonAll: {
    backgroundColor: 'lightgreen',
  },
  buttonAllSelected: {
    backgroundColor: 'darkgreen',
  },

  buttonAllLabel: {
    color: 'darkgreen',
  },

  buttonAllSelectedLabel: {
    color: 'lightgreen',
  },

  buttonPending: {
    backgroundColor: 'oldlace',
  },
  buttonPendingSelected: {
    backgroundColor: 'coral',
  },

  buttonPendingLabel: {
    color: 'coral',
  },
  buttonPendingSelectedLabel: {
    color: 'oldlace',
  },

  buttonDone: {
    backgroundColor: 'lightblue',
  },
  buttonDoneSelected: {
    backgroundColor: 'royalblue',
  },
  buttonDoneLabel: {
    color: 'royalblue',
  },
  buttonDoneSelectedLabel: {
    color: 'lightblue',
  },

  selectedLabel: {
    color: 'white',
  },
});

