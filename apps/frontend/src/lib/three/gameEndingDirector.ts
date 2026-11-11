/**
 * 3D Cinematic Game-Ending Director
 * Authoritative specification: docs/astra/ANIMATION.md
 * 
 * Checkmate & Draw sequences:
 * - King is NEVER captured: checkmate concludes with royal bow / blade lowering
 * - Winning army performs disciplined triumph salute (weapons raised)
 * - Orbiting victory/defeat camera choreography
 * - Theme-appropriate accents (Ivory/Gold for White, Basalt/Bronze for Black)
 */

import type { Piece3DNode } from './types.ts'
import { CameraController3D } from './cameraController.ts'
import { IndianArmiesRuntime } from './indianArmiesRuntime.ts'

export type EndingOutcome = 'white_wins' | 'black_wins' | 'draw'

export class GameEndingDirector3D {
  public isActive = false
  private startTime = 0
  private outcome: EndingOutcome = 'draw'
  private durationMs = 4500
  private cameraCtrl: CameraController3D
  private banner: HTMLDivElement | null = null

  constructor(cameraCtrl: CameraController3D, container?: HTMLElement) {
    this.cameraCtrl = cameraCtrl
    if(container && typeof document!=='undefined') {
      this.banner=document.createElement('div')
      this.banner.setAttribute('role','status')
      this.banner.setAttribute('aria-live','polite')
      Object.assign(this.banner.style,{position:'absolute',top:'5%',left:'4%',right:'4%',display:'none',pointerEvents:'none',zIndex:'12',textAlign:'center',fontFamily:'Georgia, serif',fontSize:'clamp(14px, 2vw, 22px)',letterSpacing:'.12em',color:'#eed5a3',textShadow:'0 2px 12px #000',padding:'8px',background:'linear-gradient(90deg, transparent, rgba(10,15,16,.7), transparent)'})
      container.appendChild(this.banner)
    }
  }

  /**
   * Starts game-ending cinematic presentation using Sol's `endings.json` clips
   * (`victory`, `defeat_acknowledgement`, `draw_disengagement`).
   */
  public triggerEnding(
    outcome: EndingOutcome,
    pieceNodes: Map<string, Piece3DNode>
  ) {
    this.outcome = outcome
    this.startTime = performance.now()
    this.isActive = true
    if(this.banner) {
      this.banner.textContent=outcome==='draw'?'HONOURS SHARED':outcome==='white_wins'?'WHITE PREVAILS':'BLACK PREVAILS'
      this.banner.style.display='block'
    }

    // Trigger slow camera orbit
    this.cameraCtrl.setMode('ending')

    const endingsMeta = IndianArmiesRuntime.getEndingsManifest()

    if (outcome === 'white_wins' || outcome === 'black_wins') {
      const sideMeta = outcome === 'white_wins' ? endingsMeta?.whiteVictory : endingsMeta?.blackVictory
      const winnerPrefix = outcome === 'white_wins' ? 'w' : 'b'
      const loserKingCode = sideMeta?.losingKing?.piece || (outcome === 'white_wins' ? 'bK' : 'wK')
      const losingKingClip = sideMeta?.losingKing?.clip || 'defeat_acknowledgement'

      pieceNodes.forEach((node) => {
        const is2p5d = !!node.cardMesh || node.group.name.includes('2p5D')
        if (node.pieceCode.startsWith(winnerPrefix)) {
          const entry = sideMeta?.winners?.find((w) => w.piece === node.pieceCode)
          node.animator?.playClip(entry?.clip || 'victory', false)
          if (!is2p5d && node.weaponNode) {
            node.weaponNode.rotation.x = -0.5 // Raise weapon in salute for GLB
          }
        } else if (node.pieceCode === loserKingCode) {
          // Losing King NEVER captured or removed; performs blade-lowering acknowledgement
          node.group.visible = true
          if (is2p5d) {
            // Slight dignified posture bow without sinking plinth edge into board
            node.group.rotation.x = 0
          } else {
            node.group.rotation.x = winnerPrefix === 'w' ? 0.35 : -0.35
            if (node.weaponNode) {
              node.weaponNode.rotation.x = 0.7
            }
          }
          node.animator?.playClip(is2p5d ? losingKingClip : 'defeat', false)
        } else {
          node.animator?.playClip('idle', true)
        }
      })
    } else {
      // Draw: both armies perform mutual disengagement
      pieceNodes.forEach((node) => {
        const is2p5d = !!node.cardMesh || node.group.name.includes('2p5D')
        const unitMeta = endingsMeta?.draw?.units?.find((u) => u.piece === node.pieceCode)
        node.animator?.playClip(is2p5d ? unitMeta?.clip || 'draw_disengagement' : 'draw', false)
        if (!is2p5d && node.weaponNode) {
          node.weaponNode.rotation.x = 0.2
        }
      })
    }
  }

  public update(now: number) {
    if (!this.isActive) return
    const elapsed = now - this.startTime
    if (elapsed >= this.durationMs) {
      this.isActive = false
      if(this.banner)this.banner.style.display='none'
      this.cameraCtrl.setMode('tactical')
    }
  }

  public skip(pieceNodes: Map<string, Piece3DNode>) {
    this.reset(pieceNodes)
  }

  public reset(pieceNodes: Map<string, Piece3DNode>) {
    this.isActive = false
    if(this.banner)this.banner.style.display='none'
    pieceNodes.forEach((node) => {
      const is2p5d = !!node.cardMesh || node.group.name.includes('2p5D')
      const baseYaw = is2p5d
        ? 0
        : (node.pieceCode.startsWith('b') ? Math.PI : 0)
      node.group.rotation.set(0, baseYaw, 0)
      if (node.weaponNode) node.weaponNode.rotation.set(0, 0, 0)
      node.animator?.playClip('idle', true)
    })
    this.cameraCtrl.setMode('tactical')
  }

  public dispose() { this.banner?.remove();this.banner=null }
}
