'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';

// 브릿지 URL
const BRIDGE_URL = 'http://localhost:45679';

// 탭 타입
type MemberTab = {
  userId: string;
  email: string;
  displayName: string;
  status: 'approved' | 'pending';
};

export default function WorkHubApp() {
  const { data: session } = useSession();
  const [activeView, setActiveView] = useState('dashboard');
  const [activeMember, setActiveMember] = useState<string | null>(null); // null = 내 업무
  const [tasks, setTasks] = useState<any[]>([]);
  const [memberTasks, setMemberTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<MemberTab[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);

  // 브릿지 연결 상태 확인
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/bridge/status`, { signal: AbortSignal.timeout(2000) });
        setBridgeConnected(res.ok);
      } catch {
        setBridgeConnected(false);
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 15000);
    return () => clearInterval(interval);
  }, []);

  // 내 업무 로드
  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    if (res.ok) setTasks(await res.json());
  }, []);

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
      loadTasks();
      loadMembers();
    }
  }, [session, loadTasks, loadMembers]);

  // 부서원 업무 로드
  const loadMemberTasks = useCallback(async (userId: string) => {
    const res = await fetch(`/api/members/${userId}/tasks`);
    if (res.ok) setMemberTasks(await res.json());
  }, []);

  // 탭 클릭 (스왑)
  const handleTabClick = (memberId: string | null) => {
    setActiveMember(memberId);
    if (memberId) loadMemberTasks(memberId);
    else setMemberTasks([]);
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
      alert(data.status === 'not_registered' ? '요청을 보냈습니다. 상대방이 WorkHub에 가입하면 알림이 표시됩니다.' : '열람 요청을 보냈습니다. 상대방의 승인을 기다립니다.');
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

  // 현재 표시할 업무 목록
  const currentTasks = activeMember ? memberTasks : tasks;
  const isReadOnly = !!activeMember;

  const statusColors: Record<string, string> = {
    pending_approval: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  const statusLabels: Record<string, string> = {
    pending_approval: '대기',
    in_progress: '진행',
    completed: '완료',
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 사이드바 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0 shadow-xl`}>
        {/* 로고 */}
        <div className="h-16 flex items-center px-6 border-b border-slate-700 bg-slate-950 text-white font-bold text-xl tracking-wider shrink-0">
          <span className="text-blue-500 mr-3">⬛</span>
          JKP WorkHub
        </div>

        {/* 유저 정보 */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 shrink-0">
          {session?.user?.image && (
            <img src={session.user.image} alt="avatar" className="w-8 h-8 rounded-full ring-2 ring-blue-500" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{session?.user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">메뉴</p>
          {[
            { id: 'dashboard', label: '대시보드', icon: '🏠' },
            { id: 'orders', label: '프로젝트 & 업무', icon: '📋' },
            { id: 'allTasks', label: '전체 업무 리스트', icon: '📄' },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors ${activeView === item.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
              <span className="mr-3">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">공통 데이터베이스</p>
          {[
            { id: 'vendors', label: '명함첩', icon: '👤' },
            { id: 'components', label: '공유 자료실', icon: '📁' },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors ${activeView === item.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
              <span className="mr-3">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}

          {/* 파일 탐색기 - 브릿지 필요 */}
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">로컬 파일</p>
          <button onClick={() => setActiveView('folders')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors ${!bridgeConnected ? 'opacity-40 cursor-not-allowed' : activeView === 'folders' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            disabled={!bridgeConnected} title={!bridgeConnected ? '브릿지 서버를 실행해주세요' : ''}>
            <span className="mr-3">🗂️</span>
            <span className="font-medium text-sm">바탕화면 폴더</span>
            <span className={`ml-auto w-2 h-2 rounded-full ${bridgeConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </button>
        </nav>

        {/* 로그아웃 */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm">
            <span>🚪</span> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4 shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 부서원 탭 바 */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto">
            {/* 내 업무 탭 */}
            <button onClick={() => handleTabClick(null)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${!activeMember ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {session?.user?.image && <img src={session.user.image} className="w-5 h-5 rounded-full" alt="" />}
              내 업무
            </button>

            {/* 부서원 탭들 */}
            {members.map(member => (
              <button key={member.userId} onClick={() => handleTabClick(member.userId)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap group ${activeMember === member.userId ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {member.displayName}
                <span onClick={(e) => { e.stopPropagation(); /* 삭제 */ }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all text-xs">×</span>
              </button>
            ))}

            {/* 부서원 추가 버튼 (50명 미만) */}
            {members.length < 50 && (
              <button onClick={() => setShowMemberModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-slate-500 hover:bg-slate-100 border border-dashed border-slate-300 transition-all whitespace-nowrap">
                <span>+</span> 부서원 추가
              </button>
            )}
          </div>

          {/* 알림 뱃지 (받은 요청) */}
          {incomingRequests.length > 0 && (
            <div className="relative">
              <button className="relative p-2 text-slate-500 hover:text-slate-800">
                <span>🔔</span>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{incomingRequests.length}</span>
              </button>
              {/* 알림 드롭다운 */}
              <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
                <p className="text-sm font-semibold text-slate-800 mb-2">업무 열람 요청</p>
                {incomingRequests.map(req => (
                  <div key={req.requester_id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{req.requester_id}</p>
                      <p className="text-xs text-slate-400">열람을 요청했습니다</p>
                    </div>
                    <button onClick={() => respondToRequest(req.requester_id, 'approve')} className="px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">허용</button>
                    <button onClick={() => respondToRequest(req.requester_id, 'reject')} className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-300">거부</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 읽기전용 뱃지 */}
          {isReadOnly && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              👁️ 읽기 전용
            </span>
          )}

          {/* 브릿지 상태 */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${bridgeConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${bridgeConnected ? 'bg-green-500' : 'bg-red-400'}`} />
            {bridgeConnected ? '브릿지 연결됨' : '브릿지 오프라인'}
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-auto p-6">
          {/* 대시보드 */}
          {activeView === 'dashboard' && (
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {activeMember ? `${members.find(m => m.userId === activeMember)?.displayName}의 업무 현황` : '내 업무 대시보드'}
              </h1>

              {/* 통계 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: '전체 업무', count: currentTasks.length, color: 'bg-blue-500', icon: '📋' },
                  { label: '진행 중', count: currentTasks.filter(t => t.status === 'in_progress').length, color: 'bg-amber-500', icon: '⚡' },
                  { label: '완료', count: currentTasks.filter(t => t.status === 'completed').length, color: 'bg-green-500', icon: '✅' },
                  { label: '대기 중', count: currentTasks.filter(t => t.status === 'pending_approval').length, color: 'bg-slate-400', icon: '⏳' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-lg mb-3`}>{stat.icon}</div>
                    <p className="text-3xl font-bold text-slate-800">{stat.count}</p>
                    <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 최근 업무 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800">최근 업무</h2>
                </div>
                <div className="divide-y divide-slate-50">
                  {currentTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[task.status] || task.status}
                      </span>
                      <p className="flex-1 text-sm font-medium text-slate-700 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400">{task.delivery_date || task.deliveryDate}</p>
                    </div>
                  ))}
                  {currentTasks.length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-400">
                      <p className="text-4xl mb-3">📭</p>
                      <p className="text-sm">업무가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 업무 목록 */}
          {(activeView === 'orders' || activeView === 'allTasks') && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800">
                  {activeMember ? `${members.find(m => m.userId === activeMember)?.displayName}의 업무` : '내 업무 관리'}
                </h1>
                {!isReadOnly && (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                    + 업무 추가
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {currentTasks.map(task => (
                  <div key={task.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5'}`}>
                    <div className="flex items-start gap-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[task.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[task.status] || task.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">{task.title}</h3>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                          {task.department && <span>📂 {task.department}</span>}
                          {task.assignee && <span>👤 {task.assignee}</span>}
                          {(task.delivery_date || task.deliveryDate) && <span>📅 {task.delivery_date || task.deliveryDate}</span>}
                        </div>
                      </div>
                      {task.priority && (
                        <span className="text-xs text-slate-400 shrink-0">{task.priority}</span>
                      )}
                    </div>
                  </div>
                ))}

                {currentTasks.length === 0 && (
                  <div className="text-center py-20 text-slate-400">
                    <p className="text-5xl mb-4">📭</p>
                    <p className="font-medium">업무가 없습니다</p>
                    {!isReadOnly && <p className="text-sm mt-2">위의 &apos;업무 추가&apos; 버튼으로 첫 업무를 등록하세요.</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 파일 탐색기 */}
          {activeView === 'folders' && (
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-6">바탕화면 폴더 탐색기</h1>
              {!bridgeConnected ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                  <p className="text-4xl mb-4">🔌</p>
                  <p className="font-semibold text-amber-800">로컬 브릿지 서버가 실행되지 않고 있습니다</p>
                  <p className="text-sm text-amber-600 mt-2">WorkHub 폴더의 &apos;브릿지_시작.bat&apos; 파일을 실행해주세요.</p>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">브릿지가 연결되었습니다. 파일 탐색 기능을 이용하세요.</p>
              )}
            </div>
          )}

          {/* 기타 뷰 (명함첩, 자료실) */}
          {(activeView === 'vendors' || activeView === 'components') && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-5xl mb-4">{activeView === 'vendors' ? '👤' : '📁'}</p>
              <p className="font-medium text-slate-600">{activeView === 'vendors' ? '명함첩' : '공유 자료실'}</p>
              <p className="text-sm mt-2">기능 구현 중입니다.</p>
            </div>
          )}
        </main>
      </div>

      {/* 부서원 추가 모달 */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">부서원 추가</h3>
            <p className="text-sm text-slate-500 mb-5">Google 이메일을 입력하면 열람 요청이 전송됩니다. 상대방이 승인 후 업무를 볼 수 있습니다. ({members.length}/50명)</p>
            <input
              type="email"
              value={newMemberEmail}
              onChange={e => setNewMemberEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember()}
              placeholder="example@gmail.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowMemberModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">취소</button>
              <button onClick={addMember} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">요청 보내기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
