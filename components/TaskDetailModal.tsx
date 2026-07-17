'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Task, useTaskStore, TaskFile } from '@/store/taskStore';
import { X, Calendar, User, Folder, AlertTriangle, Paperclip, Trash2, Plus, ExternalLink, FileText, Sparkles, CheckCircle2 } from 'lucide-react';

const RichEditor = dynamic(() => import('./RichEditor'), { ssr: false });

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
  isReadOnly?: boolean;
}

export default function TaskDetailModal({ task, onClose, isReadOnly = false }: TaskDetailModalProps) {
  const { updateTaskDetails, deleteTask } = useTaskStore();
  
  // 폼 상태 관리
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('inbox');
  const [priority, setPriority] = useState('medium');
  const [department, setDepartment] = useState('all');
  const [assignee, setAssignee] = useState('');
  const [folder, setFolder] = useState('none');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [description, setDescription] = useState('');
  
  // 파일 관련 상태
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [localDesktopFiles, setLocalDesktopFiles] = useState<any[]>([]);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState('http://localhost:45679');

  // 태스크 로드 시 상태 채우기
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setStatus(task.status || 'inbox');
      setPriority(task.priority || 'medium');
      setDepartment(task.department || 'all');
      setAssignee(task.assignee || '');
      setFolder(task.folder || 'none');
      setDeliveryDate(task.deliveryDate || task.delivery_date || '');
      setDescription(task.description || '');
      setFiles(task.files || []);
    }
  }, [task]);

  // 브릿지 서버 연결 상태 및 파일 목록 조회
  useEffect(() => {
    if (!task) return;
    
    const checkBridgeAndFetchFiles = async () => {
      try {
        // user_settings에서 bridgeUrl 조회 (없을 시 기본 포트)
        const settingsRes = await fetch('/api/settings');
        let currentBridgeUrl = 'http://localhost:45679';
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.bridge_url) {
            currentBridgeUrl = settings.bridge_url;
            setBridgeUrl(settings.bridge_url);
          }
        }

        const statusRes = await fetch(`${currentBridgeUrl}/api/bridge/status`, { signal: AbortSignal.timeout(2000) });
        if (statusRes.ok) {
          setBridgeConnected(true);
          // 브릿지 서버에서 로컬 파일 목록 받아옴
          const filesRes = await fetch(`${currentBridgeUrl}/api/files`);
          if (filesRes.ok) {
            const fileData = await filesRes.json();
            setLocalDesktopFiles(fileData);
          }
        } else {
          setBridgeConnected(false);
        }
      } catch (e) {
        setBridgeConnected(false);
      }
    };

    checkBridgeAndFetchFiles();
  }, [task]);

  if (!task) return null;

  // 필드 변경 저장 핸들러
  const handleFieldChange = async (fieldName: string, value: any) => {
    if (isReadOnly) return;
    
    const updatedData = {
      [fieldName]: value
    };

    // 로컬 폼 상태 변경
    if (fieldName === 'title') setTitle(value);
    if (fieldName === 'status') setStatus(value);
    if (fieldName === 'priority') setPriority(value);
    if (fieldName === 'department') setDepartment(value);
    if (fieldName === 'assignee') setAssignee(value);
    if (fieldName === 'folder') setFolder(value);
    if (fieldName === 'deliveryDate') setDeliveryDate(value);

    // 백엔드 저장
    await updateTaskDetails(task.id, updatedData);
  };

  // 에디터 내용 저장 핸들러
  const handleDescriptionChange = async (descStr: string) => {
    if (isReadOnly) return;
    setDescription(descStr);
    await updateTaskDetails(task.id, { description: descStr });
  };

  // 파일 링크 추가 핸들러
  const handleAddFileLink = async () => {
    if (isReadOnly || !newFilePath.trim() || !newFileName.trim()) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: newFilePath.trim(), fileName: newFileName.trim() }),
      });

      if (res.ok) {
        const result = await res.json();
        setFiles([result.data, ...files]);
        setNewFilePath('');
        setNewFileName('');
      }
    } catch (e) {
      console.error('Failed to link file', e);
    }
  };

  // 브릿지 연동 로컬 파일 선택 시 자동 채우기
  const handleSelectLocalFile = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPath = e.target.value;
    if (!selectedPath) return;
    const file = localDesktopFiles.find(f => f.path === selectedPath);
    if (file) {
      setNewFilePath(file.path);
      setNewFileName(file.name);
    }
  };

  // 로컬 파일 더블클릭/오픈 요청 (브릿지 서버 이용)
  const handleOpenFile = async (filePath: string) => {
    if (!bridgeConnected) {
      alert('브릿지 서버가 실행 중이 아닙니다.');
      return;
    }
    try {
      await fetch(`${bridgeUrl}/api/files/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
    } catch (e) {
      console.error('Failed to open file', e);
    }
  };

  // 파일 삭제 핸들러
  const handleDeleteFile = async (fileId: string) => {
    if (isReadOnly) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      if (res.ok) {
        setFiles(files.filter(f => f.id !== fileId));
      }
    } catch (e) {
      console.error('Failed to delete file link', e);
    }
  };

  // 태스크 삭제 핸들러
  const handleDeleteTask = async () => {
    if (isReadOnly) return;
    if (confirm('이 업무를 완전히 삭제하시겠습니까?')) {
      await deleteTask(task.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-up border border-slate-100">
        
        {/* 상단 헤더 */}
        <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
            <span className="text-slate-500 font-medium text-sm">업무 상세 보기</span>
            {isReadOnly && (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1 border border-amber-200">
                👁️ 읽기 전용
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 영역 (좌측 폼, 우측 파일 & 에디터) */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8">
          
          {/* 좌측 메타데이터 패널 */}
          <div className="w-full md:w-80 shrink-0 space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">업무 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => handleFieldChange('title', e.target.value)}
                disabled={isReadOnly}
                className="w-full text-lg font-bold border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-1 disabled:bg-transparent disabled:text-slate-700"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">상태</label>
                <select
                  value={status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
                >
                  <option value="inbox">수신함</option>
                  <option value="todo">실행 대기</option>
                  <option value="inprogress">진행 중</option>
                  <option value="waiting">회신 대기</option>
                  <option value="done">완료</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">우선순위</label>
                <select
                  value={priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
                >
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                  <option value="urgent">긴급</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">아이젠하워 긴급도</label>
              <select
                value={folder}
                onChange={(e) => handleFieldChange('folder', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
              >
                <option value="none">미지정</option>
                <option value="urgent_important">🔴 긴급 및 중요 (Do it now)</option>
                <option value="not_urgent_important">🔵 중요하지만 여유 (Schedule it)</option>
                <option value="urgent_not_important">🩵 긴급하지만 위임 (Delegate it)</option>
                <option value="not_urgent_not_important">⬜ 여유롭고 위임 (Eliminate it)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">담당 부서</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                onBlur={(e) => handleFieldChange('department', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
                placeholder="전체 또는 부서명"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">담당자</label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={(e) => handleFieldChange('assignee', e.target.value)}
                disabled={isReadOnly}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
                placeholder="담당자 이름"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">납기 마감일</label>
              <div className="relative">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => handleFieldChange('deliveryDate', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-70"
                />
              </div>
            </div>

            {!isReadOnly && (
              <div className="pt-4">
                <button
                  onClick={handleDeleteTask}
                  className="w-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  업무 삭제
                </button>
              </div>
            )}
          </div>

          {/* 우측 에디터 & 파일 패널 */}
          <div className="flex-1 flex flex-col space-y-6 min-w-0">
            {/* 업무 설명 에디터 */}
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                업무 상세 내용 (Editor.js 블록 에디터)
              </label>
              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/20 p-2 min-h-[300px]">
                <RichEditor data={description} onChange={handleDescriptionChange} readOnly={isReadOnly} />
              </div>
            </div>

            {/* 로컬 파일 연동 섹션 */}
            {!isReadOnly && (
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4.5 h-4.5 text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-700">로컬 파일 탐색기 링크 연동</h4>
                  {bridgeConnected ? (
                    <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold border border-green-200">
                      브릿지 서버 연결됨
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full font-bold border border-rose-200">
                      브릿지 오프라인
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bridgeConnected && localDesktopFiles.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-slate-400 font-semibold mb-1">바탕화면 폴더에서 파일 선택</label>
                      <select
                        onChange={handleSelectLocalFile}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">파일을 선택하면 아래 경로가 자동으로 채워집니다...</option>
                        {localDesktopFiles.map((file) => (
                          <option key={file.path} value={file.path}>
                            {file.path} ({file.size})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <input
                      type="text"
                      placeholder="파일명 (예: 기획서_v1.docx)"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="상대/절대 경로 (예: 0_프로젝트/기획안.docx)"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none flex-1"
                    />
                    <button
                      onClick={handleAddFileLink}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      추가
                    </button>
                  </div>
                </div>

                {/* 첨부된 파일 목록 */}
                {files.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] text-slate-400 font-semibold">연결된 로컬 파일 목록 ({files.length}개)</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-white border border-slate-200/60 p-2 rounded-lg text-xs hover:border-slate-300 transition-colors">
                          <button
                            onClick={() => handleOpenFile(file.filePath)}
                            className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-600 text-left truncate flex-1 focus:outline-none"
                            title="클릭하여 파일 열기"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{file.fileName}</span>
                            <span className="text-[10px] text-slate-400 font-normal truncate">({file.filePath})</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 읽기전용 시의 파일 목록 */}
            {isReadOnly && files.length > 0 && (
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4.5 h-4.5 text-slate-500" />
                  <h4 className="text-sm font-bold text-slate-700">연결된 로컬 파일 ({files.length}개)</h4>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center bg-white border border-slate-200/60 p-2.5 rounded-lg text-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                      <span className="font-medium text-slate-700 truncate mr-2">{file.fileName}</span>
                      <span className="text-[10px] text-slate-400 truncate flex-1">({file.filePath})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
