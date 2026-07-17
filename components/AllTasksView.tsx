'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Task, useTaskStore } from '@/store/taskStore';
import { getPlainDesc } from '@/utils/textParser';
import { Search, ChevronLeft, ChevronRight, Filter, Eye } from 'lucide-react';

interface AllTasksViewProps {
  onRowClick: (task: Task) => void;
  isReadOnly?: boolean;
  memberTasks?: Task[];
}

const statusLabels: Record<string, string> = {
  inbox: '수신함',
  todo: '실행 대기',
  inprogress: '진행 중',
  waiting: '회신 대기',
  done: '완료',
  completed: '완료',
  in_progress: '진행 중',
  pending_approval: '결재 대기',
};

const statusColors: Record<string, string> = {
  inbox: 'bg-slate-100 text-slate-700 border-slate-200',
  todo: 'bg-blue-100 text-blue-700 border-blue-200',
  inprogress: 'bg-purple-100 text-purple-700 border-purple-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const folderLabels: Record<string, string> = {
  none: '미분류',
  '0_프로젝트': '프로젝트',
  '1_영역': '영역',
  '2_자료': '자료',
  '3_보관소': '보관소',
  '0_Projects': '프로젝트',
  '1_Areas': '영역',
  '2_Resources': '자료',
  '3_Archives': '보관',
  urgent_important: '긴급·중요',
  not_urgent_important: '중요·여유',
  urgent_not_important: '긴급·위임',
  not_urgent_not_important: '여유·위임',
};

export default function AllTasksView({ onRowClick, isReadOnly = false, memberTasks }: AllTasksViewProps) {
  const { searchQuery, activeDept, setSearchQuery } = useTaskStore();
  const allTasks = memberTasks || useTaskStore((state) => state.tasks);

  // 로컬 필터 상태
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterFolder, setFilterFolder] = useState('all');
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 담당자 목록 동적 생성
  const uniqueAssignees = useMemo(() => {
    return Array.from(new Set(allTasks.map((t) => t.assignee).filter(Boolean))).sort() as string[];
  }, [allTasks]);

  // 검색어 입력 시 디바운스 적용
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
      setCurrentPage(1); // 검색 시 페이지 리셋
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // 부서 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [activeDept, filterStatus, filterAssignee, filterFolder]);

  // 필터 및 정렬 처리된 데이터 계산
  const filteredAndSortedTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        // 1. 상태 필터
        if (filterStatus !== 'all') {
          if (filterStatus === 'completed' || filterStatus === 'done') {
            if (task.status !== 'done' && task.status !== 'completed') return false;
          } else if (filterStatus === 'inprogress' || filterStatus === 'in_progress') {
            if (task.status !== 'inprogress' && task.status !== 'in_progress') return false;
          } else if (task.status !== filterStatus) {
            return false;
          }
        }

        // 2. 담당자 필터
        if (filterAssignee !== 'all' && task.assignee !== filterAssignee) {
          return false;
        }

        // 3. 폴더 필터
        if (filterFolder !== 'all') {
          if (filterFolder === 'none') {
            if (task.folder && task.folder !== 'none') return false;
          } else if (task.folder !== filterFolder) {
            return false;
          }
        }

        // 4. 부서 필터 (사이드바 연동)
        if (activeDept !== 'all' && task.department !== activeDept) {
          return false;
        }

        // 5. 검색어 필터
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const plainDesc = getPlainDesc(task.description).toLowerCase();
          return (
            task.title?.toLowerCase().includes(q) ||
            task.assignee?.toLowerCase().includes(q) ||
            plainDesc.includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // 완료 시간 최신순 정렬
        if (a.completedAt && b.completedAt) return b.completedAt - a.completedAt;
        if (a.completedAt) return 1;
        if (b.completedAt) return -1;
        
        // 미완료 업무는 납기일 기준 오름차순
        const timeA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
        const timeB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
        return timeA - timeB;
      });
  }, [allTasks, filterStatus, filterAssignee, filterFolder, activeDept, searchQuery]);

  // 페이지네이션 처리
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTasks.length / itemsPerPage));
  
  // 페이지 인덱스 보정
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedTasks.slice(start, start + itemsPerPage);
  }, [filteredAndSortedTasks, currentPage]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* 테이블 필터 헤더 */}
      <div className="p-6 bg-slate-50/50 border-b border-slate-200/60 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* 검색 인풋 */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="업무 제목, 담당자, 설명 검색..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          />
        </div>

        {/* 필터 세트 */}
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>필터</span>
          </div>

          {/* 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">모든 상태</option>
            <option value="inbox">수신함</option>
            <option value="todo">실행 대기</option>
            <option value="inprogress">진행 중</option>
            <option value="waiting">회신 대기</option>
            <option value="completed">완료</option>
          </select>

          {/* 담당자 필터 */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">모든 담당자</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>

          {/* 분류/폴더 필터 */}
          <select
            value={filterFolder}
            onChange={(e) => setFilterFolder(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">모든 분류</option>
            <option value="none">미분류</option>
            <option value="urgent_important">긴급·중요</option>
            <option value="not_urgent_important">중요·여유</option>
            <option value="urgent_not_important">긴급·위임</option>
            <option value="not_urgent_not_important">여유·위임</option>
            <option value="0_프로젝트">프로젝트</option>
            <option value="1_영역">영역</option>
            <option value="2_자료">자료</option>
            <option value="3_보관소">보관소</option>
          </select>
        </div>

      </div>

      {/* 테이블 영역 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/30 text-slate-400 font-bold text-xs uppercase tracking-wider">
              <th className="px-6 py-4">상태</th>
              <th className="px-6 py-4">분류</th>
              <th className="px-6 py-4">업무 제목</th>
              <th className="px-6 py-4">담당 부서</th>
              <th className="px-6 py-4">담당자</th>
              <th className="px-6 py-4">납기일</th>
              <th className="px-6 py-4">완료일</th>
              <th className="px-6 py-4">설명 요약</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedTasks.map((task) => {
              const plainDesc = getPlainDesc(task.description);
              const completedStr = task.completedAt
                ? new Date(task.completedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-';

              return (
                <tr
                  key={task.id}
                  onClick={() => onRowClick(task)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        statusColors[task.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {statusLabels[task.status] || task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                    {folderLabels[task.folder] || task.folder || '미분류'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[200px]">{task.title}</span>
                      {isReadOnly && <Eye className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">{task.department || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                    {task.assignee || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">{task.deliveryDate || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">{completedStr}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs truncate max-w-xs" title={plainDesc}>
                    {plainDesc || '-'}
                  </td>
                </tr>
              );
            })}

            {filteredAndSortedTasks.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="font-semibold text-slate-600 text-sm">해당 필터에 일치하는 업무가 없습니다</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 푸터 */}
      {filteredAndSortedTasks.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200/60 bg-slate-50/30 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>
            총 {filteredAndSortedTasks.length}개 중 {(currentPage - 1) * itemsPerPage + 1} -{' '}
            {Math.min(currentPage * itemsPerPage, filteredAndSortedTasks.length)} 표시
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-center transition-all ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
