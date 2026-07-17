'use client';

import React, { useState, useEffect } from 'react';
import { useTaskStore, RecurringTask } from '@/store/taskStore';
import { X, Calendar, Clock, Plus, Trash2, Play, CheckCircle, RefreshCw } from 'lucide-react';

interface RecurringTasksModalProps {
  onClose: () => void;
}

export default function RecurringTasksModal({ onClose }: RecurringTasksModalProps) {
  const { recurringTasks, fetchRecurringTasks, addRecurringTask, deleteRecurringTask } = useTaskStore();
  
  // 새 반복 업무 폼 상태
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('daily'); // daily, weekly, monthly
  const [dayOfWeek, setDayOfWeek] = useState(1); // 0(일)~6(토), 기본 월요일(1)
  const [dayOfMonth, setDayOfMonth] = useState(1); // 1~31
  const [assignee, setAssignee] = useState('');
  const [department, setDepartment] = useState('all');

  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  // 템플릿 목록 로드
  useEffect(() => {
    fetchRecurringTasks();
  }, [fetchRecurringTasks]);

  // 반복 업무 생성 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addRecurringTask({
      title: title.trim(),
      period,
      dayOfWeek: period === 'weekly' ? Number(dayOfWeek) : null,
      dayOfMonth: period === 'monthly' ? Number(dayOfMonth) : null,
      assignee: assignee.trim() || null,
      department: department.trim() || 'all',
      isActive: true,
    });

    setTitle('');
    setAssignee('');
  };

  // 즉시 수동 생성 트리거 테스트
  const handleTriggerGenerate = async () => {
    setGenerating(true);
    setGenMessage('');
    try {
      const res = await fetch('/api/tasks/generate-recurring', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGenMessage(data.message || '업무가 정상적으로 생성되었습니다.');
        // 새 태스크 목록 리로드
        useTaskStore.getState().fetchTasks();
      } else {
        setGenMessage('실행에 실패했습니다.');
      }
    } catch (e) {
      setGenMessage('네트워크 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const dayOfWeekNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-slate-100 animate-scale-up">
        
        {/* 헤더 */}
        <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-800 text-lg">반복 업무 템플릿 관리</h3>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {recurringTasks.length}개 활성화
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메인 영역 */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row p-8 gap-8">
          
          {/* 좌측: 새 반복 업무 생성 폼 */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col">
            <h4 className="font-bold text-slate-700 text-sm mb-4">반복 업무 추가</h4>
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">업무명</label>
                <input
                  type="text"
                  placeholder="예: 주간 기획 회의록 작성"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">반복 주기</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="daily">매일 (Daily)</option>
                  <option value="weekly">매주 (Weekly)</option>
                  <option value="monthly">매월 (Monthly)</option>
                </select>
              </div>

              {period === 'weekly' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">반복 요일</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {dayOfWeekNames.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {period === 'monthly' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">반복 일자 (일)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">부서</label>
                  <input
                    type="text"
                    placeholder="all"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">담당자</label>
                  <input
                    type="text"
                    placeholder="미지정"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                템플릿 추가
              </button>
            </form>
          </div>

          {/* 우측: 반복 업무 템플릿 목록 */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h4 className="font-bold text-slate-700 text-sm">등록된 반복 업무 목록</h4>
              
              {/* 수동 테스트 트리거 */}
              <div className="flex items-center gap-2">
                {genMessage && (
                  <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-medium">
                    {genMessage}
                  </span>
                )}
                <button
                  onClick={handleTriggerGenerate}
                  disabled={generating}
                  className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="오늘 생성 대기 중인 모든 반복 업무를 지금 발급합니다."
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  스케줄러 즉시 실행
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {recurringTasks.map((rt) => {
                let cycleDetail = '설정 없음';
                if (rt.period === 'daily') cycleDetail = '매일 아침 생성';
                if (rt.period === 'weekly') cycleDetail = `매주 ${dayOfWeekNames[rt.dayOfWeek ?? 1]} 생성`;
                if (rt.period === 'monthly') cycleDetail = `매월 ${rt.dayOfMonth ?? 1}일 생성`;

                return (
                  <div
                    key={rt.id}
                    className="p-4 border border-slate-200/80 rounded-2xl bg-white hover:border-slate-300 transition-colors flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">{rt.title}</h5>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500 font-medium items-center">
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">
                          {cycleDetail}
                        </span>
                        <span>📂 부서: {rt.department}</span>
                        {rt.assignee && <span>👤 담당: {rt.assignee}</span>}
                        {rt.lastGenerated && (
                          <span className="text-slate-400">
                            마지막 생성: {new Date(rt.lastGenerated).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRecurringTask(rt.id)}
                      className="p-2 bg-slate-50 border border-slate-100 hover:bg-rose-50 hover:border-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {recurringTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl p-10">
                  <span className="text-4xl mb-2">🗓️</span>
                  <p className="text-sm font-semibold">등록된 반복 업무가 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">좌측 폼을 이용해 주기적으로 생성할 업무 템플릿을 등록해보세요.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
