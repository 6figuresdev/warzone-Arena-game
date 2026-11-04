import { useCallback, useMemo, useRef, useState } from 'react'
import type { GameEngine } from '@/game/engine'
import type { HudState } from '@/game/types'
import { useArena } from '@/hooks/useArena'
import { startSession } from '@/lib/referee'
import type { MapId } from '@/game/maps'
import { GameView } from '@/components/GameView'
import { MenuScreen } from '@/components/MenuScreen'
import { ResultScreen, type RunResult } from '@/components/ResultScreen'
import { BriefingScreen } from '@/components/BriefingScreen'
import { StageResultScreen } from '@/components/StageResultScreen'
import { STAGES, loadCampaign, recordResult, saveCampaign, STAGE_COUNT, type CampaignSave, type StageResult } from '@/game/campaign'

type Screen = 'menu' | 'briefing' | 'playing' | 'result' | 'stage-result'

export default function App() {
  const arena = useArena()
  const engineRef = useRef<GameEngine | null>(null)
  const sessionRef = useRef<string | null>(null)
  const [screen, setScreen] = useState<Screen>('menu')
  const [hud, setHud] = useState<HudState | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ranked, setRanked] = useState(false)
  const [mapId, setMapId] = useState<MapId>('ashfall')
  const [save, setSave] = useState<CampaignSave>(loadCampaign)
  const [stage, setStage] = useState(1)
  const [stageResult, setStageResult] = useState<StageResult | null>(null)

  const events = useMemo(
    () => ({
      onHud: (s: HudState) => setHud(s),
      onEnd: (telemetry: RunResult['telemetry'], score: number) => {
        setResult({ telemetry, score, sessionId: sessionRef.current })
        setScreen('result')
      },
      onStage: (r: StageResult) => {
        setSave((prev) => {
          const next = recordResult(prev, r)
          saveCampaign(next)
          return next
        })
        setStageResult(r)
        setScreen('stage-result')
      },
    }),
    [],
  )

  const play = useCallback((sessionId: string | null) => {
    sessionRef.current = sessionId
    setRanked(sessionId !== null)
    setHud(null)
    setResult(null)
    setScreen('playing')
    engineRef.current?.begin(mapId)
  }, [mapId])

  const deployStage = useCallback(
    (n: number) => {
      setStage(n)
      setHud(null)
      setStageResult(null)
      sessionRef.current = null
      setRanked(false)
      setScreen('playing')
      engineRef.current?.beginStage(n, n > 1 ? save.loadout : null)
    },
    [save.loadout],
  )

  const playRanked = useCallback(async () => {
    if (!arena.address) return
    setStarting(true)
    setError(null)
    try {
      const session = await startSession(arena.address)
      play(session.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a ranked run.')
    } finally {
      setStarting(false)
    }
  }, [arena.address, play])

  const replay = useCallback(() => {
    if (ranked) void playRanked()
    else play(null)
  }, [ranked, play, playRanked])

  const toMenu = useCallback(() => {
    sessionRef.current = null
    setScreen('menu')
    setResult(null)
    arena.refresh()
  }, [arena])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg)]">
      <GameView
        events={events}
        onReady={(e) => {
          engineRef.current = e
        }}
        playing={screen === 'playing'}
        hud={hud}
        onResume={() => engineRef.current?.resume()}
      />
      {screen === 'menu' && (
        <MenuScreen arena={arena} save={save} starting={starting} error={error} onPractice={() => play(null)} onPlayRanked={() => void playRanked()}
          onStage={(n) => {
            setStage(n)
            engineRef.current?.setMap(STAGES[n - 1].map)
            setScreen('briefing')
          }}
          mapId={mapId}
          onMap={(id) => {
            setMapId(id)
            engineRef.current?.setMap(id)
          }}
        />
      )}
      {screen === 'briefing' && <BriefingScreen stage={stage} onDeploy={() => deployStage(stage)} onBack={() => setScreen('menu')} />}
      {screen === 'stage-result' && stageResult && (
        <StageResultScreen
          result={stageResult}
          save={save}
          onNext={() => {
            const n = Math.min(STAGE_COUNT, stageResult.stage + 1)
            setStage(n)
            engineRef.current?.setMap(STAGES[n - 1].map)
            setScreen('briefing')
          }}
          onRetry={() => deployStage(stageResult.stage)}
          onMenu={toMenu}
        />
      )}
      {screen === 'result' && result && <ResultScreen result={result} arena={arena} onReplay={replay} onMenu={toMenu} />}
    </div>
  )
}
