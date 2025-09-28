'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  Plus, 
  FileText, 
  Search, 
  Tag, 
  Calendar,
  MoreHorizontal,
  Edit3,
  Trash2
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Meeting Notes - Q1 Planning',
    content: 'Discussed quarterly goals and resource allocation. Key points: - Increase user engagement by 25% - Launch new feature by March - Optimize performance metrics',
    tags: ['work', 'meeting', 'planning'],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z'
  },
  {
    id: '2',
    title: 'Ideas for Product Improvement',
    content: 'Random thoughts on how to improve the user experience: - Add dark mode toggle - Implement keyboard shortcuts - Better mobile responsiveness',
    tags: ['ideas', 'product', 'ux'],
    createdAt: '2024-01-09T15:30:00Z',
    updatedAt: '2024-01-09T15:30:00Z'
  },
  {
    id: '3',
    title: 'Learning Resources',
    content: 'Resources to check out: - React 19 new features - Tailwind CSS v4 updates - Framer Motion best practices',
    tags: ['learning', 'resources', 'development'],
    createdAt: '2024-01-08T09:15:00Z',
    updatedAt: '2024-01-08T09:15:00Z'
  }
];

export const NotesModule = () => {
  const { theme, updateUserBehavior } = useAdaptive();
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });

  const handleTyping = () => {
    updateUserBehavior({ typingCount: 1 });
  };

  const handleAddNote = () => {
    if (newNote.title.trim() && newNote.content.trim()) {
      const note: Note = {
        id: Date.now().toString(),
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => [note, ...prev]);
      setNewNote({ title: '', content: '', tags: '' });
      setShowNewNote(false);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full flex">
      {/* Notes List */}
      <div className="w-1/3 pr-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Notes
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {notes.length} notes
              </p>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNewNote(true)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Plus size={20} />
              <span>Add Note</span>
            </motion.button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search 
              size={20} 
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                  : theme === 'high-contrast'
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              }`}
            />
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion="Would you like to summarize your last note?"
          onAccept={() => {
            if (notes.length > 0) {
              setSelectedNote(notes[0]);
            }
          }}
        />

        {/* Notes List */}
        <div className="space-y-3 overflow-y-auto max-h-96">
          {filteredNotes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedNote(note)}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedNote?.id === note.id
                  ? theme === 'dark'
                    ? 'bg-blue-900/20 border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-blue-900/30 border-blue-400'
                    : 'bg-blue-50 border-blue-500'
                  : theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                  : theme === 'high-contrast'
                  ? 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <h3 className={`font-medium mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {note.title}
              </h3>
              <p className={`text-sm mb-3 line-clamp-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {note.content}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {note.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-1 text-xs rounded-full ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                  {note.tags.length > 2 && (
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      +{note.tags.length - 2}
                    </span>
                  )}
                </div>
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {formatDate(note.createdAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Note Detail */}
      <div className="flex-1 pl-6 border-l border-gray-200 dark:border-gray-700">
        {selectedNote ? (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-full flex flex-col"
          >
            {/* Note Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {selectedNote.title}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <span className={`flex items-center space-x-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <Calendar size={14} />
                  <span>Created {formatDate(selectedNote.createdAt)}</span>
                </span>
                <span className={`flex items-center space-x-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <Tag size={14} />
                  <span>{selectedNote.tags.length} tags</span>
                </span>
              </div>
            </div>

            {/* Note Content */}
            <div className="flex-1">
              <div className={`p-6 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : theme === 'high-contrast'
                  ? 'bg-gray-900 border-gray-600'
                  : 'bg-white border-gray-200'
              }`}>
                <p className={`whitespace-pre-wrap ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {selectedNote.content}
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <FileText 
                size={48} 
                className={`mx-auto mb-4 ${
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                }`} 
              />
              <p className={`text-lg ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Select a note to view
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Note Modal */}
      {showNewNote && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowNewNote(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl p-6 rounded-lg ${
              theme === 'dark'
                ? 'bg-gray-800'
                : theme === 'high-contrast'
                ? 'bg-gray-900'
                : 'bg-white'
            }`}
          >
            <h3 className={`text-xl font-bold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Create New Note
            </h3>
            
            <div className="space-y-4">
              <input
                type="text"
                value={newNote.title}
                onChange={(e) => {
                  setNewNote(prev => ({ ...prev, title: e.target.value }));
                  handleTyping();
                }}
                placeholder="Note title..."
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                }`}
              />
              
              <textarea
                value={newNote.content}
                onChange={(e) => {
                  setNewNote(prev => ({ ...prev, content: e.target.value }));
                  handleTyping();
                }}
                placeholder="Note content..."
                rows={6}
                className={`w-full px-3 py-2 rounded-lg border transition-colors resize-none ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                }`}
              />
              
              <input
                type="text"
                value={newNote.tags}
                onChange={(e) => {
                  setNewNote(prev => ({ ...prev, tags: e.target.value }));
                  handleTyping();
                }}
                placeholder="Tags (comma separated)..."
                className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                }`}
              />
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNewNote(false)}
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
              <button
                onClick={handleAddNote}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : theme === 'high-contrast'
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Create Note
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

