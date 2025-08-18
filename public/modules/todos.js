export class Todos {
  constructor(state, broadcastUpdate) {
    this.state = state;
    this.broadcastUpdate = broadcastUpdate;
  }

  async addTodo(text) {
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    if (!this.state.todos) this.state.todos = [];
    this.state.todos.push(newTodo);
    this.broadcastUpdate();
    console.log("[v1][Todos] Todo added:", newTodo);
  }

  async toggleTodo(todoId) {
    const todo = this.state.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? new Date().toISOString() : null;
      this.broadcastUpdate();
      console.log("[v1][Todos] Todo toggled:", todo);
    }
  }

  async deleteTodo(todoId) {
    this.state.todos = this.state.todos.filter(t => t.id !== todoId);
    this.broadcastUpdate();
    console.log("[v1][Todos] Todo deleted:", todoId);
  }
}
