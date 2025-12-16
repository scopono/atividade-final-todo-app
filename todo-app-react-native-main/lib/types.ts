export type uuid = string;


export type TodoItem = {
id: uuid;
text: string;
done: boolean;
createdAt: string; 
notes?: string | null; 
dueDate?: string | null; 
listId: uuid; 
listName?: string;
};


export type TodoList = {
id: uuid;
name: string;
createdAt: string;
};