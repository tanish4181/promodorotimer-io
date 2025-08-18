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
    await this.broadcastUpdate();
  }

  async toggleTodo(todoId) {
    const todo = this.state.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? new Date().toISOString() : null;
      await this.broadcastUpdate();
    }
  }

  async deleteTodo(todoId) {
    this.state.todos = this.state.todos.filter(t => t.id !== todoId);
    await this.broadcastUpdate();
  }
}
