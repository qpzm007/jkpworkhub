import { create } from 'zustand';

export interface TaskFile {
  id: string;
  taskId: string;
  filePath: string;
  fileName: string;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string; // inbox, todo, inprogress, waiting, done
  priority: string; // low, medium, high, urgent
  department: string;
  assignee: string | null;
  folder: string; // none, urgent_important, etc. (Eisenhower matrix)
  deliveryDate: string | null;
  delivery_date: string | null; // API 호환용
  completedAt: number | null;
  completed_at: number | null; // API 호환용
  createdAt: string;
  updatedAt: string;
  files: TaskFile[];
}

export interface RecurringTask {
  id: string;
  userId: string;
  title: string;
  period: string; // daily, weekly, monthly
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  assignee: string | null;
  department: string;
  isActive: boolean;
  lastGenerated: string | null;
  createdAt: string;
}

interface TaskState {
  tasks: Task[];
  recurringTasks: RecurringTask[];
  loading: boolean;
  activeDept: string; // 'all' or specific department
  searchQuery: string;
  activeFolder: string; // 'all' or specific folder (urgent_important, etc.)
  
  // Actions
  fetchTasks: () => Promise<void>;
  fetchRecurringTasks: () => Promise<void>;
  addTask: (taskData: Partial<Task>) => Promise<Task | null>;
  updateTaskStatus: (id: string, newStatus: string) => Promise<void>;
  updateTaskDetails: (id: string, details: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  // Recurring Actions
  addRecurringTask: (template: Partial<RecurringTask>) => Promise<void>;
  deleteRecurringTask: (id: string) => Promise<void>;
  
  // Filters
  setSearchQuery: (query: string) => void;
  setActiveDept: (dept: string) => void;
  setActiveFolder: (folder: string) => void;
  setTasks: (tasks: Task[]) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  recurringTasks: [],
  loading: false,
  activeDept: 'all',
  searchQuery: '',
  activeFolder: 'all',

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        set({ tasks: data });
      }
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchRecurringTasks: async () => {
    try {
      const res = await fetch('/api/tasks/recurring');
      if (res.ok) {
        const data = await res.json();
        set({ recurringTasks: data });
      }
    } catch (e) {
      console.error('Failed to fetch recurring tasks', e);
    }
  },

  addTask: async (taskData) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (res.ok) {
        const newTask = await res.json();
        // 리로드 대신 즉시 로컬 상태 추가
        set((state) => ({ tasks: [newTask, ...state.tasks] }));
        return newTask;
      }
    } catch (e) {
      console.error('Failed to add task', e);
    }
    return null;
  },

  // 1. 낙관적 업데이트(Optimistic Update) 적용
  updateTaskStatus: async (id, newStatus) => {
    const previousTasks = get().tasks;
    
    // 로컬 상태를 먼저 업데이트 (유저 반응성 극대화)
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: newStatus,
              completedAt: newStatus === 'done' || newStatus === 'completed' ? Date.now() : null,
              completed_at: newStatus === 'done' || newStatus === 'completed' ? Date.now() : null,
            }
          : t
      ),
    }));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update task status in backend');
      }
    } catch (e) {
      console.error('Status update failed, rolling back...', e);
      // 실패 시 원래 상태로 롤백
      set({ tasks: previousTasks });
    }
  },

  updateTaskDetails: async (id, details) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (res.ok) {
        const updatedTask = await res.json();
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updatedTask } : t)),
        }));
      }
    } catch (e) {
      console.error('Failed to update task details', e);
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks;
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed on backend');
    } catch (e) {
      console.error('Failed to delete task', e);
      set({ tasks: previousTasks });
    }
  },

  addRecurringTask: async (template) => {
    try {
      const res = await fetch('/api/tasks/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (res.ok) {
        get().fetchRecurringTasks();
      }
    } catch (e) {
      console.error('Failed to add recurring task', e);
    }
  },

  deleteRecurringTask: async (id) => {
    try {
      const res = await fetch('/api/tasks/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        set((state) => ({
          recurringTasks: state.recurringTasks.filter((rt) => rt.id !== id),
        }));
      }
    } catch (e) {
      console.error('Failed to delete recurring task', e);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveDept: (dept) => set({ activeDept: dept }),
  setActiveFolder: (folder) => set({ activeFolder: folder }),
  setTasks: (tasks) => set({ tasks }),
}));
