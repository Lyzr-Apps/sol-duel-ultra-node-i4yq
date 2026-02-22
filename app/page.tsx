'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { RiWallet3Line, RiSwordLine, RiDashboardLine, RiHistoryLine, RiQuestionLine, RiShieldCheckLine, RiLightbulbLine, RiShareLine, RiCloseLine, RiGhostLine, RiSunLine, RiSendPlane2Line, RiArrowLeftLine, RiAddLine, RiSubtractLine, RiCheckLine, RiErrorWarningLine, RiRefreshLine, RiTrophyLine, RiFireLine, RiPercentLine, RiCloseCircleLine, RiArrowUpLine, RiArrowDownLine, RiTimeLine, RiCoinLine, RiFilterLine, RiLoader4Line, RiInformationLine, RiFileCopyLine, RiGameLine } from 'react-icons/ri'

// ========== CONSTANTS ==========
const AGENT_WALLET = '699a77f6e2098a3529de82e3'
const AGENT_FAIRNESS = '699a77f6c1653e1be7d96226'
const AGENT_INSIGHT = '699a77f6b0da46f6ada21c33'
const PLATFORM_FEE = 0.05
const WAGER_TIERS = [0.5, 1, 2, 5, 10]

// ========== TYPES ==========
interface DuelRecord {
  id: string
  date: string
  opponent: string
  wager: number
  result: 'win' | 'loss'
  payout: number
  duelId: string
}

interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'payout' | 'wager'
  amount: number
  date: string
  status: 'completed' | 'pending'
}

interface AgentMessage {
  role: 'user' | 'agent'
  content: string
  data?: Record<string, unknown>
}

type TabType = 'play' | 'dashboard' | 'history' | 'wallet'
type GamePhase = 'landing' | 'connected' | 'wager' | 'pickside' | 'matchmaking' | 'waiting' | 'duel' | 'result'
type AgentPanelType = 'wallet' | 'fairness' | 'insight' | null
type HistoryFilter = 'all' | 'wins' | 'losses'

interface MatchmakingPool {
  tier: number
  queueCount: number
  activeGames: number
}

function generatePoolStats(): MatchmakingPool[] {
  return WAGER_TIERS.map(tier => ({
    tier,
    queueCount: Math.floor(Math.random() * 15) + 1,
    activeGames: Math.floor(Math.random() * 30) + 5
  }))
}

function getTotalOnline(pools: MatchmakingPool[]): number {
  return pools.reduce((sum, p) => sum + p.queueCount * 2 + p.activeGames * 2, 0)
}

function getTotalActiveGames(pools: MatchmakingPool[]): number {
  return pools.reduce((sum, p) => sum + p.activeGames, 0)
}

// ========== HELPERS ==========
function generateAddress(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'
  let addr = ''
  for (let i = 0; i < 44; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)]
  }
  return addr
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr || ''
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

function generateDuelId(): string {
  return 'DUEL-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

function generateTxId(): string {
  return 'TX-' + Math.random().toString(36).substring(2, 12).toUpperCase()
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

// ========== SAMPLE DATA ==========
function generateSampleDuels(): DuelRecord[] {
  const opponents = [
    generateAddress(), generateAddress(), generateAddress(),
    generateAddress(), generateAddress(), generateAddress(),
    generateAddress(), generateAddress()
  ]
  const wagers = [0.5, 1, 2, 5, 1, 2, 0.5, 10]
  const results: ('win' | 'loss')[] = ['win', 'loss', 'win', 'win', 'loss', 'win', 'win', 'loss']

  return opponents.map((opp, i) => ({
    id: generateTxId(),
    date: new Date(Date.now() - (i + 1) * 3600000 * (i + 2)).toISOString(),
    opponent: opp,
    wager: wagers[i],
    result: results[i],
    payout: results[i] === 'win' ? wagers[i] * 2 * (1 - PLATFORM_FEE) : 0,
    duelId: generateDuelId()
  }))
}

function generateSampleTransactions(): Transaction[] {
  return [
    { id: generateTxId(), type: 'deposit', amount: 10, date: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
    { id: generateTxId(), type: 'wager', amount: 2, date: new Date(Date.now() - 72000000).toISOString(), status: 'completed' },
    { id: generateTxId(), type: 'payout', amount: 3.8, date: new Date(Date.now() - 72000000).toISOString(), status: 'completed' },
    { id: generateTxId(), type: 'wager', amount: 1, date: new Date(Date.now() - 36000000).toISOString(), status: 'completed' },
    { id: generateTxId(), type: 'deposit', amount: 5, date: new Date(Date.now() - 18000000).toISOString(), status: 'completed' },
    { id: generateTxId(), type: 'withdrawal', amount: 3, date: new Date(Date.now() - 7200000).toISOString(), status: 'completed' },
  ]
}

// ========== MARKDOWN RENDERER ==========
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[hsl(180,100%,70%)]">{part}</strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1 text-[hsl(180,100%,70%)]">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1 text-[hsl(180,100%,70%)]">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-[hsl(180,100%,70%)]">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm text-[hsl(180,50%,45%)]">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm text-[hsl(180,50%,45%)]">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-[hsl(180,50%,45%)]">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ========== LOADING DOTS ==========
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full bg-[hsl(180,100%,50%)]"
          style={{
            animation: 'dotPulse 1.4s infinite ease-in-out both',
            animationDelay: `${i * 0.16}s`
          }}
        />
      ))}
    </div>
  )
}

// ========== CONFETTI ==========
function ConfettiParticles() {
  const [particles] = useState(() => {
    const colors = [
      'hsl(180, 100%, 50%)', 'hsl(300, 80%, 50%)', 'hsl(60, 100%, 50%)',
      'hsl(120, 80%, 50%)', 'hsl(30, 100%, 60%)'
    ]
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 4 + Math.random() * 6,
      xDrift: -30 + Math.random() * 60
    }))
  })

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            bottom: '40%',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animation: `floatUp ${p.duration}s ease-out ${p.delay}s forwards`,
            transform: `translateX(${p.xDrift}px)`
          }}
        />
      ))}
    </div>
  )
}

// ========== COIN COMPONENT ==========
function CoinFlipAnimation({ flipping, result }: { flipping: boolean; result: 'H' | 'T' | null }) {
  return (
    <div className="flex items-center justify-center" style={{ perspective: '600px' }}>
      <div
        className="relative w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl border-2 border-[hsl(180,100%,50%)]"
        style={{
          background: 'linear-gradient(135deg, hsl(260, 25%, 12%), hsl(260, 30%, 8%))',
          animation: flipping ? 'coinFlip 4s ease-out forwards' : 'none',
          boxShadow: result
            ? result === 'H'
              ? '0 0 30px hsla(180, 100%, 50%, 0.5), 0 0 60px hsla(180, 100%, 50%, 0.2)'
              : '0 0 30px hsla(300, 80%, 50%, 0.5), 0 0 60px hsla(300, 80%, 50%, 0.2)'
            : '0 0 20px hsla(180, 100%, 50%, 0.3)',
          transformStyle: 'preserve-3d',
          color: 'hsl(180, 100%, 50%)'
        }}
      >
        <span className="font-mono tracking-wider">
          {result ? result : 'S'}
        </span>
        <div
          className="absolute inset-0 rounded-full border border-[hsl(180,60%,30%)] opacity-30"
          style={{ background: 'radial-gradient(circle at 30% 30%, hsla(180,100%,50%,0.1), transparent)' }}
        />
      </div>
    </div>
  )
}

// ========== RADAR ANIMATION ==========
function RadarAnimation() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {[1, 2, 3].map((ring) => (
        <div
          key={ring}
          className="absolute inset-0 rounded-full border border-[hsl(180,60%,30%)]"
          style={{
            opacity: 0.3 / ring,
            transform: `scale(${ring * 0.33})`,
            animation: `ringPulse 2s ease-out ${ring * 0.4}s infinite`
          }}
        />
      ))}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, hsla(180, 100%, 50%, 0.3) 60deg, transparent 120deg)',
          animation: 'radarSweep 2s linear infinite'
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-[hsl(180,100%,50%)]" style={{ boxShadow: '0 0 10px hsla(180,100%,50%,0.6)' }} />
      </div>
    </div>
  )
}

// ========== AGENT PANEL ==========
function AgentPanel({
  type,
  visible,
  onClose,
  messages,
  loading,
  inputValue,
  onInputChange,
  onSend,
  agentResponse,
  duelDetail
}: {
  type: AgentPanelType
  visible: boolean
  onClose: () => void
  messages: AgentMessage[]
  loading: boolean
  inputValue: string
  onInputChange: (v: string) => void
  onSend: () => void
  agentResponse: Record<string, unknown> | null
  duelDetail: DuelRecord | null
}) {
  if (!visible || !type) return null

  const titles: Record<string, string> = {
    wallet: 'Wallet Assistant',
    fairness: 'Fairness Verifier',
    insight: 'Match Insight'
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ animation: 'slideUp 0.3s ease-out forwards' }}
    >
      <div
        className="mx-auto max-w-lg rounded-t-xl border border-[hsl(180,60%,30%)] border-b-0 overflow-hidden"
        style={{
          maxHeight: '60vh',
          background: 'hsla(260, 25%, 9%, 0.95)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 30px hsla(180, 100%, 50%, 0.15)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(180,60%,30%)]">
          <div className="flex items-center gap-2">
            {type === 'wallet' && <RiWallet3Line className="w-4 h-4 text-[hsl(180,100%,50%)]" />}
            {type === 'fairness' && <RiShieldCheckLine className="w-4 h-4 text-[hsl(180,100%,50%)]" />}
            {type === 'insight' && <RiLightbulbLine className="w-4 h-4 text-[hsl(60,100%,50%)]" />}
            <span className="text-sm font-bold tracking-wider text-[hsl(180,100%,70%)]">{titles[type] ?? 'Agent'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[hsl(260,20%,15%)] transition-colors">
            <RiCloseLine className="w-5 h-5 text-[hsl(180,50%,45%)]" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(60vh - 120px)' }}>
          {/* Messages for wallet */}
          {type === 'wallet' && Array.isArray(messages) && messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]' : 'bg-[hsl(260,20%,15%)] text-[hsl(180,50%,45%)]'}`}
              >
                {msg.data ? (
                  <div className="space-y-2">
                    {msg.data.balance_info && (
                      <div className="bg-[hsl(260,25%,9%)] rounded p-2 border border-[hsl(180,60%,30%)]">
                        <div className="text-xs font-bold text-[hsl(180,100%,50%)] mb-1 flex items-center gap-1">
                          <RiWallet3Line className="w-3 h-3" /> Balance Info
                        </div>
                        {renderMarkdown(String(msg.data.balance_info))}
                      </div>
                    )}
                    {msg.data.transaction_summary && (
                      <div className="bg-[hsl(260,25%,9%)] rounded p-2 border border-[hsl(180,60%,30%)]">
                        <div className="text-xs font-bold text-[hsl(300,80%,50%)] mb-1 flex items-center gap-1">
                          <RiTimeLine className="w-3 h-3" /> Transaction Summary
                        </div>
                        {renderMarkdown(String(msg.data.transaction_summary))}
                      </div>
                    )}
                    {msg.data.advice && (
                      <div className="bg-[hsl(260,25%,9%)] rounded p-2 border border-[hsl(60,100%,50%)]" style={{ borderColor: 'hsla(60,100%,50%,0.3)' }}>
                        <div className="text-xs font-bold text-[hsl(60,100%,50%)] mb-1 flex items-center gap-1">
                          <RiLightbulbLine className="w-3 h-3" /> Advice
                        </div>
                        {renderMarkdown(String(msg.data.advice))}
                      </div>
                    )}
                  </div>
                ) : (
                  renderMarkdown(msg.content)
                )}
              </div>
            </div>
          ))}

          {/* Fairness Results */}
          {type === 'fairness' && (
            <div>
              {loading ? (
                <div className="text-center py-6">
                  <LoadingDots />
                  <p className="text-xs text-[hsl(180,50%,45%)] mt-2">Verifying duel fairness...</p>
                </div>
              ) : agentResponse ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${agentResponse.is_fair ? 'bg-[hsla(120,80%,40%,0.2)] text-[hsl(120,80%,50%)]' : 'bg-[hsla(0,100%,55%,0.2)] text-[hsl(0,100%,55%)]'}`}>
                      {agentResponse.is_fair ? 'FAIR' : 'REVIEW NEEDED'}
                    </span>
                    {agentResponse.duel_id && (
                      <span className="text-xs font-mono text-[hsl(180,50%,45%)]">{String(agentResponse.duel_id)}</span>
                    )}
                  </div>
                  {agentResponse.verification_result && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(180,60%,30%)]">
                      <div className="text-xs font-bold text-[hsl(180,100%,50%)] mb-1">Verification Result</div>
                      {renderMarkdown(String(agentResponse.verification_result))}
                    </div>
                  )}
                  {agentResponse.randomness_seed && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(180,60%,30%)]">
                      <div className="text-xs font-bold text-[hsl(300,80%,50%)] mb-1">Randomness Seed</div>
                      <code className="text-xs font-mono text-[hsl(180,50%,45%)] break-all">{String(agentResponse.randomness_seed)}</code>
                    </div>
                  )}
                  {agentResponse.explanation && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(180,60%,30%)]">
                      <div className="text-xs font-bold text-[hsl(60,100%,50%)] mb-1">Explanation</div>
                      {renderMarkdown(String(agentResponse.explanation))}
                    </div>
                  )}
                </div>
              ) : duelDetail ? (
                <p className="text-sm text-[hsl(180,50%,45%)]">Ready to verify duel {duelDetail.duelId}</p>
              ) : null}
            </div>
          )}

          {/* Insight Results */}
          {type === 'insight' && (
            <div>
              {loading ? (
                <div className="text-center py-6">
                  <LoadingDots />
                  <p className="text-xs text-[hsl(180,50%,45%)] mt-2">Analyzing match...</p>
                </div>
              ) : agentResponse ? (
                <div className="space-y-3">
                  {agentResponse.summary && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(180,60%,30%)]">
                      <div className="text-xs font-bold text-[hsl(180,100%,50%)] mb-1">Summary</div>
                      {renderMarkdown(String(agentResponse.summary))}
                    </div>
                  )}
                  {agentResponse.highlight && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(300,80%,50%)]" style={{ borderColor: 'hsla(300,80%,50%,0.4)' }}>
                      <div className="text-xs font-bold text-[hsl(300,80%,50%)] mb-1">Highlight</div>
                      {renderMarkdown(String(agentResponse.highlight))}
                    </div>
                  )}
                  {agentResponse.streak_info && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(60,100%,50%)]" style={{ borderColor: 'hsla(60,100%,50%,0.3)' }}>
                      <div className="text-xs font-bold text-[hsl(60,100%,50%)] mb-1 flex items-center gap-1">
                        <RiFireLine className="w-3 h-3" /> Streak Info
                      </div>
                      {renderMarkdown(String(agentResponse.streak_info))}
                    </div>
                  )}
                  {agentResponse.share_text && (
                    <div className="bg-[hsl(260,20%,15%)] rounded p-3 border border-[hsl(180,60%,30%)]">
                      <div className="text-xs font-bold text-[hsl(180,100%,50%)] mb-1 flex items-center gap-1">
                        <RiShareLine className="w-3 h-3" /> Share Text
                      </div>
                      <p className="text-sm text-[hsl(180,50%,45%)] italic">{String(agentResponse.share_text)}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {loading && type === 'wallet' && (
            <div className="flex justify-start">
              <div className="bg-[hsl(260,20%,15%)] rounded-lg px-3 py-2">
                <LoadingDots />
              </div>
            </div>
          )}
        </div>

        {/* Input for wallet assistant */}
        {type === 'wallet' && (
          <div className="border-t border-[hsl(180,60%,30%)] p-3 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) onSend() }}
              placeholder="Ask about your balance..."
              className="flex-1 bg-[hsl(260,20%,18%)] border border-[hsl(180,60%,30%)] rounded px-3 py-2 text-sm text-[hsl(180,100%,70%)] placeholder:text-[hsl(180,50%,45%)] outline-none focus:border-[hsl(180,100%,50%)] transition-colors"
            />
            <button
              onClick={onSend}
              disabled={loading || !inputValue.trim()}
              className="p-2 rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] disabled:opacity-40 transition-all hover:shadow-lg"
              style={{ boxShadow: '0 0 10px hsla(180,100%,50%,0.3)' }}
            >
              <RiSendPlane2Line className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== ERROR BOUNDARY ==========
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(260, 30%, 6%)' }}>
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2 text-[hsl(180,100%,70%)]">Something went wrong</h2>
            <p className="text-[hsl(180,50%,45%)] mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] rounded text-sm font-bold"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ========== MAIN PAGE ==========
export default function Page() {
  // ---- Core State ----
  const [activeTab, setActiveTab] = useState<TabType>('play')
  const [gamePhase, setGamePhase] = useState<GamePhase>('landing')
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [balance, setBalance] = useState(0)
  const [selectedWager, setSelectedWager] = useState<number | null>(null)
  const [customWager, setCustomWager] = useState('')
  const [duelHistory, setDuelHistory] = useState<DuelRecord[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // ---- Game State ----
  const [currentOpponent, setCurrentOpponent] = useState('')
  const [coinFlipping, setCoinFlipping] = useState(false)
  const [coinResult, setCoinResult] = useState<'H' | 'T' | null>(null)
  const [playerSide, setPlayerSide] = useState<'H' | 'T'>('H')
  const [duelResult, setDuelResult] = useState<'win' | 'loss' | null>(null)
  const [currentDuelId, setCurrentDuelId] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  // ---- Matchmaking Pool State ----
  const [poolStats, setPoolStats] = useState<MatchmakingPool[]>(() => generatePoolStats())
  const [waitingElapsed, setWaitingElapsed] = useState(0)
  const [opponentFound, setOpponentFound] = useState(false)
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const poolRefreshRef = useRef<NodeJS.Timeout | null>(null)

  // ---- UI State ----
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [expandedDuel, setExpandedDuel] = useState<string | null>(null)
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [copied, setCopied] = useState(false)

  // ---- Agent State ----
  const [showAgentPanel, setShowAgentPanel] = useState(false)
  const [agentPanelType, setAgentPanelType] = useState<AgentPanelType>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentResponse, setAgentResponse] = useState<Record<string, unknown> | null>(null)
  const [walletMessages, setWalletMessages] = useState<AgentMessage[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)

  // ---- Wallet deposit/withdraw for wallet tab ----
  const [walletDepositAmount, setWalletDepositAmount] = useState('')
  const [walletWithdrawAmount, setWalletWithdrawAmount] = useState('')
  const [walletShowDeposit, setWalletShowDeposit] = useState(false)
  const [walletShowWithdraw, setWalletShowWithdraw] = useState(false)

  // Duel detail for fairness check
  const [selectedDuelForFairness, setSelectedDuelForFairness] = useState<DuelRecord | null>(null)

  // Current duel record for result screen
  const [lastDuelRecord, setLastDuelRecord] = useState<DuelRecord | null>(null)

  // Matchmaking timer
  const matchmakingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ---- Stats ----
  const wins = duelHistory.filter(d => d.result === 'win').length
  const losses = duelHistory.filter(d => d.result === 'loss').length
  const winRate = duelHistory.length > 0 ? Math.round((wins / duelHistory.length) * 100) : 0
  const currentStreak = (() => {
    let streak = 0
    const sorted = [...duelHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (sorted.length === 0) return 0
    const firstResult = sorted[0]?.result
    for (const d of sorted) {
      if (d.result === firstResult) streak++
      else break
    }
    return firstResult === 'win' ? streak : -streak
  })()

  // ---- Pool Stats Refresh ----
  useEffect(() => {
    poolRefreshRef.current = setInterval(() => {
      setPoolStats(generatePoolStats())
    }, 8000)
    return () => { if (poolRefreshRef.current) clearInterval(poolRefreshRef.current) }
  }, [])

  // ---- Waiting Timer ----
  useEffect(() => {
    if (gamePhase === 'waiting') {
      setWaitingElapsed(0)
      setOpponentFound(false)
      const timer = setInterval(() => {
        setWaitingElapsed(prev => prev + 1)
      }, 1000)
      waitingTimerRef.current = timer

      // Simulate opponent found after random 5-15 seconds
      const matchDelay = 5000 + Math.random() * 10000
      const matchTimeout = setTimeout(() => {
        setOpponentFound(true)
        setCurrentOpponent(generateAddress())
        // Brief pause to show opponent found, then start duel
        setTimeout(() => {
          const wager = selectedWager ?? parseFloat(customWager)
          setGamePhase('duel')
          startDuel(wager)
        }, 1500)
      }, matchDelay)

      return () => {
        clearInterval(timer)
        clearTimeout(matchTimeout)
        waitingTimerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase])

  // ---- Sample Data Toggle ----
  useEffect(() => {
    if (sampleDataOn && duelHistory.length === 0) {
      setDuelHistory(generateSampleDuels())
      setTransactions(generateSampleTransactions())
      if (balance === 0) setBalance(12.5)
    }
    if (!sampleDataOn && duelHistory.length > 0 && !walletConnected) {
      setDuelHistory([])
      setTransactions([])
    }
  }, [sampleDataOn])

  // ---- Connect Wallet ----
  const connectWallet = useCallback(() => {
    const addr = generateAddress()
    setWalletAddress(addr)
    setWalletConnected(true)
    setGamePhase('connected')
    setActiveTab('dashboard')
    setBalance(0)
  }, [])

  // ---- Deposit / Withdraw ----
  const handleDeposit = useCallback((amountStr: string, resetFn: (v: string) => void, closeFn: (v: boolean) => void) => {
    const amt = parseFloat(amountStr)
    if (isNaN(amt) || amt <= 0) return
    setBalance(prev => prev + amt)
    setTransactions(prev => [{
      id: generateTxId(), type: 'deposit', amount: amt,
      date: new Date().toISOString(), status: 'completed'
    }, ...prev])
    resetFn('')
    closeFn(false)
  }, [])

  const handleWithdraw = useCallback((amountStr: string, resetFn: (v: string) => void, closeFn: (v: boolean) => void) => {
    const amt = parseFloat(amountStr)
    if (isNaN(amt) || amt <= 0 || amt > balance) return
    setBalance(prev => prev - amt)
    setTransactions(prev => [{
      id: generateTxId(), type: 'withdrawal', amount: amt,
      date: new Date().toISOString(), status: 'completed'
    }, ...prev])
    resetFn('')
    closeFn(false)
  }, [balance])

  // ---- Pick Side → Matchmaking → Waiting ----
  const goToPickSide = useCallback(() => {
    const wager = selectedWager ?? parseFloat(customWager)
    if (isNaN(wager) || wager <= 0 || wager > balance) return
    setGamePhase('pickside')
  }, [selectedWager, customWager, balance])

  const confirmSide = useCallback((side: 'H' | 'T') => {
    setPlayerSide(side)
    setGamePhase('matchmaking')
    // Brief search animation, then transition to waiting
    matchmakingTimerRef.current = setTimeout(() => {
      setGamePhase('waiting')
    }, 2500)
  }, [])

  const cancelMatchmaking = useCallback(() => {
    if (matchmakingTimerRef.current) clearTimeout(matchmakingTimerRef.current)
    if (waitingTimerRef.current) clearInterval(waitingTimerRef.current)
    setOpponentFound(false)
    setWaitingElapsed(0)
    setGamePhase('wager')
  }, [])

  const cancelFromPickSide = useCallback(() => {
    setGamePhase('wager')
  }, [])

  // ---- Duel Logic ----
  const startDuel = useCallback((wager: number) => {
    setCoinFlipping(true)
    setCoinResult(null)
    setDuelResult(null)
    setShowConfetti(false)
    const duelId = generateDuelId()
    setCurrentDuelId(duelId)

    setTimeout(() => {
      const result: 'H' | 'T' = Math.random() > 0.5 ? 'H' : 'T'
      setCoinResult(result)
      setCoinFlipping(false)

      const won = result === playerSide
      setDuelResult(won ? 'win' : 'loss')
      if (won) setShowConfetti(true)

      const payout = won ? wager * 2 * (1 - PLATFORM_FEE) : 0
      const newBalance = won ? balance - wager + payout : balance - wager
      setBalance(newBalance)

      const record: DuelRecord = {
        id: generateTxId(),
        date: new Date().toISOString(),
        opponent: currentOpponent,
        wager,
        result: won ? 'win' : 'loss',
        payout,
        duelId
      }
      setLastDuelRecord(record)
      setDuelHistory(prev => [record, ...prev])
      setTransactions(prev => [
        ...(won ? [{
          id: generateTxId(), type: 'payout' as const, amount: payout,
          date: new Date().toISOString(), status: 'completed' as const
        }] : []),
        {
          id: generateTxId(), type: 'wager' as const, amount: wager,
          date: new Date().toISOString(), status: 'completed' as const
        },
        ...prev
      ])

      setTimeout(() => setGamePhase('result'), 2500)
    }, 4000)
  }, [playerSide, balance, currentOpponent])

  // ---- Agent Calls ----
  const openAgentPanel = useCallback((type: AgentPanelType) => {
    setAgentPanelType(type)
    setShowAgentPanel(true)
    setAgentResponse(null)
    setAgentError(null)

    if (type === 'fairness' && selectedDuelForFairness) {
      callFairnessAgent(selectedDuelForFairness)
    }
    if (type === 'insight' && lastDuelRecord) {
      callInsightAgent(lastDuelRecord)
    }
  }, [selectedDuelForFairness, lastDuelRecord])

  const closeAgentPanel = useCallback(() => {
    setShowAgentPanel(false)
    setAgentPanelType(null)
    setAgentResponse(null)
    setAgentError(null)
  }, [])

  const callWalletAgent = useCallback(async (message: string) => {
    if (!message.trim()) return
    setWalletMessages(prev => [...prev, { role: 'user', content: message }])
    setAgentInput('')
    setAgentLoading(true)
    setActiveAgentId(AGENT_WALLET)
    setAgentError(null)

    try {
      const result = await callAIAgent(message, AGENT_WALLET)
      if (result.success && result?.response?.result) {
        const data = result.response.result
        setWalletMessages(prev => [...prev, {
          role: 'agent',
          content: '',
          data: {
            balance_info: data.balance_info ?? '',
            transaction_summary: data.transaction_summary ?? '',
            advice: data.advice ?? ''
          }
        }])
      } else {
        setWalletMessages(prev => [...prev, {
          role: 'agent',
          content: result?.error ?? 'Unable to get response. Please try again.'
        }])
      }
    } catch (err) {
      setWalletMessages(prev => [...prev, {
        role: 'agent',
        content: 'Network error. Please try again.'
      }])
    } finally {
      setAgentLoading(false)
      setActiveAgentId(null)
    }
  }, [])

  const callFairnessAgent = useCallback(async (duel: DuelRecord) => {
    setAgentLoading(true)
    setActiveAgentId(AGENT_FAIRNESS)
    setAgentError(null)

    try {
      const message = `Verify fairness for duel ID: ${duel.duelId}`
      const result = await callAIAgent(message, AGENT_FAIRNESS)
      if (result.success && result?.response?.result) {
        setAgentResponse(result.response.result as Record<string, unknown>)
      } else {
        setAgentError(result?.error ?? 'Verification failed')
      }
    } catch {
      setAgentError('Network error during verification')
    } finally {
      setAgentLoading(false)
      setActiveAgentId(null)
    }
  }, [])

  const callInsightAgent = useCallback(async (duel: DuelRecord) => {
    setAgentLoading(true)
    setActiveAgentId(AGENT_INSIGHT)
    setAgentError(null)

    try {
      const message = `Generate insight for duel ${duel.duelId}: Player ${truncateAddress(walletAddress)} vs ${truncateAddress(duel.opponent)}, wager ${duel.wager} SOL, result: ${duel.result}, payout: ${duel.payout} SOL, current streak: ${currentStreak}`
      const result = await callAIAgent(message, AGENT_INSIGHT)
      if (result.success && result?.response?.result) {
        setAgentResponse(result.response.result as Record<string, unknown>)
      } else {
        setAgentError(result?.error ?? 'Insight generation failed')
      }
    } catch {
      setAgentError('Network error during insight generation')
    } finally {
      setAgentLoading(false)
      setActiveAgentId(null)
    }
  }, [walletAddress, currentStreak])

  // ---- Copy share text ----
  const copyShareText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [])

  // ---- Play Again ----
  const playAgain = useCallback(() => {
    setGamePhase('wager')
    setSelectedWager(null)
    setCustomWager('')
    setCoinResult(null)
    setCoinFlipping(false)
    setDuelResult(null)
    setShowConfetti(false)
    setLastDuelRecord(null)
    setOpponentFound(false)
    setWaitingElapsed(0)
    closeAgentPanel()
  }, [closeAgentPanel])

  // ---- Filtered History ----
  const filteredHistory = duelHistory.filter(d => {
    if (historyFilter === 'wins') return d.result === 'win'
    if (historyFilter === 'losses') return d.result === 'loss'
    return true
  })

  // ===== RENDER =====
  return (
    <ErrorBoundary>
      <div
        className="min-h-screen font-sans relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(260, 35%, 8%) 0%, hsl(280, 30%, 10%) 50%, hsl(240, 25%, 8%) 100%)',
          letterSpacing: '0.02em',
          color: 'hsl(180, 100%, 70%)'
        }}
      >
        {/* ===== LANDING SCREEN ===== */}
        {!walletConnected && gamePhase === 'landing' && (
          <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
            {/* Sample data toggle */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="text-xs text-[hsl(180,50%,45%)]">Sample Data</span>
              <button
                onClick={() => setSampleDataOn(prev => !prev)}
                className="relative w-10 h-5 rounded-full transition-colors"
                style={{ background: sampleDataOn ? 'hsl(180, 100%, 50%)' : 'hsl(260, 20%, 18%)' }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ left: sampleDataOn ? '22px' : '2px' }}
                />
              </button>
            </div>

            {/* Logo */}
            <div className="mb-8 text-center">
              <h1
                className="text-5xl font-bold tracking-wider mb-2"
                style={{ animation: 'logoGlow 3s ease-in-out infinite', color: 'hsl(180, 100%, 50%)' }}
              >
                SolFlip
              </h1>
              <p className="text-sm text-[hsl(180,50%,45%)] tracking-widest uppercase">Flip. Win. Repeat.</p>
            </div>

            {/* Coin */}
            <div className="mb-10">
              <CoinFlipAnimation flipping={false} result={null} />
            </div>

            {/* Connect button */}
            <button
              onClick={connectWallet}
              className="flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-base tracking-wider transition-all"
              style={{
                background: 'hsl(180, 100%, 50%)',
                color: 'hsl(260, 30%, 6%)',
                animation: 'pulseGlow 2s ease-in-out infinite'
              }}
            >
              <RiWallet3Line className="w-5 h-5" />
              Connect Wallet
            </button>

            {/* Supported wallets */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(180,50%,45%)]">
                <RiGhostLine className="w-4 h-4" />
                Phantom
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[hsl(180,50%,45%)]">
                <RiSunLine className="w-4 h-4" />
                Solflare
              </div>
            </div>
          </div>
        )}

        {/* ===== CONNECTED APP ===== */}
        {walletConnected && (
          <div className="min-h-screen pb-20 max-w-lg mx-auto relative">

            {/* ===== TOP STATUS BAR ===== */}
            {gamePhase !== 'pickside' && gamePhase !== 'matchmaking' && gamePhase !== 'waiting' && gamePhase !== 'duel' && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(180,60%,30%)]" style={{ background: 'hsla(260,25%,9%,0.8)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2">
                  <RiWallet3Line className="w-4 h-4 text-[hsl(180,100%,50%)]" />
                  <span className="text-xs font-mono text-[hsl(180,50%,45%)]">{truncateAddress(walletAddress)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RiCoinLine className="w-4 h-4 text-[hsl(60,100%,50%)]" />
                  <span className="text-sm font-bold text-[hsl(180,100%,70%)]">{balance.toFixed(2)} SOL</span>
                </div>
                {/* Sample data toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[hsl(180,50%,45%)]">Sample</span>
                  <button
                    onClick={() => setSampleDataOn(prev => !prev)}
                    className="relative w-8 h-4 rounded-full transition-colors"
                    style={{ background: sampleDataOn ? 'hsl(180, 100%, 50%)' : 'hsl(260, 20%, 18%)' }}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                      style={{ left: sampleDataOn ? '17px' : '2px' }}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* ===== DASHBOARD TAB ===== */}
            {activeTab === 'dashboard' && gamePhase !== 'wager' && gamePhase !== 'pickside' && gamePhase !== 'matchmaking' && gamePhase !== 'waiting' && gamePhase !== 'duel' && gamePhase !== 'result' && (
              <div className="px-4 pt-4 pb-4 space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* Balance Hero */}
                <div
                  className="rounded-lg p-5 border border-[hsl(180,60%,30%)] relative overflow-hidden"
                  style={{
                    background: 'hsla(260, 25%, 9%, 0.8)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 0 20px hsla(180, 100%, 50%, 0.15), inset 0 1px 0 hsla(180,100%,50%,0.1)'
                  }}
                >
                  <div className="text-xs text-[hsl(180,50%,45%)] mb-1 uppercase tracking-wider font-medium">Total Balance</div>
                  <div className="text-4xl font-bold text-[hsl(180,100%,50%)] mb-1">{balance.toFixed(2)}</div>
                  <div className="text-xs text-[hsl(180,50%,45%)]">SOL ~ ${(balance * 150).toFixed(2)} USD</div>

                  <div className="flex gap-2 mt-4">
                    {!showDeposit && !showWithdraw && (
                      <>
                        <button
                          onClick={() => { setShowDeposit(true); setShowWithdraw(false) }}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)] transition-all hover:shadow-lg"
                        >
                          <RiAddLine className="w-3.5 h-3.5" /> Deposit
                        </button>
                        <button
                          onClick={() => { setShowWithdraw(true); setShowDeposit(false) }}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border border-[hsl(180,60%,30%)] text-[hsl(180,100%,50%)] transition-all hover:bg-[hsl(260,20%,15%)]"
                        >
                          <RiSubtractLine className="w-3.5 h-3.5" /> Withdraw
                        </button>
                      </>
                    )}
                    {showDeposit && (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="SOL amount"
                          step="0.1"
                          min="0"
                          className="flex-1 bg-[hsl(260,20%,18%)] border border-[hsl(180,60%,30%)] rounded px-3 py-1.5 text-sm text-[hsl(180,100%,70%)] placeholder:text-[hsl(180,50%,45%)] outline-none"
                        />
                        <button onClick={() => handleDeposit(depositAmount, setDepositAmount, setShowDeposit)} className="p-1.5 rounded bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]">
                          <RiCheckLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setShowDeposit(false); setDepositAmount('') }} className="p-1.5 rounded bg-[hsl(260,20%,15%)]">
                          <RiCloseLine className="w-4 h-4 text-[hsl(180,50%,45%)]" />
                        </button>
                      </div>
                    )}
                    {showWithdraw && (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="SOL amount"
                          step="0.1"
                          min="0"
                          max={balance.toString()}
                          className="flex-1 bg-[hsl(260,20%,18%)] border border-[hsl(180,60%,30%)] rounded px-3 py-1.5 text-sm text-[hsl(180,100%,70%)] placeholder:text-[hsl(180,50%,45%)] outline-none"
                        />
                        <button onClick={() => handleWithdraw(withdrawAmount, setWithdrawAmount, setShowWithdraw)} className="p-1.5 rounded bg-[hsl(300,80%,50%)] text-white">
                          <RiCheckLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setShowWithdraw(false); setWithdrawAmount('') }} className="p-1.5 rounded bg-[hsl(260,20%,15%)]">
                          <RiCloseLine className="w-4 h-4 text-[hsl(180,50%,45%)]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg p-2.5 text-center border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(120, 80%, 30%, 0.1)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <RiTrophyLine className="w-3 h-3 text-[hsl(120,80%,50%)]" />
                    </div>
                    <div className="text-lg font-bold text-[hsl(120,80%,50%)]">{wins}</div>
                    <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider">Wins</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(0, 100%, 55%, 0.1)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <RiCloseCircleLine className="w-3 h-3 text-[hsl(0,100%,55%)]" />
                    </div>
                    <div className="text-lg font-bold text-[hsl(0,100%,55%)]">{losses}</div>
                    <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider">Losses</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(180, 100%, 50%, 0.05)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <RiPercentLine className="w-3 h-3 text-[hsl(180,100%,50%)]" />
                    </div>
                    <div className="text-lg font-bold text-[hsl(180,100%,50%)]">{winRate}%</div>
                    <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider">Rate</div>
                  </div>
                  <div className="rounded-lg p-2.5 text-center border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(60, 100%, 50%, 0.05)' }}>
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <RiFireLine className="w-3 h-3 text-[hsl(60,100%,50%)]" />
                    </div>
                    <div className="text-lg font-bold text-[hsl(60,100%,50%)]">{Math.abs(currentStreak)}</div>
                    <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider">{currentStreak >= 0 ? 'W' : 'L'} Streak</div>
                  </div>
                </div>

                {/* Play Now Button */}
                <button
                  onClick={() => { setActiveTab('play'); setGamePhase('wager') }}
                  className="w-full py-3.5 rounded-lg font-bold text-base tracking-wider flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'hsl(180, 100%, 50%)',
                    color: 'hsl(260, 30%, 6%)',
                    animation: 'pulseGlow 2s ease-in-out infinite'
                  }}
                >
                  <RiSwordLine className="w-5 h-5" /> Play Now
                </button>

                {/* Recent Duels */}
                <div>
                  <h3 className="text-sm font-bold text-[hsl(180,100%,70%)] mb-2 tracking-wider uppercase">Recent Duels</h3>
                  {duelHistory.length === 0 ? (
                    <div className="text-center py-6 rounded-lg border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(260,25%,9%,0.5)' }}>
                      <RiGameLine className="w-8 h-8 mx-auto mb-2 text-[hsl(180,50%,45%)]" />
                      <p className="text-sm text-[hsl(180,50%,45%)]">No duels yet. Start playing!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {duelHistory.slice(0, 5).map((duel) => (
                        <div
                          key={duel.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-[hsl(180,60%,30%)] transition-colors hover:bg-[hsl(260,20%,15%)]"
                          style={{ background: 'hsla(260,25%,9%,0.6)' }}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${duel.result === 'win' ? 'bg-[hsla(120,80%,40%,0.2)] text-[hsl(120,80%,50%)]' : 'bg-[hsla(0,100%,55%,0.2)] text-[hsl(0,100%,55%)]'}`}>
                              {duel.result === 'win' ? 'W' : 'L'}
                            </span>
                            <div>
                              <div className="text-xs font-mono text-[hsl(180,50%,45%)]">vs {truncateAddress(duel.opponent)}</div>
                              <div className="text-[10px] text-[hsl(180,50%,45%)]">{formatDate(duel.date)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-[hsl(180,100%,70%)]">{duel.wager} SOL</div>
                            {duel.result === 'win' && (
                              <div className="text-[10px] text-[hsl(120,80%,50%)]">+{duel.payout.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ask About Balance */}
                <button
                  onClick={() => openAgentPanel('wallet')}
                  className="w-full py-2.5 rounded-lg border border-[hsl(180,60%,30%)] flex items-center justify-center gap-2 text-sm font-medium text-[hsl(180,100%,50%)] transition-all hover:bg-[hsl(260,20%,15%)]"
                >
                  <RiQuestionLine className="w-4 h-4" /> Ask About Balance
                </button>

                {/* Agent Status */}
                <div className="rounded-lg p-3 border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(260,25%,9%,0.5)' }}>
                  <div className="text-[10px] uppercase tracking-widest text-[hsl(180,50%,45%)] mb-2 font-bold">Agent Status</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${activeAgentId === AGENT_WALLET ? 'bg-[hsl(120,80%,50%)] animate-pulse' : 'bg-[hsl(180,50%,45%)]'}`} />
                      <span className="text-[hsl(180,50%,45%)]">Wallet Assistant</span>
                      {activeAgentId === AGENT_WALLET && <span className="text-[10px] text-[hsl(120,80%,50%)]">Active</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${activeAgentId === AGENT_FAIRNESS ? 'bg-[hsl(120,80%,50%)] animate-pulse' : 'bg-[hsl(180,50%,45%)]'}`} />
                      <span className="text-[hsl(180,50%,45%)]">Fairness Verifier</span>
                      {activeAgentId === AGENT_FAIRNESS && <span className="text-[10px] text-[hsl(120,80%,50%)]">Active</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${activeAgentId === AGENT_INSIGHT ? 'bg-[hsl(120,80%,50%)] animate-pulse' : 'bg-[hsl(180,50%,45%)]'}`} />
                      <span className="text-[hsl(180,50%,45%)]">Match Insight</span>
                      {activeAgentId === AGENT_INSIGHT && <span className="text-[10px] text-[hsl(120,80%,50%)]">Active</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== PLAY TAB: WAGER SELECTION ===== */}
            {(activeTab === 'play' && gamePhase === 'wager') && (
              <div className="px-4 pt-6 pb-4 space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[hsl(180,100%,70%)] tracking-wider">Select Wager</h2>
                  <p className="text-xs text-[hsl(180,50%,45%)] mt-1">Choose your stake for the duel</p>
                </div>

                {/* Wager Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {WAGER_TIERS.map((tier) => {
                    const pool = poolStats.find(p => p.tier === tier)
                    return (
                      <button
                        key={tier}
                        onClick={() => { setSelectedWager(tier); setCustomWager('') }}
                        className="rounded-lg p-4 text-center border transition-all relative"
                        style={{
                          background: selectedWager === tier ? 'hsla(180, 100%, 50%, 0.1)' : 'hsla(260, 25%, 9%, 0.8)',
                          borderColor: selectedWager === tier ? 'hsl(180, 100%, 50%)' : 'hsl(180, 60%, 30%)',
                          backdropFilter: 'blur(12px)',
                          boxShadow: selectedWager === tier ? '0 0 20px hsla(180, 100%, 50%, 0.3)' : 'none'
                        }}
                      >
                        {pool && pool.queueCount > 0 && (
                          <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[hsl(120,80%,40%)] text-white" style={{ minWidth: '18px' }}>
                            {pool.queueCount}
                          </div>
                        )}
                        <div className="text-2xl font-bold text-[hsl(180,100%,50%)]">{tier}</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider mt-1">SOL</div>
                      </button>
                    )
                  })}
                  {/* Custom */}
                  <button
                    onClick={() => { setSelectedWager(null) }}
                    className="rounded-lg p-4 text-center border transition-all"
                    style={{
                      background: selectedWager === null && customWager ? 'hsla(300, 80%, 50%, 0.1)' : 'hsla(260, 25%, 9%, 0.8)',
                      borderColor: selectedWager === null && customWager ? 'hsl(300, 80%, 50%)' : 'hsl(180, 60%, 30%)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: selectedWager === null && customWager ? '0 0 20px hsla(300, 80%, 50%, 0.3)' : 'none'
                    }}
                  >
                    {selectedWager === null ? (
                      <input
                        type="number"
                        value={customWager}
                        onChange={(e) => setCustomWager(e.target.value)}
                        placeholder="Custom"
                        step="0.1"
                        min="0.1"
                        className="w-full bg-transparent text-center text-lg font-bold text-[hsl(300,80%,50%)] placeholder:text-[hsl(180,50%,45%)] outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="text-lg font-bold text-[hsl(300,80%,50%)]">Custom</div>
                    )}
                    <div className="text-[10px] text-[hsl(180,50%,45%)] uppercase tracking-wider mt-1">SOL</div>
                  </button>
                </div>

                {/* Live Arena Stats */}
                <div
                  className="rounded-lg p-3 border border-[hsl(180,60%,30%)]"
                  style={{ background: 'hsla(260, 25%, 9%, 0.8)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-widest text-[hsl(180,50%,45%)] font-bold flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(120,80%,50%)] animate-pulse" />
                      Live Arena
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[hsl(180,50%,45%)]">
                      <span className="flex items-center gap-1"><RiGameLine className="w-3 h-3 text-[hsl(180,100%,50%)]" /> {getTotalActiveGames(poolStats)} games</span>
                      <span className="flex items-center gap-1"><RiWallet3Line className="w-3 h-3 text-[hsl(300,80%,50%)]" /> {getTotalOnline(poolStats)} online</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {poolStats.map(pool => (
                      <div
                        key={pool.tier}
                        className="text-center rounded p-1.5 border transition-all"
                        style={{
                          background: (selectedWager === pool.tier) ? 'hsla(180, 100%, 50%, 0.08)' : 'hsla(260, 20%, 15%, 0.6)',
                          borderColor: (selectedWager === pool.tier) ? 'hsl(180, 100%, 50%)' : 'hsl(260, 20%, 20%)'
                        }}
                      >
                        <div className="text-[10px] font-bold text-[hsl(180,100%,70%)]">{pool.tier} SOL</div>
                        <div className="text-[10px] text-[hsl(120,80%,50%)]">{pool.queueCount} waiting</div>
                        <div className="text-[10px] text-[hsl(180,50%,45%)]">{pool.activeGames} live</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balance reminder */}
                <div className="flex items-center justify-between px-3 py-2 rounded bg-[hsl(260,20%,15%)] border border-[hsl(180,60%,30%)]">
                  <span className="text-xs text-[hsl(180,50%,45%)]">Available Balance</span>
                  <span className="text-sm font-bold text-[hsl(180,100%,70%)]">{balance.toFixed(2)} SOL</span>
                </div>

                {/* Insufficient balance warning */}
                {((selectedWager !== null && selectedWager > balance) || (customWager && parseFloat(customWager) > balance)) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded bg-[hsla(0,100%,55%,0.1)] border border-[hsl(0,100%,55%)] text-[hsl(0,100%,55%)] text-xs">
                    <RiErrorWarningLine className="w-4 h-4 flex-shrink-0" />
                    Insufficient balance. Deposit more SOL to continue.
                  </div>
                )}

                {/* Find Duel CTA */}
                <button
                  onClick={goToPickSide}
                  disabled={(!selectedWager && !customWager) || (selectedWager !== null && selectedWager > balance) || (!!customWager && parseFloat(customWager) > balance) || balance <= 0}
                  className="w-full py-3.5 rounded-lg font-bold text-base tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{
                    background: 'hsl(180, 100%, 50%)',
                    color: 'hsl(260, 30%, 6%)',
                    boxShadow: '0 0 20px hsla(180, 100%, 50%, 0.3)'
                  }}
                >
                  <RiSwordLine className="w-5 h-5" /> Find Duel
                </button>

                <button
                  onClick={() => { setActiveTab('dashboard'); setGamePhase('connected') }}
                  className="w-full py-2 text-center text-xs text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,50%)] transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            )}

            {/* ===== PICK SIDE ===== */}
            {gamePhase === 'pickside' && (
              <div className="px-4 pt-10 pb-4 flex flex-col items-center justify-center min-h-[80vh] space-y-8" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[hsl(180,100%,70%)] tracking-wider mb-2">Pick Your Side</h2>
                  <p className="text-xs text-[hsl(180,50%,45%)] max-w-xs mx-auto">
                    Choose heads or tails. Your opponent gets the opposite side. The coin flip result is determined independently.
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  {/* Heads */}
                  <button
                    onClick={() => confirmSide('H')}
                    className="relative group flex flex-col items-center gap-3"
                  >
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl border-2 transition-all group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, hsl(260, 25%, 12%), hsl(260, 30%, 8%))',
                        borderColor: 'hsl(180, 100%, 50%)',
                        boxShadow: '0 0 25px hsla(180, 100%, 50%, 0.3), 0 0 50px hsla(180, 100%, 50%, 0.1)',
                        color: 'hsl(180, 100%, 50%)'
                      }}
                    >
                      <span className="font-mono tracking-wider">H</span>
                      <div
                        className="absolute inset-0 rounded-full border border-[hsl(180,60%,30%)] opacity-30"
                        style={{ background: 'radial-gradient(circle at 30% 30%, hsla(180,100%,50%,0.1), transparent)' }}
                      />
                    </div>
                    <span className="text-sm font-bold tracking-wider text-[hsl(180,100%,50%)] uppercase">Heads</span>
                  </button>

                  <div className="text-lg font-bold text-[hsl(180,50%,45%)]">OR</div>

                  {/* Tails */}
                  <button
                    onClick={() => confirmSide('T')}
                    className="relative group flex flex-col items-center gap-3"
                  >
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl border-2 transition-all group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, hsl(260, 25%, 12%), hsl(260, 30%, 8%))',
                        borderColor: 'hsl(300, 80%, 50%)',
                        boxShadow: '0 0 25px hsla(300, 80%, 50%, 0.3), 0 0 50px hsla(300, 80%, 50%, 0.1)',
                        color: 'hsl(300, 80%, 50%)'
                      }}
                    >
                      <span className="font-mono tracking-wider">T</span>
                      <div
                        className="absolute inset-0 rounded-full border border-[hsl(300,60%,30%)] opacity-30"
                        style={{ background: 'radial-gradient(circle at 30% 30%, hsla(300,80%,50%,0.1), transparent)' }}
                      />
                    </div>
                    <span className="text-sm font-bold tracking-wider text-[hsl(300,80%,50%)] uppercase">Tails</span>
                  </button>
                </div>

                {/* Fair mechanism explanation */}
                <div
                  className="rounded-lg p-3 border border-[hsl(180,60%,30%)] max-w-sm mx-auto"
                  style={{ background: 'hsla(260, 25%, 9%, 0.8)' }}
                >
                  <div className="flex items-start gap-2">
                    <RiShieldCheckLine className="w-4 h-4 text-[hsl(120,80%,50%)] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-[hsl(120,80%,50%)] mb-0.5">Provably Fair</div>
                      <p className="text-[10px] text-[hsl(180,50%,45%)] leading-relaxed">
                        You choose your side. Your opponent automatically gets the opposite.
                        The coin flip uses an independent random seed — neither player has an advantage.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Wager reminder */}
                <div className="flex items-center gap-2 text-xs text-[hsl(180,50%,45%)]">
                  <RiCoinLine className="w-3.5 h-3.5 text-[hsl(60,100%,50%)]" />
                  Wager: <span className="font-bold text-[hsl(60,100%,50%)]">{selectedWager ?? customWager} SOL</span>
                </div>

                <button
                  onClick={cancelFromPickSide}
                  className="px-6 py-2 rounded-full border border-[hsl(180,60%,30%)] text-[hsl(180,50%,45%)] text-sm font-medium hover:bg-[hsl(260,20%,15%)] transition-colors"
                >
                  <RiArrowLeftLine className="w-4 h-4 inline mr-1" />
                  Back to Wager
                </button>
              </div>
            )}

            {/* ===== MATCHMAKING ===== */}
            {gamePhase === 'matchmaking' && (
              <div className="px-4 pt-16 pb-4 flex flex-col items-center justify-center min-h-[80vh] space-y-8" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <RadarAnimation />
                <div className="text-center">
                  <h2 className="text-lg font-bold text-[hsl(180,100%,70%)] tracking-wider mb-1">Searching for opponent...</h2>
                  <p className="text-xs text-[hsl(180,50%,45%)]">Wager: {selectedWager ?? customWager} SOL</p>
                  <p className="text-[10px] text-[hsl(180,50%,45%)] mt-1">Your side: <span className="font-bold text-[hsl(180,100%,50%)]">{playerSide === 'H' ? 'HEADS' : 'TAILS'}</span></p>
                </div>
                {/* Pool stats during search */}
                <div className="flex items-center gap-4 text-[10px] text-[hsl(180,50%,45%)]">
                  <span className="flex items-center gap-1"><RiGameLine className="w-3 h-3" /> {getTotalActiveGames(poolStats)} active games</span>
                  <span className="flex items-center gap-1"><RiWallet3Line className="w-3 h-3" /> {getTotalOnline(poolStats)} online</span>
                </div>
                <button
                  onClick={cancelMatchmaking}
                  className="px-6 py-2 rounded-full border border-[hsl(0,100%,55%)] text-[hsl(0,100%,55%)] text-sm font-medium hover:bg-[hsla(0,100%,55%,0.1)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ===== WAITING LOBBY ===== */}
            {gamePhase === 'waiting' && (
              <div className="px-4 pt-8 pb-4 flex flex-col items-center justify-center min-h-[80vh] space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="text-center mb-2">
                  <h2 className="text-lg font-bold text-[hsl(180,100%,70%)] tracking-wider mb-1">Waiting for Challenger</h2>
                  <p className="text-xs text-[hsl(180,50%,45%)]">Wager: {selectedWager ?? customWager} SOL</p>
                </div>

                {/* Player cards */}
                <div className="flex items-center justify-between w-full max-w-sm">
                  {/* You */}
                  <div
                    className="rounded-lg p-4 w-[42%] text-center border border-[hsl(180,100%,50%)]"
                    style={{
                      background: 'hsla(180, 100%, 50%, 0.05)',
                      boxShadow: '0 0 20px hsla(180, 100%, 50%, 0.2)'
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[hsl(180,50%,45%)] mb-1">You</div>
                    <div className="text-xs font-mono text-[hsl(180,100%,70%)]">{truncateAddress(walletAddress)}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-[hsla(180,100%,50%,0.2)] text-[hsl(180,100%,50%)]">
                      {playerSide === 'H' ? 'HEADS' : 'TAILS'}
                    </div>
                    <div className="mt-1">
                      <RiCheckLine className="w-4 h-4 text-[hsl(120,80%,50%)] mx-auto" />
                    </div>
                  </div>

                  <div className="text-xl font-bold text-[hsl(300,80%,50%)]">VS</div>

                  {/* Opponent slot */}
                  <div
                    className="rounded-lg p-4 w-[42%] text-center border transition-all"
                    style={{
                      background: opponentFound ? 'hsla(300, 80%, 50%, 0.05)' : 'hsla(260, 25%, 9%, 0.8)',
                      borderColor: opponentFound ? 'hsl(300, 80%, 50%)' : 'hsl(180, 60%, 30%)',
                      boxShadow: opponentFound ? '0 0 20px hsla(300, 80%, 50%, 0.3)' : 'none',
                      animation: opponentFound ? 'fadeIn 0.5s ease-out' : 'none'
                    }}
                  >
                    {opponentFound ? (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-[hsl(180,50%,45%)] mb-1">Opponent</div>
                        <div className="text-xs font-mono text-[hsl(180,100%,70%)]">{truncateAddress(currentOpponent)}</div>
                        <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-[hsla(300,80%,50%,0.2)] text-[hsl(300,80%,50%)]">
                          {playerSide === 'H' ? 'TAILS' : 'HEADS'}
                        </div>
                        <div className="mt-1">
                          <RiCheckLine className="w-4 h-4 text-[hsl(120,80%,50%)] mx-auto" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] uppercase tracking-wider text-[hsl(180,50%,45%)] mb-1">Opponent</div>
                        <div className="w-16 h-3 mx-auto rounded bg-[hsl(260,20%,18%)] mb-2" style={{ animation: 'dotPulse 1.4s ease-in-out infinite' }} />
                        <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-[hsla(180,50%,45%,0.1)] text-[hsl(180,50%,45%)]">
                          {playerSide === 'H' ? 'TAILS' : 'HEADS'}
                        </div>
                        <div className="mt-1">
                          <RiLoader4Line className="w-4 h-4 text-[hsl(180,50%,45%)] mx-auto animate-spin" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center gap-2 text-sm">
                  <RiTimeLine className="w-4 h-4 text-[hsl(180,100%,50%)]" />
                  <span className="font-mono text-[hsl(180,100%,70%)]">
                    {String(Math.floor(waitingElapsed / 60)).padStart(2, '0')}:{String(waitingElapsed % 60).padStart(2, '0')}
                  </span>
                </div>

                {/* Status message */}
                {opponentFound ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsla(120,80%,40%,0.15)] border border-[hsl(120,80%,50%)]" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <RiCheckLine className="w-4 h-4 text-[hsl(120,80%,50%)]" />
                    <span className="text-sm font-bold text-[hsl(120,80%,50%)]">Opponent found! Starting duel...</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <LoadingDots />
                    </div>
                    <p className="text-xs text-[hsl(180,50%,45%)]">Waiting for a {selectedWager ?? customWager} SOL challenger...</p>
                  </div>
                )}

                {/* Queue stats */}
                <div
                  className="rounded-lg p-3 border border-[hsl(180,60%,30%)] w-full max-w-sm"
                  style={{ background: 'hsla(260, 25%, 9%, 0.8)' }}
                >
                  <div className="text-[10px] uppercase tracking-widest text-[hsl(180,50%,45%)] mb-2 font-bold">Live Queue</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-[hsl(180,100%,50%)]">
                        {poolStats.find(p => p.tier === (selectedWager ?? parseFloat(customWager)))?.queueCount ?? Math.floor(Math.random() * 8) + 1}
                      </div>
                      <div className="text-[10px] text-[hsl(180,50%,45%)]">In Queue</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[hsl(60,100%,50%)]">{getTotalActiveGames(poolStats)}</div>
                      <div className="text-[10px] text-[hsl(180,50%,45%)]">Active Games</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[hsl(300,80%,50%)]">{getTotalOnline(poolStats)}</div>
                      <div className="text-[10px] text-[hsl(180,50%,45%)]">Online</div>
                    </div>
                  </div>
                </div>

                {/* Cancel */}
                {!opponentFound && (
                  <button
                    onClick={cancelMatchmaking}
                    className="px-6 py-2 rounded-full border border-[hsl(0,100%,55%)] text-[hsl(0,100%,55%)] text-sm font-medium hover:bg-[hsla(0,100%,55%,0.1)] transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* ===== DUEL ARENA ===== */}
            {gamePhase === 'duel' && (
              <div className="px-4 pt-8 pb-4 min-h-[80vh] flex flex-col items-center justify-center relative" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {showConfetti && <ConfettiParticles />}

                {/* Wager */}
                <div className="text-center mb-8">
                  <div className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-widest mb-1">Wager</div>
                  <div className="text-2xl font-bold text-[hsl(60,100%,50%)]">{selectedWager ?? customWager} SOL</div>
                </div>

                {/* Players */}
                <div className="flex items-center justify-between w-full mb-8">
                  {/* You */}
                  <div
                    className="rounded-lg p-3 w-[42%] text-center border transition-all"
                    style={{
                      background: duelResult === 'win' ? 'hsla(120, 80%, 30%, 0.15)' : 'hsla(260, 25%, 9%, 0.8)',
                      borderColor: duelResult === 'win' ? 'hsl(120, 80%, 50%)' : 'hsl(180, 60%, 30%)',
                      boxShadow: duelResult === 'win' ? '0 0 20px hsla(120, 80%, 50%, 0.3)' : 'none'
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[hsl(180,50%,45%)] mb-1">You</div>
                    <div className="text-xs font-mono text-[hsl(180,100%,70%)]">{truncateAddress(walletAddress)}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-[hsla(180,100%,50%,0.2)] text-[hsl(180,100%,50%)]">
                      {playerSide === 'H' ? 'HEADS' : 'TAILS'}
                    </div>
                  </div>

                  <div className="text-xl font-bold text-[hsl(300,80%,50%)]">VS</div>

                  {/* Opponent */}
                  <div
                    className="rounded-lg p-3 w-[42%] text-center border transition-all"
                    style={{
                      background: duelResult === 'loss' ? 'hsla(0, 100%, 55%, 0.1)' : 'hsla(260, 25%, 9%, 0.8)',
                      borderColor: duelResult === 'loss' ? 'hsl(0, 100%, 55%)' : 'hsl(180, 60%, 30%)',
                      boxShadow: duelResult === 'loss' ? '0 0 20px hsla(0, 100%, 55%, 0.3)' : 'none'
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[hsl(180,50%,45%)] mb-1">Opponent</div>
                    <div className="text-xs font-mono text-[hsl(180,100%,70%)]">{truncateAddress(currentOpponent)}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-bold bg-[hsla(300,80%,50%,0.2)] text-[hsl(300,80%,50%)]">
                      {playerSide === 'H' ? 'TAILS' : 'HEADS'}
                    </div>
                  </div>
                </div>

                {/* Coin */}
                <CoinFlipAnimation flipping={coinFlipping} result={coinResult} />

                {/* Result Text */}
                {duelResult && (
                  <div className="mt-6 text-center" style={{ animation: 'countUp 0.5s ease-out' }}>
                    <div className={`text-3xl font-bold mb-1 ${duelResult === 'win' ? 'text-[hsl(120,80%,50%)]' : 'text-[hsl(0,100%,55%)]'}`}>
                      {duelResult === 'win' ? 'YOU WIN!' : 'YOU LOSE'}
                    </div>
                    {duelResult === 'win' && (
                      <div className="text-lg text-[hsl(60,100%,50%)]">
                        +{((selectedWager ?? parseFloat(customWager)) * 2 * (1 - PLATFORM_FEE)).toFixed(2)} SOL
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== POST-DUEL RESULT ===== */}
            {gamePhase === 'result' && lastDuelRecord && (
              <div className="px-4 pt-6 pb-4 space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* Result Card */}
                <div
                  className="rounded-lg p-5 border text-center"
                  style={{
                    background: 'hsla(260, 25%, 9%, 0.8)',
                    borderColor: lastDuelRecord.result === 'win' ? 'hsl(120, 80%, 50%)' : 'hsl(0, 100%, 55%)',
                    boxShadow: lastDuelRecord.result === 'win'
                      ? '0 0 30px hsla(120, 80%, 50%, 0.2)'
                      : '0 0 30px hsla(0, 100%, 55%, 0.2)',
                    backdropFilter: 'blur(12px)'
                  }}
                >
                  <div className={`inline-block px-3 py-1 rounded text-sm font-bold mb-3 ${lastDuelRecord.result === 'win' ? 'bg-[hsla(120,80%,40%,0.2)] text-[hsl(120,80%,50%)]' : 'bg-[hsla(0,100%,55%,0.2)] text-[hsl(0,100%,55%)]'}`}>
                    {lastDuelRecord.result === 'win' ? 'VICTORY' : 'DEFEAT'}
                  </div>
                  {lastDuelRecord.result === 'win' && (
                    <div className="text-3xl font-bold text-[hsl(60,100%,50%)] mb-2" style={{ animation: 'countUp 0.5s ease-out' }}>
                      +{lastDuelRecord.payout.toFixed(2)} SOL
                    </div>
                  )}
                  <div className="text-xs text-[hsl(180,50%,45%)] space-y-1">
                    <div>vs <span className="font-mono">{truncateAddress(lastDuelRecord.opponent)}</span></div>
                    <div>Wager: {lastDuelRecord.wager} SOL</div>
                    <div className="font-mono text-[10px]">{lastDuelRecord.duelId}</div>
                  </div>
                </div>

                {/* Match Insight */}
                <button
                  onClick={() => openAgentPanel('insight')}
                  className="w-full py-2.5 rounded-lg border border-[hsl(60,100%,50%)] flex items-center justify-center gap-2 text-sm font-medium transition-all hover:bg-[hsla(60,100%,50%,0.1)]"
                  style={{ color: 'hsl(60, 100%, 50%)', boxShadow: '0 0 15px hsla(60, 100%, 50%, 0.15)' }}
                >
                  <RiLightbulbLine className="w-4 h-4" /> Match Insight
                </button>

                {/* Share */}
                {agentResponse?.share_text && (
                  <button
                    onClick={() => copyShareText(String(agentResponse?.share_text ?? ''))}
                    className="w-full py-2.5 rounded-lg border border-[hsl(180,60%,30%)] flex items-center justify-center gap-2 text-sm font-medium text-[hsl(180,100%,50%)] transition-all hover:bg-[hsl(260,20%,15%)]"
                  >
                    {copied ? <RiCheckLine className="w-4 h-4" /> : <RiShareLine className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Share Result'}
                  </button>
                )}

                {/* Play Again */}
                <button
                  onClick={playAgain}
                  className="w-full py-3.5 rounded-lg font-bold text-base tracking-wider flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'hsl(180, 100%, 50%)',
                    color: 'hsl(260, 30%, 6%)',
                    boxShadow: '0 0 20px hsla(180, 100%, 50%, 0.3)'
                  }}
                >
                  <RiSwordLine className="w-5 h-5" /> Play Again
                </button>

                <button
                  onClick={() => { setActiveTab('dashboard'); setGamePhase('connected'); closeAgentPanel() }}
                  className="w-full py-2 text-center text-xs text-[hsl(180,50%,45%)] hover:text-[hsl(180,100%,50%)] transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            )}

            {/* ===== PLAY TAB (connected, no wager selected) ===== */}
            {activeTab === 'play' && gamePhase === 'connected' && (
              <div className="px-4 pt-8 pb-4 flex flex-col items-center justify-center min-h-[70vh] space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <CoinFlipAnimation flipping={false} result={null} />
                <div className="text-center">
                  <h2 className="text-xl font-bold text-[hsl(180,100%,70%)] tracking-wider mb-2">Ready to Duel?</h2>
                  <p className="text-sm text-[hsl(180,50%,45%)]">Pick your wager and find an opponent</p>
                </div>
                <button
                  onClick={() => setGamePhase('wager')}
                  className="px-8 py-3.5 rounded-full font-bold text-base tracking-wider flex items-center gap-2 transition-all"
                  style={{
                    background: 'hsl(180, 100%, 50%)',
                    color: 'hsl(260, 30%, 6%)',
                    animation: 'pulseGlow 2s ease-in-out infinite'
                  }}
                >
                  <RiSwordLine className="w-5 h-5" /> Start Duel
                </button>
              </div>
            )}

            {/* ===== HISTORY TAB ===== */}
            {activeTab === 'history' && gamePhase !== 'wager' && gamePhase !== 'pickside' && gamePhase !== 'matchmaking' && gamePhase !== 'waiting' && gamePhase !== 'duel' && gamePhase !== 'result' && (
              <div className="px-4 pt-4 pb-4 space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h2 className="text-lg font-bold text-[hsl(180,100%,70%)] tracking-wider">Duel History</h2>

                {/* Filter chips */}
                <div className="flex gap-2">
                  {(['all', 'wins', 'losses'] as HistoryFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f)}
                      className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                      style={{
                        background: historyFilter === f ? 'hsl(180, 100%, 50%)' : 'hsla(260, 20%, 15%, 0.8)',
                        color: historyFilter === f ? 'hsl(260, 30%, 6%)' : 'hsl(180, 50%, 45%)',
                        borderWidth: '1px',
                        borderColor: historyFilter === f ? 'hsl(180, 100%, 50%)' : 'hsl(180, 60%, 30%)'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Duel list */}
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-10 rounded-lg border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(260,25%,9%,0.5)' }}>
                    <RiHistoryLine className="w-8 h-8 mx-auto mb-2 text-[hsl(180,50%,45%)]" />
                    <p className="text-sm text-[hsl(180,50%,45%)]">No duels found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                    {filteredHistory.map((duel) => (
                      <div key={duel.id}>
                        <button
                          onClick={() => setExpandedDuel(expandedDuel === duel.id ? null : duel.id)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-[hsl(180,60%,30%)] transition-colors hover:bg-[hsl(260,20%,15%)] text-left"
                          style={{ background: expandedDuel === duel.id ? 'hsla(260,20%,15%,0.8)' : 'hsla(260,25%,9%,0.6)' }}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${duel.result === 'win' ? 'bg-[hsla(120,80%,40%,0.2)] text-[hsl(120,80%,50%)]' : 'bg-[hsla(0,100%,55%,0.2)] text-[hsl(0,100%,55%)]'}`}>
                              {duel.result === 'win' ? 'W' : 'L'}
                            </span>
                            <div>
                              <div className="text-xs font-mono text-[hsl(180,50%,45%)]">vs {truncateAddress(duel.opponent)}</div>
                              <div className="text-[10px] text-[hsl(180,50%,45%)]">{formatDate(duel.date)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-[hsl(180,100%,70%)]">{duel.wager} SOL</div>
                            {duel.result === 'win' && (
                              <div className="text-[10px] text-[hsl(120,80%,50%)]">+{duel.payout.toFixed(2)}</div>
                            )}
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {expandedDuel === duel.id && (
                          <div className="mt-1 p-3 rounded-lg border border-[hsl(180,60%,30%)] space-y-2" style={{ background: 'hsla(260,20%,15%,0.6)', animation: 'fadeIn 0.2s ease-out' }}>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[hsl(180,50%,45%)]">Duel ID:</span>
                                <div className="font-mono text-[hsl(180,100%,70%)] text-[10px]">{duel.duelId}</div>
                              </div>
                              <div>
                                <span className="text-[hsl(180,50%,45%)]">Payout:</span>
                                <div className="font-bold text-[hsl(180,100%,70%)]">{duel.payout.toFixed(2)} SOL</div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedDuelForFairness(duel)
                                setTimeout(() => openAgentPanel('fairness'), 50)
                              }}
                              className="w-full py-2 rounded border border-[hsl(180,60%,30%)] flex items-center justify-center gap-2 text-xs font-medium text-[hsl(180,100%,50%)] hover:bg-[hsl(260,20%,15%)] transition-colors"
                            >
                              <RiShieldCheckLine className="w-3.5 h-3.5" /> Verify Fairness
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== WALLET TAB ===== */}
            {activeTab === 'wallet' && gamePhase !== 'wager' && gamePhase !== 'pickside' && gamePhase !== 'matchmaking' && gamePhase !== 'waiting' && gamePhase !== 'duel' && gamePhase !== 'result' && (
              <div className="px-4 pt-4 pb-4 space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* Balance Hero */}
                <div
                  className="rounded-lg p-5 border border-[hsl(180,60%,30%)] text-center"
                  style={{
                    background: 'hsla(260, 25%, 9%, 0.8)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 0 20px hsla(180, 100%, 50%, 0.15)'
                  }}
                >
                  <div className="text-xs text-[hsl(180,50%,45%)] uppercase tracking-wider mb-1">Wallet Balance</div>
                  <div className="text-4xl font-bold text-[hsl(180,100%,50%)] mb-0.5">{balance.toFixed(2)} SOL</div>
                  <div className="text-sm text-[hsl(180,50%,45%)]">~ ${(balance * 150).toFixed(2)} USD</div>
                </div>

                {/* Deposit / Withdraw */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setWalletShowDeposit(!walletShowDeposit); setWalletShowWithdraw(false) }}
                    className="py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: walletShowDeposit ? 'hsl(180, 100%, 50%)' : 'hsla(260, 25%, 9%, 0.8)',
                      color: walletShowDeposit ? 'hsl(260, 30%, 6%)' : 'hsl(180, 100%, 50%)',
                      border: '1px solid hsl(180, 60%, 30%)'
                    }}
                  >
                    <RiArrowDownLine className="w-4 h-4" /> Deposit
                  </button>
                  <button
                    onClick={() => { setWalletShowWithdraw(!walletShowWithdraw); setWalletShowDeposit(false) }}
                    className="py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: walletShowWithdraw ? 'hsl(300, 80%, 50%)' : 'hsla(260, 25%, 9%, 0.8)',
                      color: walletShowWithdraw ? 'white' : 'hsl(300, 80%, 50%)',
                      border: '1px solid hsl(180, 60%, 30%)'
                    }}
                  >
                    <RiArrowUpLine className="w-4 h-4" /> Withdraw
                  </button>
                </div>

                {/* Deposit Input */}
                {walletShowDeposit && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-[hsl(180,100%,50%)]" style={{ background: 'hsla(260,25%,9%,0.8)', animation: 'fadeIn 0.2s ease-out' }}>
                    <input
                      type="number"
                      value={walletDepositAmount}
                      onChange={(e) => setWalletDepositAmount(e.target.value)}
                      placeholder="Amount in SOL"
                      step="0.1"
                      min="0"
                      className="flex-1 bg-[hsl(260,20%,18%)] border border-[hsl(180,60%,30%)] rounded px-3 py-2 text-sm text-[hsl(180,100%,70%)] placeholder:text-[hsl(180,50%,45%)] outline-none"
                    />
                    <button
                      onClick={() => handleDeposit(walletDepositAmount, setWalletDepositAmount, setWalletShowDeposit)}
                      className="px-4 py-2 rounded font-bold text-sm bg-[hsl(180,100%,50%)] text-[hsl(260,30%,6%)]"
                    >
                      Confirm
                    </button>
                  </div>
                )}

                {/* Withdraw Input */}
                {walletShowWithdraw && (
                  <div className="space-y-2 p-3 rounded-lg border border-[hsl(300,80%,50%)]" style={{ background: 'hsla(260,25%,9%,0.8)', animation: 'fadeIn 0.2s ease-out' }}>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={walletWithdrawAmount}
                        onChange={(e) => setWalletWithdrawAmount(e.target.value)}
                        placeholder="Amount in SOL"
                        step="0.1"
                        min="0"
                        max={balance.toString()}
                        className="flex-1 bg-[hsl(260,20%,18%)] border border-[hsl(180,60%,30%)] rounded px-3 py-2 text-sm text-[hsl(180,100%,70%)] placeholder:text-[hsl(180,50%,45%)] outline-none"
                      />
                      <button
                        onClick={() => handleWithdraw(walletWithdrawAmount, setWalletWithdrawAmount, setWalletShowWithdraw)}
                        className="px-4 py-2 rounded font-bold text-sm bg-[hsl(300,80%,50%)] text-white"
                      >
                        Confirm
                      </button>
                    </div>
                    {walletWithdrawAmount && parseFloat(walletWithdrawAmount) > balance && (
                      <div className="flex items-center gap-1 text-xs text-[hsl(0,100%,55%)]">
                        <RiErrorWarningLine className="w-3 h-3" /> Exceeds available balance
                      </div>
                    )}
                  </div>
                )}

                {/* Transaction History */}
                <div>
                  <h3 className="text-sm font-bold text-[hsl(180,100%,70%)] mb-2 tracking-wider uppercase">Transaction History</h3>
                  {transactions.length === 0 ? (
                    <div className="text-center py-6 rounded-lg border border-[hsl(180,60%,30%)]" style={{ background: 'hsla(260,25%,9%,0.5)' }}>
                      <RiTimeLine className="w-8 h-8 mx-auto mb-2 text-[hsl(180,50%,45%)]" />
                      <p className="text-sm text-[hsl(180,50%,45%)]">No transactions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                      {transactions.map((tx) => {
                        const colorMap: Record<string, string> = {
                          deposit: 'hsl(120, 80%, 50%)',
                          withdrawal: 'hsl(0, 100%, 55%)',
                          payout: 'hsl(180, 100%, 50%)',
                          wager: 'hsl(180, 50%, 45%)'
                        }
                        const iconMap: Record<string, React.ReactNode> = {
                          deposit: <RiArrowDownLine className="w-3.5 h-3.5" />,
                          withdrawal: <RiArrowUpLine className="w-3.5 h-3.5" />,
                          payout: <RiTrophyLine className="w-3.5 h-3.5" />,
                          wager: <RiSwordLine className="w-3.5 h-3.5" />
                        }
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-2.5 rounded border border-[hsl(180,60%,30%)]"
                            style={{ background: 'hsla(260,25%,9%,0.6)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'hsla(260,20%,15%,0.8)', color: colorMap[tx.type] ?? 'hsl(180,50%,45%)' }}>
                                {iconMap[tx.type]}
                              </div>
                              <div>
                                <div className="text-xs font-medium capitalize" style={{ color: colorMap[tx.type] ?? 'hsl(180,50%,45%)' }}>{tx.type}</div>
                                <div className="text-[10px] text-[hsl(180,50%,45%)]">{formatDate(tx.date)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold" style={{ color: colorMap[tx.type] ?? 'hsl(180,100%,70%)' }}>
                                {tx.type === 'deposit' || tx.type === 'payout' ? '+' : '-'}{tx.amount.toFixed(2)} SOL
                              </div>
                              <div className="text-[10px] text-[hsl(180,50%,45%)]">
                                <span className="px-1 py-0.5 rounded bg-[hsla(120,80%,40%,0.15)] text-[hsl(120,80%,50%)]">{tx.status}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== BOTTOM TAB NAVIGATION ===== */}
            {gamePhase !== 'pickside' && gamePhase !== 'matchmaking' && gamePhase !== 'waiting' && gamePhase !== 'duel' && (
              <div
                className="fixed bottom-0 left-0 right-0 z-40 border-t border-[hsl(180,60%,30%)]"
                style={{
                  background: 'hsla(260, 25%, 9%, 0.95)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div className="max-w-lg mx-auto flex items-center justify-around py-2">
                  {([
                    { key: 'play' as TabType, icon: RiSwordLine, label: 'Play' },
                    { key: 'dashboard' as TabType, icon: RiDashboardLine, label: 'Dashboard' },
                    { key: 'history' as TabType, icon: RiHistoryLine, label: 'History' },
                    { key: 'wallet' as TabType, icon: RiWallet3Line, label: 'Wallet' }
                  ]).map((tab) => {
                    const isActive = activeTab === tab.key
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setActiveTab(tab.key)
                          if (tab.key === 'play' && gamePhase !== 'wager' && gamePhase !== 'result') {
                            setGamePhase('connected')
                          }
                          if (tab.key === 'dashboard' && gamePhase !== 'result') {
                            setGamePhase('connected')
                          }
                          if (tab.key === 'history' || tab.key === 'wallet') {
                            if (gamePhase !== 'result') setGamePhase('connected')
                          }
                        }}
                        className="flex flex-col items-center gap-0.5 px-3 py-1 transition-all"
                      >
                        <Icon
                          className="w-5 h-5 transition-all"
                          style={{
                            color: isActive ? 'hsl(180, 100%, 50%)' : 'hsl(180, 50%, 45%)',
                            filter: isActive ? 'drop-shadow(0 0 6px hsla(180, 100%, 50%, 0.5))' : 'none'
                          }}
                        />
                        <span
                          className="text-[10px] font-medium tracking-wider"
                          style={{ color: isActive ? 'hsl(180, 100%, 50%)' : 'hsl(180, 50%, 45%)' }}
                        >
                          {tab.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== AGENT PANEL OVERLAY ===== */}
        <AgentPanel
          type={agentPanelType}
          visible={showAgentPanel}
          onClose={closeAgentPanel}
          messages={walletMessages}
          loading={agentLoading}
          inputValue={agentInput}
          onInputChange={setAgentInput}
          onSend={() => callWalletAgent(agentInput)}
          agentResponse={agentResponse}
          duelDetail={selectedDuelForFairness}
        />
      </div>
    </ErrorBoundary>
  )
}
