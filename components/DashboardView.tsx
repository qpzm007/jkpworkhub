'use client';

import React, { useMemo } from 'react';
import { useTaskStore, Task } from '@/store/taskStore';
import { Inbox, Play, CheckCircle2, Clock, AlertTriangle, Calendar, User, ArrowRight } from 'lucide-react';

interface DashboardViewProps {
  onTaskClick: (task: Task) => void;
  isReadOnly?: boolean;
  memberTasks?: Task[];
  displayName?: string;
}

export default function DashboardView({ onTaskClick, isReadOnly = false, memberTasks, displayName }: DashboardViewProps) {
  const allTasks = memberTasks || useTaskStore((state) => state.tasks);

  // 진행 상태 통계 계산
  const stats = useMemo(() => {
    const total = allTasks.length;
    const todo = allTasks.filter(t => t.status === 'todo' || t.status === 'pending_approval').length;
    const inprogress = allTasks.filter(t => t.status === 'inprogress' || t.status === 'in_progress').length;
    const completed = allTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const waiting = allTasks.filter(t => t.status === 'waiting').length;

    return { total, todo, inprogress, completed, waiting };
  }, [allTasks]);

  // 마감일 계산 유틸리티
  const getDaysUntil = (dueDate: string | null) => {
    if (!dueDate) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 마감이 임박한 긴급 업무 (3일 이내, 미완료)
  const urgentTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        if (task.status === 'done' || task.status === 'completed') return false;
        const days = getDaysUntil(task.deliveryDate || task.delivery_date);
        return days <= 3;
      })
      .sort((a, b) => {
        const daysA = getDaysUntil(a.deliveryDate || a.delivery_date);
        const daysB = getDaysUntil(b.deliveryDate || b.delivery_date);
        return daysA - daysB;
      });
  }, [allTasks]);

  // 최근 업무 5개
  const recentTasks = useMemo(() => {
    return allTasks.slice(0, 5);
  }, [allTasks]);

  const statCards = [
    { label: '전체 업무', count: stats.total, color: 'bg-blue-500 text-white', icon: Inbox },
    { label: '진행 중', count: stats.inprogress, color: 'bg-purple-500 text-white', icon: Play },
    { label: '완료됨', count: stats.completed, color: 'bg-emerald-500 text-white', icon: CheckCircle2 },
    { label: '회신 대기', count: stats.waiting, color: 'bg-amber-500 text-white', icon: Clock },
  ];

  return (
    <div className="space-y-8">
      {/* 웰컴 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {isReadOnly ? `👥 ${displayName}의 업무 현황` : '🏠 내 업무 대시보드'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">사내 포털 업무 진행 상황을 한눈에 모니터링합니다.</p>
        </div>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-400">{card.label}</p>
                <p className="text-4xl font-extrabold text-slate-800">{card.count}</p>
              </div>
              <div className={`p-4 rounded-2xl ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 대시보드 메인 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 마감 임박 긴급 업무 */}
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 shrink-0 pb-3 border-b border-slate-100">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h2 className="font-bold text-slate-800">마감 임박 업무 (D-3 이내)</h2>
            <span className="ml-auto bg-rose-50 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {urgentTasks.length}건
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
            {urgentTasks.map((task) => {
              const days = getDaysUntil(task.deliveryDate || task.delivery_date);
              const dDayText = days < 0 ? `마감 지남 (${Math.abs(days)}일)` : days === 0 ? 'D-Day' : `D-${days}`;
              const badgeColor = days < 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : days === 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-amber-50 text-amber-600 border-amber-100';

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="p-4 border border-slate-200/70 hover:border-blue-500/50 rounded-2xl bg-slate-50/30 hover:bg-slate-50/80 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-4">
                    <h4 className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span>📂 {task.department}</span>
                      {task.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-xl border whitespace-nowrap ${badgeColor}`}>
                    {dDayText}
                  </span>
                </div>
              );
            })}

            {urgentTasks.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-3xl mb-2">🎉</span>
                <p className="text-xs">현재 3일 이내에 마감되는 업무가 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 최근 등록 업무 */}
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 shrink-0 pb-3 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-slate-800">최근 등록 업무</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
            {recentTasks.map((task) => {
              const statusLabels: Record<string, string> = {
                inbox: '수신', todo: '대기', inprogress: '진행', waiting: '회신', done: '완료'
              };
              const statusColors: Record<string, string> = {
                inbox: 'bg-slate-100 text-slate-600',
                todo: 'bg-blue-50 text-blue-600',
                inprogress: 'bg-purple-50 text-purple-600',
                waiting: 'bg-amber-50 text-amber-600',
                done: 'bg-emerald-50 text-emerald-600'
              };

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="p-4 border border-slate-200/70 hover:border-blue-500/50 rounded-2xl bg-slate-50/30 hover:bg-slate-50/80 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-4">
                    <h4 className="font-semibold text-slate-800 text-sm truncate group-hover:text-blue-600 transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5">
                      📅 {task.deliveryDate || task.delivery_date || '미정'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusColors[task.status] || 'bg-slate-100'}`}>
                    {statusLabels[task.status] || task.status}
                  </span>
                </div>
              );
            })}

            {recentTasks.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-3xl mb-2">📭</span>
                <p className="text-xs">등록된 업무가 없습니다.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
