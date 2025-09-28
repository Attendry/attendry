'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  Plus, 
  CheckSquare, 
  Square, 
  Calendar, 
  Flag, 
  MoreHorizontal,
  Clock
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  category: string;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Review quarterly reports',
    completed: false,
    priority: 'high',
    dueDate: '2024-01-15',
    category: 'Work'
  },
  {
    id: '2',
    title: 'Update project documentation',
    completed: true,
    priority: 'medium',
    dueDate: '2024-01-12',
    category: 'Work'
  },
  {
    id: '3',
    title: 'Plan team meeting agenda',
    completed: false,
    priority: 'medium',
    category: 'Work'
  },
  {
    id: '4',
    title: 'Buy groceries',
    completed: false,
    priority: 'low',
    category: 'Personal'
  },
  {
    id: '5',
    title: 'Schedule dentist appointment',
    completed: false,
    priority: 'low',
    category: 'Health'
  }
];

export const TasksModule = () => {
  const { theme, updateUserBehavior } = useAdaptive();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);

  const handleTaskClick = (taskId: string) => {
    updateUserBehavior({ taskClicks: 1 });
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed }
        : task
    ));
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle,
        completed: false,
        priority: 'medium',
        category: 'General'
      };
      setTasks(prev => [newTask, ...prev]);
      setNewTaskTitle('');
      setShowNewTask(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Tasks
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNewTask(true)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : theme === 'high-contrast'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus size={20} />
            <span>New Task</span>
          </motion.button>
        </div>

        {/* Progress bar */}
        <div className={`w-full h-2 rounded-full ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completedTasks / totalTasks) * 100}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-blue-500 rounded-full"
          />
        </div>
      </div>

      {/* AI Suggestion */}
      <SuggestionBanner
        suggestion={completedTasks >= 3 
          ? "You've completed 3 tasks! Would you like to create a follow-up project?" 
          : "Focus on high-priority tasks first to maximize productivity."
        }
        onAccept={() => {
          if (completedTasks >= 3) {
            setShowNewTask(true);
          }
        }}
      />

      {/* New Task Form */}
      {showNewTask && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : theme === 'high-contrast'
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex space-x-3">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Enter task title..."
              className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : theme === 'high-contrast'
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              }`}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
              autoFocus
            />
            <button
              onClick={handleAddTask}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Add
            </button>
            <button
              onClick={() => setShowNewTask(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-600 hover:bg-gray-700 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-gray-700 hover:bg-gray-800 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border transition-all duration-200 ${
                task.completed
                  ? theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 opacity-60'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900/50 border-gray-600 opacity-60'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                  : theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                  : theme === 'high-contrast'
                  ? 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleTaskClick(task.id)}
                  className={`p-1 rounded transition-colors ${
                    task.completed
                      ? theme === 'dark'
                        ? 'text-green-500'
                        : 'text-green-600'
                      : theme === 'dark'
                      ? 'text-gray-400 hover:text-green-500'
                      : 'text-gray-400 hover:text-green-600'
                  }`}
                >
                  {task.completed ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${
                    task.completed
                      ? 'line-through opacity-60'
                      : theme === 'dark'
                      ? 'text-white'
                      : 'text-gray-900'
                  }`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`text-xs flex items-center space-x-1 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      <span>{getPriorityIcon(task.priority)}</span>
                      <span className="capitalize">{task.priority}</span>
                    </span>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {task.category}
                    </span>
                    {task.dueDate && (
                      <span className={`text-xs flex items-center space-x-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        <Calendar size={12} />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  className={`p-1 rounded transition-colors ${
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

