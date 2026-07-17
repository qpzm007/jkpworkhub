'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useTaskStore, Task } from '@/store/taskStore';
import KanbanBoard from '@/components/KanbanBoard';
import AllTasksView from '@/components/AllTasksView';
import DashboardView from '@/components/DashboardView';
import TaskDetailModal from '@/components/TaskDetailModal';
import RecurringTasksModal from '@/components/RecurringTasksModal';
import { 
  Home, ClipboardList, List, UserCheck, FolderKanban, LogOut, 
  Menu, Bell, ExternalLink, ShieldAlert, Plus, Clock, FileText
} from 'lucide-react';

const BRIDGE_URL = 'http://localhost:45679';

type MemberTab = {
  userId: string;
  email: string;
  displayName: string;
  status: 'approved' | 'pending';
};

export default function WorkHubApp() {
  const { data: session } = useSession();
  
  // Zustand 스토어 상태 및 액션 연동
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const activeDept = useTaskStore((state) => state.activeDept);
  const setActiveDept = useTaskStore((state) => state.setActiveDept);
  const activeFolder = useTaskStore((state) => state.activeFolder);
  const setActiveFolder = useTaskStore((state) => state.setActiveFolder);
  const searchQuery = useTaskStore((state) => state.searchQuery);
  const setSearchQuery = useTaskStore((state) => state.setSearchQuery);

  const [activeView, setActiveView] = useState('dashboard');
  const [activeMember, setActiveMember] = useState<string | null>(null); // null = 내 업무
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberTab[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  
  // 브릿지 관련 상태
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [desktopFiles, setDesktopFiles] = useState<any[]>([]);
  const [currentBridgeUrl, setCurrentBridgeUrl] = useState(BRIDGE_URL);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  
  // 태스크 모달 및 반복 업무 모달 오픈 상태
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // 브릿지 연결 및 브릿지 설정 로드
  useEffect(() => {
    const checkBridge = async () => {
      try {
        // user_settings에서 bridge_url 조회
        const settingsRes = await fetch('/api/settings');
        let bridgeApiUrl = BRIDGE_URL;
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.bridge_url) {
            bridgeApiUrl = settings.bridge_url;
            setCurrentBridgeUrl(settings.bridge_url);
          }
        }

        const res = await fetch(`${bridgeApiUrl}/api/bridge/status`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          setBridgeConnected(true);
          const filesRes = await fetch(`${bridgeApiUrl}/api/files`);
          if (filesRes.ok) setDesktopFiles(await filesRes.json());
        } else {
          setBridgeConnected(false);
        }
      } catch {
        setBridgeConnected(false);
      }
    };
    
    checkBridge();
    const interval = setInterval(checkBridge, 15000);
    return () => clearInterval(interval);
  }, []);

  // 내 업무 초기화 로드
  useEffect(() => {
    if (session?.user) {
      fetchTasks();
    }
  }, [session, fetchTasks]);

  // 실시간 SSE 이벤트 리스너 연결
  useEffect(() => {
    if (!session?.user) return;

    const eventSource = new EventSource('/api/tasks/sse');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'tasks_updated' && data.userId === session?.user?.id) {
          // 나의 업무가 수정되었을 때 실시간 리로드
          fetchTasks();
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [session, fetchTasks]);

  // 부서원 목록 로드
  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/members');
    if (res.ok) {
      const { outgoing, incoming } = await res.json();
      setMembers(outgoing.filter((m: any) => m.status === 'approved').map((m: any) => ({
        userId: m.target_user_id,
        email: m.target_email,
        displayName: m.display_name || m.target_email,
        status: m.status,
      })));
      setIncomingRequests(incoming);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadMembers();
    }
  }, [session, loadMembers]);

  // 부서원 업무 로드
  const loadMemberTasks = useCallback(async (userId: string) => {
    const res = await fetch(`/api/members/${userId}/tasks`);
    if (res.ok) setMemberTasks(await res.json());
  }, []);

  // 부서원 탭 클릭
  const handleTabClick = (memberId: string | null) => {
    setActiveMember(memberId);
    if (memberId) {
      loadMemberTasks(memberId);
    } else {
      setMemberTasks([]);
    }
  };

  // 부서원 추가
  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_email: newMemberEmail.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.status === 'not_registered' 
        ? '요청을 보냈습니다. 상대방이 WorkHub에 가입하면 알림이 표시됩니다.' 
        : '열람 요청을 보냈습니다. 상대방의 승인을 기다립니다.'
      );
      setNewMemberEmail('');
      setShowMemberModal(false);
      loadMembers();
    } else {
      alert(data.error);
    }
  };

  // 요청 수락/거부
  const respondToRequest = async (requesterId: string, action: 'approve' | 'reject') => {
    await fetch('/api/members/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: requesterId, action }),
    });
    loadMembers();
  };

  // 신규 업무 생성 핸들러
  const handleCreateTask = async () => {
    const newTask = await useTaskStore.getState().addTask({
      title: '새로운 업무',
      status: 'inbox',
      priority: 'medium',
      department: activeDept !== 'all' ? activeDept : 'all',
      folder: activeFolder !== 'all' ? activeFolder : 'none',
    });
    if (newTask) {
      setSelectedTask(newTask);
    }
  };

  // 파일 탐색기 열기
  const handleOpenFolder = async (folderPath: string) => {
    try {
      await fetch(`${currentBridgeUrl}/api/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch (e) {
      console.error('Failed to open local folder', e);
    }
  };

  const isReadOnly = !!activeMember;
  const currentMemberName = activeMember ? (members.find(m => m.userId === activeMember)?.displayName || '부서원') : '';

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden font-sans">
      
      {/* 사이드바 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0 shadow-xl z-20`}>
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950 text-white font-bold text-lg tracking-wide shrink-0">
          <span className="w-4.5 h-4.5 bg-blue-500 rounded mr-2.5 flex items-center justify-center font-extrabold text-xs text-white">W</span>
          JKP WorkHub
        </div>

        {/* 유저 정보 */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3 shrink-0 bg-slate-900/40">
          {session?.user?.image ? (
            <img src={session.user.image} alt="avatar" className="w-9 h-9 rounded-full ring-2 ring-blue-500/50" />
          ) : (
            <div className="w-9 h-9 bg-slate-700 text-white rounded-full flex items-center justify-center font-bold text-sm ring-2 ring-blue-500/30">
              {session?.user?.name?.[0] || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{session?.user?.name}</p>
            <p className="text-slate-500 text-[10px] truncate mt-0.5">{session?.user?.email}</p>
          </div>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5 scrollbar-thin">
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">업무 보드</p>
          {[
            { id: 'dashboard', label: '대시보드', icon: Home },
            { id: 'orders', label: '프로젝트 & 업무', icon: FolderKanban },
            { id: 'allTasks', label: '전체 업무 리스트', icon: List },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeView === item.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' 
                    : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 mr-3" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}

          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 pt-4">부서 필터</p>
          {['all', '기획팀', '개발팀', '디자인팀', '인사팀'].map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`w-full flex items-center px-3 py-1.5 rounded-lg text-left text-xs transition-colors ${
                activeDept === dept 
                  ? 'bg-slate-800 text-blue-400 font-bold' 
                  : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="mr-2">📁</span>
              {dept === 'all' ? '전체 부서' : dept}
            </button>
          ))}

          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 pt-4">공통 데이터베이스</p>
          {[
            { id: 'vendors', label: '명함첩', icon: UserCheck },
            { id: 'components', label: '공유 자료실', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-all ${
                  activeView === item.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold' 
                    : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 mr-3" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}

          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5 pt-4">로컬 파일</p>
          <button
            onClick={() => setActiveView('folders')}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-all ${
              !bridgeConnected ? 'opacity-40 cursor-not-allowed' : activeView === 'folders' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
            disabled={!bridgeConnected}
            title={!bridgeConnected ? '브릿지 서버를 실행해주세요' : ''}
          >
            <span className="mr-3">🗂️</span>
            <span className="text-xs flex-1">바탕화면 폴더</span>
            <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          </button>
        </nav>

        {/* 로그아웃 */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center px-8 gap-5 shrink-0 shadow-sm z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1.5 rounded-lg hover:bg-slate-100/80"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* 부서원 탭 바 */}
          <div className="flex items-center gap-2.5 flex-1 overflow-x-auto py-1 scrollbar-none">
            {/* 내 업무 탭 */}
            <button
              onClick={() => handleTabClick(null)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                !activeMember 
                  ? 'bg-blue-600 text-white shadow-blue-600/10' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/20'
              }`}
            >
              내 업무
            </button>

            {/* 부서원 탭들 */}
            {members.map((member) => (
              <button
                key={member.userId}
                onClick={() => handleTabClick(member.userId)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-sm group border ${
                  activeMember === member.userId 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/10' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border-slate-200/60'
                }`}
              >
                {member.displayName}
              </button>
            ))}

            {/* 부서원 추가 버튼 */}
            {members.length < 50 && (
              <button
                onClick={() => setShowMemberModal(true)}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:bg-slate-100 border border-dashed border-slate-300 transition-all whitespace-nowrap"
              >
                <span>+</span> 부서원 추가
              </button>
            )}
          </div>

          {/* 알림 및 기능 링크들 */}
          <div className="flex items-center gap-4">
            
            {/* 받은 요청 알림 */}
            {incomingRequests.length > 0 && (
              <div className="relative">
                <button className="relative p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all border border-slate-200/40">
                  <Bell className="w-4 h-4 animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-extrabold">{incomingRequests.length}</span>
                </button>
                {/* 알림 드롭다운 */}
                <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-scale-up">
                  <p className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">업무 열람 요청</p>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {incomingRequests.map((req) => (
                      <div key={req.requester_id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{req.requester_id}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">나의 업무 열람을 요청했습니다</p>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => respondToRequest(req.requester_id, 'approve')} 
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                          >
                            허용
                          </button>
                          <button 
                            onClick={() => respondToRequest(req.requester_id, 'reject')} 
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold rounded-lg transition-colors"
                          >
                            거부
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 읽기전용 뱃지 */}
            {isReadOnly && (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-full border border-amber-200/50 uppercase tracking-tight flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                읽기 전용
              </span>
            )}

            {/* 브릿지 상태 표시 */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold border ${
              bridgeConnected 
                ? 'bg-green-50 text-green-700 border-green-200/40' 
                : 'bg-red-50 text-red-600 border-red-200/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-green-500' : 'bg-red-400'}`} />
              {bridgeConnected ? '브릿지 연결됨' : '브릿지 오프라인'}
            </div>

          </div>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 overflow-auto p-8 bg-slate-50/30">
          
          {/* 뷰 선택에 따른 콘텐츠 분기 */}
          {activeView === 'dashboard' && (
            <DashboardView 
              onTaskClick={setSelectedTask} 
              isReadOnly={isReadOnly} 
              memberTasks={isReadOnly ? memberTasks : undefined}
              displayName={currentMemberName}
            />
          )}

          {activeView === 'orders' && (
            <div className="space-y-6 h-full flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    {isReadOnly ? `📋 ${currentMemberName}의 프로젝트 & 업무` : '📋 내 프로젝트 & 업무'}
                  </h1>
                  <p className="text-slate-500 text-xs mt-1">드래그 앤 드롭을 이용해 직관적으로 상태를 변경합니다.</p>
                </div>
                
                {/* 툴바 단추들 */}
                {!isReadOnly && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowRecurringModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 border border-indigo-200/60 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl text-xs transition-colors shadow-sm"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      반반 업무 설정
                    </button>
                    <button
                      onClick={handleCreateTask}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-md shadow-blue-600/10"
                    >
                      <Plus className="w-4 h-4" />
                      업무 추가
                    </button>
                  </div>
                )}
              </div>

              {/* 칸반보드 */}
              <div className="flex-1 min-h-0">
                <KanbanBoard 
                  onCardClick={setSelectedTask} 
                  isReadOnly={isReadOnly}
                  memberTasks={isReadOnly ? memberTasks : undefined}
                />
              </div>
            </div>
          )}

          {activeView === 'allTasks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    {isReadOnly ? `📄 ${currentMemberName}의 전체 업무 리스트` : '📄 전체 업무 리스트'}
                  </h1>
                  <p className="text-slate-500 text-xs mt-1">필터 및 검색 조건을 적용하여 업무를 관리합니다.</p>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={handleCreateTask}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-md shadow-blue-600/10"
                  >
                    <Plus className="w-4 h-4" />
                    업무 추가
                  </button>
                )}
              </div>

              {/* 전체 업무 리스트 */}
              <AllTasksView 
                onRowClick={setSelectedTask} 
                isReadOnly={isReadOnly}
                memberTasks={isReadOnly ? memberTasks : undefined}
              />
            </div>
          )}

          {/* 파일 탐색기 뷰 */}
          {activeView === 'folders' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">바탕화면 폴더 탐색기</h1>
                  <p className="text-slate-500 text-xs mt-1">로컬 PC 바탕화면의 JKP_WorkHub_Files 폴더의 콘텐츠입니다.</p>
                </div>
                {bridgeConnected && (
                  <button
                    onClick={() => handleOpenFolder('')}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors shadow-sm"
                  >
                    탐색기에서 열기
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!bridgeConnected ? (
                <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4">
                  <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                  <h3 className="font-extrabold text-amber-900">로컬 브릿지 오프라인</h3>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    로컬 바탕화면 탐색기를 조회하거나 로컬 파일을 링크하려면 로컬 브릿지 서버를 켜주셔야 합니다.<br />
                    사내 PC의 WorkHub 폴더 안에 있는 <strong>&apos;브릿지_시작.bat&apos;</strong> 파일을 더블 클릭하여 실행해주세요.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['0_프로젝트', '1_영역', '2_자료', '3_보관소'].map((para) => (
                    <div key={para} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          📂 {para}
                        </span>
                        <button
                          onClick={() => handleOpenFolder(para)}
                          className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          열기 <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* 폴더 내 파일 요약 목록 */}
                      <div className="space-y-2 text-xs text-slate-500 max-h-40 overflow-y-auto">
                        {desktopFiles.filter(f => f.path.startsWith(para)).slice(0, 5).map(file => (
                          <div key={file.path} className="truncate" title={file.name}>
                            📄 {file.name}
                          </div>
                        ))}
                        {desktopFiles.filter(f => f.path.startsWith(para)).length > 5 && (
                          <div className="text-[10px] text-slate-400 font-medium">외 {desktopFiles.filter(f => f.path.startsWith(para)).length - 5}개 더 있음</div>
                        )}
                        {desktopFiles.filter(f => f.path.startsWith(para)).length === 0 && (
                          <div className="text-center py-6 text-slate-400">비어있음</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 명함첩 & 자료실 플레이스홀더 */}
          {(activeView === 'vendors' || activeView === 'components') && (
            <div className="text-center py-24 max-w-lg mx-auto space-y-5 bg-white border border-slate-200/80 rounded-3xl p-10 shadow-sm">
              <span className="text-6xl inline-block mb-2">
                {activeView === 'vendors' ? '👤' : '📁'}
              </span>
              <h2 className="text-lg font-extrabold text-slate-800">
                {activeView === 'vendors' ? '명함첩 관리' : '공유 자료실 (도면/양식)'}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                현재 마이그레이션이 성공적으로 진행되었으며, 데이터베이스가 SQLite 파일 기반 DB로 완전 통합되었습니다. 상세 화면 및 CRUD 폼 컴포넌트는 추후 설계 단계에서 추가 연동될 예정입니다.
              </p>
            </div>
          )}

        </main>
      </div>

      {/* 부서원 추가 모달 */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-100 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-800 mb-1">부서원 추가</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">상대방의 Google 이메일을 입력하면 열람 요청이 전송되며, 상대방의 승인 완료 후 해당 탭에서 업무를 확인할 수 있게 됩니다. (최대 50명)</p>
            <input
              type="email"
              value={newMemberEmail}
              onChange={e => setNewMemberEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              placeholder="example@gmail.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-5"
            />
            <div className="flex gap-3 text-sm font-semibold">
              <button 
                onClick={() => setShowMemberModal(false)} 
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={addMember} 
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-md shadow-blue-600/10"
              >
                요청 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업무 상세 모달 */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)} 
          isReadOnly={isReadOnly}
        />
      )}

      {/* 반복 업무 설정 모달 */}
      {showRecurringModal && (
        <RecurringTasksModal 
          onClose={() => setShowRecurringModal(false)} 
        />
      )}

    </div>
  );
}
