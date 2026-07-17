'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useTaskStore, Task } from '@/store/taskStore';
import { Inbox, Play, Clock, CheckSquare, AlertCircle, Calendar, User } from 'lucide-react';

export const URGENCY_MAP: Record<string, { label: string; bg: string; text: string; icon: string; border: string; darkText: boolean }> = {
  'urgent_important': { label: '긴급·중요', bg: 'bg-slate-900', text: 'text-white', icon: '🔴', border: 'border-slate-800', darkText: false },
  'not_urgent_important': { label: '중요·여유', bg: 'bg-blue-600', text: 'text-white', icon: '🔵', border: 'border-blue-700', darkText: false },
  'urgent_not_important': { label: '긴급·위임', bg: 'bg-sky-50', text: 'text-slate-800', icon: '🩵', border: 'border-sky-200', darkText: true },
  'not_urgent_not_important': { label: '여유·위임', bg: 'bg-white', text: 'text-slate-800', icon: '⬜', border: 'border-slate-200', darkText: true }
};

interface KanbanBoardProps {
  onCardClick: (task: Task) => void;
  isReadOnly?: boolean;
  memberTasks?: Task[];
}

const COLUMNS = [
  { id: 'inbox', title: '수신함', icon: Inbox, color: 'text-slate-600 bg-slate-100/70 border-slate-200' },
  { id: 'todo', title: '실행 대기', icon: AlertCircle, color: 'text-blue-600 bg-blue-50/70 border-blue-100' },
  { id: 'inprogress', title: '진행 중', icon: Play, color: 'text-purple-600 bg-purple-50/70 border-purple-100' },
  { id: 'waiting', title: '회신 대기', icon: Clock, color: 'text-amber-600 bg-amber-50/70 border-amber-100' },
  { id: 'done', title: '완료', icon: CheckSquare, color: 'text-emerald-600 bg-emerald-50/70 border-emerald-100' },
];

export default function KanbanBoard({ onCardClick, isReadOnly = false, memberTasks }: KanbanBoardProps) {
  const { searchQuery, activeDept, activeFolder, updateTaskStatus } = useTaskStore();
  const allTasks = memberTasks || useTaskStore((state) => state.tasks);

  // 드래그 종료 핸들러
  const handleDragEnd = async (result: DropResult) => {
    if (isReadOnly) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    // Zustand 스토어 업데이트 (내부적으로 Optimistic Update 및 API 호출 적용)
    await updateTaskStatus(draggableId, destination.droppableId);
  };

  // 필터링 적용
  const filteredTasks = allTasks.filter((task) => {
    // 1. 검색어 필터
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title?.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchAssignee = task.assignee?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchAssignee) return false;
    }

    // 2. 부서 필터
    if (activeDept !== 'all' && task.department !== activeDept) {
      return false;
    }

    // 3. 아이젠하워 폴더 필터
    if (activeFolder !== 'all') {
      if (activeFolder === 'none') {
        if (task.folder && task.folder !== 'none') return false;
      } else if (task.folder !== activeFolder) {
        return false;
      }
    }

    // 4. 완료 후 3일 경과 필터
    if (task.status === 'done' || task.status === 'completed') {
      const completedTime = task.completedAt || Date.now();
      const diffDays = (Date.now() - completedTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 3) return false;
    }

    return true;
  });

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 h-full items-start">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter(
            (t) => t.status === col.id || (col.id === 'todo' && t.status === 'pending_approval') || (col.id === 'inprogress' && t.status === 'in_progress') || (col.id === 'done' && t.status === 'completed')
          );
          const Icon = col.icon;

          return (
            <div key={col.id} className="flex flex-col h-[calc(100vh-14rem)] min-w-[200px] bg-slate-100/50 rounded-2xl border border-slate-200/60 p-4">
              {/* 열 헤더 */}
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`w-5 h-5`} />
                <h3 className="font-bold text-slate-800 text-sm">{col.title}</h3>
                <span className="ml-auto bg-slate-200 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* 드롭 영역 */}
              <Droppable droppableId={col.id} isDropDisabled={isReadOnly}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto space-y-3 pr-1 min-h-[150px] transition-colors rounded-xl ${
                      snapshot.isDraggingOver ? 'bg-slate-200/40' : ''
                    }`}
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {colTasks.map((task, index) => {
                      // 중요도에 따른 배경색 설정 (아이젠하워 매트릭스)
                      const urgInfo = URGENCY_MAP[task.folder] || URGENCY_MAP['not_urgent_not_important'];

                      return (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                          isDragDisabled={isReadOnly}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onCardClick(task)}
                              className={`p-4 rounded-xl border shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                                urgInfo.bg
                              } ${urgInfo.border} ${
                                snapshot.isDragging ? 'shadow-lg rotate-1 scale-[1.02] ring-2 ring-blue-500/50' : ''
                              }`}
                            >
                              {/* 긴급도 태그 */}
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-xs">{urgInfo.icon}</span>
                                <span className={`text-[10px] font-bold tracking-tight uppercase ${snapshot.isDragging ? 'text-blue-400' : (urgInfo.darkText ? 'text-slate-500' : 'text-white/90')}`}>
                                  {urgInfo.label}
                                </span>
                                {task.priority && task.priority !== 'medium' && (
                                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    task.priority === 'urgent' ? 'bg-red-500 text-white' :
                                    task.priority === 'high' ? 'bg-orange-500 text-white' :
                                    'bg-slate-200 text-slate-600'
                                  }`}>
                                    {task.priority}
                                  </span>
                                )}
                              </div>

                              {/* 제목 */}
                              <h4 className={`font-semibold text-sm line-clamp-2 ${urgInfo.text}`}>
                                {task.title}
                              </h4>

                              {/* 정보 */}
                              <div className="mt-3 pt-3 border-t border-slate-200/20 flex flex-wrap gap-2 items-center text-[11px]">
                                {task.assignee && (
                                  <div className={`flex items-center gap-1 ${urgInfo.darkText ? 'text-slate-500' : 'text-white/80'}`}>
                                    <User className="w-3 h-3" />
                                    <span className="truncate max-w-[80px]">{task.assignee}</span>
                                  </div>
                                )}
                                {task.deliveryDate && (
                                  <div className={`flex items-center gap-1 ml-auto ${urgInfo.darkText ? 'text-slate-500' : 'text-white/80'}`}>
                                    <Calendar className="w-3 h-3" />
                                    <span>{task.deliveryDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    
                    {colTasks.length === 0 && (
                      <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400/80">
                        <p className="text-xs">여기에 업무가 없습니다</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
