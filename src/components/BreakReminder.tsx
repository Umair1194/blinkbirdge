import { Coffee, Play } from 'lucide-react'
import { GazeButton } from './GazeButton'
import { Modal } from './ui'

export function BreakReminder({ open, minutes, onRest, onContinue }: { open: boolean; minutes: number; onRest: () => void; onContinue: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onContinue}
      title="Time for a short eye break"
      description={`You’ve been typing for ${minutes} minutes. Look at something about 6 metres away for 20 seconds and blink slowly — it helps reduce eye strain.`}
    >
      <div className="grid grid-cols-2 gap-3">
        <GazeButton gazeId="break-rest" variant="primary" size="xl" icon={Coffee} onActivate={onRest} allowWhenPaused>
          Pause and rest
        </GazeButton>
        <GazeButton gazeId="break-continue" variant="secondary" size="xl" icon={Play} onActivate={onContinue} allowWhenPaused>
          Keep typing
        </GazeButton>
      </div>
    </Modal>
  )
}
