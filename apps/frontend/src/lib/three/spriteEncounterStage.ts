import * as THREE from 'three'
import type { CombatEncounterParams, Piece3DNode } from './types.ts'
import { IndianArmiesRuntime } from './indianArmiesRuntime.ts'
import type { VisualPhase } from './visualEventQueue.ts'
import type { CameraController3D } from './cameraController.ts'
import { PieceBuilder3D } from './pieceBuilder.ts'

const NAMES: Record<string,string> = { P:'Padati',N:'Ashva Senani',B:'Acharya',R:'Durg',Q:'Samrajni',K:'Raja' }
const name = (code: string) => `${code[0] === 'w' ? 'White' : 'Black'} ${NAMES[code[1]]}`
const APPROACH_WORLD = .28
const duration = (code: string,clip: string) => {
  const def = IndianArmiesRuntime.resolveClip(code,clip)
  return def.frameDurationsMs?.reduce((sum,n) => sum+n,0) ?? def.count/def.fps*1000
}

export function resolveSpriteContact(attacker: string,defender: string) {
  const a = IndianArmiesRuntime.getPieceClipManifest(attacker)
  const b = IndianArmiesRuntime.getDefenseClipManifest(defender) ?? IndianArmiesRuntime.getPieceClipManifest(defender)
  const entries = IndianArmiesRuntime.getEncountersManifest()?.encounters ?? []
  const entry = entries.find(e => e.attacker === attacker && e.defender === defender) ??
    entries.find(e => e.attacker[1] === attacker[1] && e.defender[1] === defender[1])
  const tip = a?.clips.attack.socketsPx?.[4]?.weaponTip ?? [180,125]
  const aw = IndianArmiesRuntime.getCardPlacement(attacker[1])
  const bw = IndianArmiesRuntime.getCardPlacement(defender[1])
  // The benchmark's metadata identifies a point ON the staff, not the palm.
  const guard=b?.clips.defend.socketsPx?.at(-1)
  const block = entry?.worldContact.defenderContactPx ?? guard?.defenseContact ?? guard?.hip ?? guard?.weaponTip ?? [128,128]
  const tipLocal: [number,number] = [(tip[0]-128)*aw.width/256,(220-tip[1])*aw.height/256]
  const blockLocal: [number,number] = [(block[0]-128)*bw.width/256,(220-block[1])*bw.height/256]
  return { tip, block, tipLocal, blockLocal, separation: tipLocal[0]-blockLocal[0], calibrated: !!entry, metadata: entry }
}

interface ActorState { node: Piece3DNode; visible: boolean; position: THREE.Vector3 }

/** Event-bound stage. It draws the live node textures, never a decorative movie or flipped sprite. */
export class SpriteEncounterStage {
  public isActive = false
  public phase: VisualPhase = 'PREPARING'
  public onPhase?: (phase: VisualPhase) => void
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private backdrop: HTMLImageElement | null = null
  private actors: [ActorState,ActorState] | null = null
  private params: CombatEncounterParams | null = null
  private startTime = 0
  private scaleTime = 1
  private contact = resolveSpriteContact('wN','bB')
  private times = { anticipation:333, attack:1190, contact:1440, hit:1503, stagger:1753, defeat:2253, settlement:2920, complete:3353 }
  private firedContact = false
  private firedDefeat = false
  private owner = ''
  private finalDestination = new THREE.Vector3()
  private diagnostics: Record<string,unknown> = {}
  private effectTexture: THREE.Texture | null = null
  private defenseTexture: THREE.Texture | null = null
  private timelineOffset=0
  private holdStart=0
  private holdUntil=0
  private container: HTMLDivElement | null
  private camera: CameraController3D

  constructor(container: HTMLDivElement | null,camera: CameraController3D) {
    this.container=container;this.camera=camera
    if (container && typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas')
      this.canvas.setAttribute('aria-hidden','true')
      Object.assign(this.canvas.style,{ position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',display:'none',zIndex:'10' })
      container.appendChild(this.canvas)
      this.ctx = this.canvas.getContext('2d')
      this.backdrop = new Image()
      this.backdrop.src = '/pieces/indian-armies-v1/stage/terrace.webp'
    }
  }

  public start(attacker: Piece3DNode,defender: Piece3DNode,params: CombatEncounterParams,owner: string) {
    if (this.isActive) throw new Error('A sprite encounter already owns the stage')
    this.owner = owner
    this.params = params
    this.actors = [attacker,defender].map(node => ({node,visible:node.group.visible,position:node.group.position.clone()})) as [ActorState,ActorState]
    this.finalDestination.copy(attacker.targetPosition)
    this.defenseTexture=PieceBuilder3D.getDefenseSpriteTexture(defender.pieceCode)
    this.contact = resolveSpriteContact(attacker.pieceCode,defender.pieceCode)
    if (!this.contact.calibrated) this.alignGuardSilhouette(defender)
    const anticipation = duration(attacker.pieceCode,'attack_anticipation')
    const move = duration(attacker.pieceCode,'move')
    const attackDef = IndianArmiesRuntime.resolveClip(attacker.pieceCode,'attack')
    const contactFrame = attackDef.contactFrame ?? 4
    const attackStart = this.contact.metadata?.attackStartMs ?? anticipation+move
    const contactTime = this.contact.metadata?.contactTimeMs ?? attackStart+(attackDef.frameDurationsMs?.slice(0,contactFrame).reduce((s,n) => s+n,0) ?? contactFrame/attackDef.fps*1000)
    const hit = this.contact.metadata?.defenseHoldUntilMs ?? contactTime+1000/attackDef.fps
    const stagger = hit+duration(defender.pieceCode,'hit')
    const defeat = stagger+duration(defender.pieceCode,'stagger')
    const settlement = defeat+duration(defender.pieceCode,'defeat')
    this.times = { anticipation,attack:attackStart,contact:contactTime,hit,stagger,defeat,settlement,complete:settlement+430 }
    this.scaleTime = params.pacing === 'fast' ? .42 : params.pacing === 'reduced' ? .18 : 1
    this.startTime = performance.now()
    this.firedContact = false; this.firedDefeat = false
    this.timelineOffset=0;this.holdUntil=0
    this.isActive = true
    this.effectTexture = PieceBuilder3D.getEffectSpriteTexture(defender.pieceCode[0] as 'w'|'b')
    this.camera.acquireEncounter(owner)
    for (const {node} of this.actors) { node.group.visible = false; node.isAnimating = true }
    if (this.canvas) { this.canvas.style.display='block';this.canvas.dataset.encounter=owner }
    this.phase = 'PREPARING'
    params.onAnticipation?.()
    this.update(this.startTime)
    if (params.pacing === 'off') this.finish(true)
  }

  private pose(node: Piece3DNode,clip: string,elapsed: number) {
    const def = IndianArmiesRuntime.resolveClip(node.pieceCode,clip)
    if (node.animator?.currentClip !== clip) node.animator?.playClip(clip,false)
    let frame = 0, rest = Math.max(0,elapsed)
    const length = duration(node.pieceCode,clip)
    if (def.loop) rest %= length
    while (frame < def.count-1) {
      const ms = def.frameDurationsMs?.[frame] ?? 1000/def.fps
      if (rest+1e-6 < ms) break
      rest -= ms;frame++
    }
    node.animator?.setFrame(frame)
  }

  private alignGuardSilhouette(defender:Piece3DNode) {
    if(typeof document==='undefined')return
    const image=(this.defenseTexture ?? (defender.cardMesh?.material as THREE.MeshBasicMaterial)?.map)?.image as CanvasImageSource & {width:number;height:number} | undefined
    if(!image?.width)return
    const dimensions=IndianArmiesRuntime.getCardPlacement(defender.pieceCode[1])
    const py=220-this.contact.tipLocal[1]/dimensions.height*256
    if(py<0||py>=256){IndianArmiesRuntime.recordError(`Contact height falls outside ${defender.pieceCode}'s authored guard pose`);return}
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)return
    const clip=IndianArmiesRuntime.resolveClip(defender.pieceCode,'defend'),index=clip.start+clip.count-1
    ctx.drawImage(image,index%clip.cols*image.width/clip.cols,Math.floor(index/clip.cols)*image.height/clip.rows,image.width/clip.cols,image.height/clip.rows,0,0,256,256)
    const pixels=ctx.getImageData(0,Math.floor(py),256,1).data
    const forward=this.contact.tipLocal[0]>=0
    for(let n=0;n<256;n++) {
      const px=forward?n:255-n
      if(pixels[px*4+3]>96) {
        const block:[number,number]=[px,py]
        const blockLocal:[number,number]=[(px-128)*dimensions.width/256,this.contact.tipLocal[1]]
        this.contact={...this.contact,block,blockLocal,separation:this.contact.tipLocal[0]-blockLocal[0]}
        return
      }
    }
    IndianArmiesRuntime.recordError(`No visible ${defender.pieceCode} guard silhouette at the authored attack contact height`)
  }

  public update(now: number) {
    if (!this.isActive || !this.actors || !this.params) return
    let elapsed = (now-this.startTime)/this.scaleTime-this.timelineOffset
    if (!this.firedContact && elapsed >= this.times.contact) {
      this.timelineOffset+=elapsed-this.times.contact
      elapsed=this.times.contact
      this.holdStart=now;this.holdUntil=now+(this.params.pacing==='reduced'?0:90)
    } else if (this.holdUntil>0) {
      if (now<this.holdUntil) elapsed=this.times.contact
      else {
        this.timelineOffset+=(this.holdUntil-this.holdStart)/this.scaleTime
        this.holdUntil=0
        elapsed=(now-this.startTime)/this.scaleTime-this.timelineOffset
      }
    }
    const [a,b] = this.actors.map(actor => actor.node)
    const t = this.times
    let phase: VisualPhase
    if (elapsed < t.anticipation) phase='PREPARING'
    else if (elapsed < t.attack) phase='APPROACHING'
    else if (elapsed < t.contact) phase='CONTACT'
    else if (elapsed < t.defeat) phase='IMPACT'
    else if (elapsed < t.settlement) phase='DESTRUCTION'
    else phase='SETTLEMENT'
    if (phase !== this.phase) { this.phase=phase;this.onPhase?.(phase) }
    if (elapsed < t.anticipation) this.pose(a,'attack_anticipation',elapsed)
    else if (elapsed < t.attack) this.pose(a,'move',(elapsed-t.anticipation)*APPROACH_WORLD/IndianArmiesRuntime.getMoveStrideWorld(a.pieceCode))
    else if (elapsed < t.attack+duration(a.pieceCode,'attack')) this.pose(a,'attack',elapsed-t.attack)
    else if (elapsed < t.settlement) this.pose(a,'idle',elapsed-t.attack)
    else this.pose(a,'move',(elapsed-t.settlement)*Math.abs(this.contact.separation)/IndianArmiesRuntime.getMoveStrideWorld(a.pieceCode)*duration(a.pieceCode,'move')/430)
    if (elapsed < t.hit) this.pose(b,'defend',elapsed)
    else if (elapsed < t.stagger) this.pose(b,'hit',elapsed-t.hit)
    else if (elapsed < t.defeat) this.pose(b,'stagger',elapsed-t.stagger)
    else this.pose(b,'defeat',elapsed-t.defeat)
    if (elapsed >= t.contact && !this.firedContact) { this.firedContact=true;this.params.onContact?.() }
    if (elapsed >= t.defeat && !this.firedDefeat) { this.firedDefeat=true;this.params.onDefeat?.() }
    this.draw(elapsed)
    if (elapsed >= t.complete) this.finish()
  }

  private draw(elapsed: number) {
    const ctx=this.ctx,canvas=this.canvas,actors=this.actors
    if (!ctx || !canvas || !actors || !this.container) return
    const rect=this.container.getBoundingClientRect()
    const w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(window.devicePixelRatio,2)
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) { canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr) }
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.clearRect(0,0,w,h)
    const background=ctx.createLinearGradient(0,0,0,h)
    background.addColorStop(0,'rgba(12,20,19,.98)');background.addColorStop(.75,'rgba(39,42,31,.98)');background.addColorStop(1,'rgba(18,24,22,.98)')
    ctx.fillStyle=background;ctx.fillRect(0,0,w,h)
    if (this.backdrop?.complete && this.backdrop.naturalWidth) {
      // A fixed painted camera, never an orbit around the authored illustrations.
      // Cover-cropping retains the open central terrace on narrow viewports.
      const fit=Math.max(w/this.backdrop.naturalWidth,h/this.backdrop.naturalHeight)
      const bw=this.backdrop.naturalWidth*fit,bh=this.backdrop.naturalHeight*fit
      ctx.drawImage(this.backdrop,(w-bw)/2,(h-bh)/2,bw,bh)
      const shade=ctx.createLinearGradient(0,0,0,h)
      shade.addColorStop(0,'rgba(6,13,16,.8)');shade.addColorStop(.28,'rgba(6,13,16,.28)');shade.addColorStop(.7,'rgba(6,13,16,.1)');shade.addColorStop(1,'rgba(6,13,16,.45)')
      ctx.fillStyle=shade;ctx.fillRect(0,0,w,h)
    }
    const [a,b]=actors.map(actor => actor.node)
    const ad=IndianArmiesRuntime.getCardPlacement(a.pieceCode[1]),bd=IndianArmiesRuntime.getCardPlacement(b.pieceCode[1])
    const sep=this.contact.separation
    const approach=Math.max(0,Math.min(1,(elapsed-this.times.anticipation)/(this.times.attack-this.times.anticipation)))
    const settle=Math.max(0,Math.min(1,(elapsed-this.times.settlement)/430))
    const charge=Math.sign(sep || 1)*APPROACH_WORLD
    const ax=-sep-charge*(1-approach)+sep*settle
    // Fit the whole movement path once. Reframing around the current pose made
    // the actors grow during approach and shrink again during settlement.
    const startX=-sep-charge
    const left=Math.min(startX-ad.width*.5,-sep-ad.width*.5,-ad.width*.5,-bd.width*.5)
    const right=Math.max(startX+ad.width*.5,-sep+ad.width*.5,ad.width*.5,bd.width*.5)
    const scale=Math.min(w*.90/(right-left),h*.80/Math.max(ad.height,bd.height))
    const center=w/2-(left+right)*.5*scale
    const floor=h*.80
    const glow=ctx.createRadialGradient(w*.5,floor,5,w*.5,floor,w*.65)
    glow.addColorStop(0,'rgba(183,147,88,.22)');glow.addColorStop(1,'rgba(183,147,88,0)')
    ctx.fillStyle=glow;ctx.fillRect(0,h*.3,w,h*.7)
    const bounds: number[][]=[]
    const paint=(node: Piece3DNode,x: number,width: number,height: number) => {
      const clip=IndianArmiesRuntime.resolveClip(node.pieceCode,node.animator?.currentClip ?? 'idle')
      const index=clip.start+Math.min(clip.count-1,node.animator?.currentFrame ?? 0)
      const texture=node===b && this.defenseTexture ? this.defenseTexture : (node.cardMesh?.material as THREE.MeshBasicMaterial | undefined)?.map
      const image=texture?.image as CanvasImageSource & { width: number; height: number } | undefined
      const px=center+x*scale,drawW=width*scale,drawH=height*scale
      const x0=px-drawW*.5,y0=floor-drawH*220/256
      bounds.push([x0,y0,x0+drawW,y0+drawH])
      ctx.save();ctx.translate(px,floor+2);ctx.scale(drawW*(node.pieceCode[1]==='N'?.28:.20),Math.max(2,drawW*.048))
      const shadow=ctx.createRadialGradient(0,0,0,0,0,1)
      shadow.addColorStop(0,'rgba(16,10,6,.56)');shadow.addColorStop(.45,'rgba(16,10,6,.28)');shadow.addColorStop(1,'rgba(16,10,6,0)')
      ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore()
      if (image?.width && image.height) ctx.drawImage(image,(index%clip.cols)*image.width/clip.cols,Math.floor(index/clip.cols)*image.height/clip.rows,image.width/clip.cols,image.height/clip.rows,x0,y0,drawW,drawH)
    }
    paint(a,ax,ad.width,ad.height)
    if (elapsed < this.times.settlement) paint(b,0,bd.width,bd.height)
    const impactAge=elapsed-this.times.contact
    const point=[center+(-sep+this.contact.tipLocal[0])*scale,floor-this.contact.tipLocal[1]*scale]
    if (impactAge>=0 && impactAge<160 && this.params?.pacing!=='reduced') {
      const radius=scale*.15,flash=ctx.createRadialGradient(point[0],point[1],0,point[0],point[1],radius)
      flash.addColorStop(0,`rgba(255,239,193,${.7*(1-impactAge/160)})`);flash.addColorStop(.25,'rgba(238,178,83,.24)');flash.addColorStop(1,'rgba(238,178,83,0)')
      ctx.fillStyle=flash;ctx.fillRect(point[0]-radius,point[1]-radius,radius*2,radius*2)
    }
    if (impactAge >= 0 && impactAge < 667 && this.params?.pacing !== 'reduced') {
      // One event-owned burst, using the existing authored faction effect atlas.
      const effect=IndianArmiesRuntime.getEffectSpriteDef(b.pieceCode[0] as 'w'|'b')
      const image=this.effectTexture?.image as (CanvasImageSource & {width:number;height:number}) | undefined
      const index=Math.min(effect.count-1,Math.floor(impactAge*effect.fps/1000))
      if (image?.width) {
        ctx.save();ctx.globalAlpha=Math.min(1,(667-impactAge)/140)
        const size=scale*.52
        ctx.drawImage(image,index%effect.cols*image.width/effect.cols,Math.floor(index/effect.cols)*image.height/effect.rows,image.width/effect.cols,image.height/effect.rows,point[0]-size/2,point[1]-size/2,size,size)
        ctx.restore()
      }
    }
    if (elapsed >= this.times.settlement && this.params?.pacing !== 'reduced') {
      ctx.save();ctx.globalAlpha=1-settle
      for (let i=0;i<5;i++) { ctx.fillStyle=b.pieceCode[0]==='w'?'#cbb887':'#8b7052';ctx.fillRect(center+(i-2)*9,floor-2+(i%2)*4,4+i%2,3) }
      ctx.restore()
    }
    ctx.textAlign='center';ctx.fillStyle='#d9b878';ctx.font=`600 ${Math.max(10,w*.019)}px Georgia, serif`;ctx.fillText('ANCIENT INDIAN WAR CHESS',w/2,h*.075)
    ctx.fillStyle='#f2e7d0';ctx.font=`${Math.max(11,w*.025)}px Georgia, serif`;ctx.fillText(`${name(a.pieceCode)}  ·  ${name(b.pieceCode)}`,w/2,h*.123)
    ctx.fillStyle='#b5b5a1';ctx.font='12px Georgia, serif';ctx.fillText(`${this.params?.attackerSquare}  →  ${this.params?.destinationSquare ?? this.params?.defenderSquare}`,w/2,h*.94)
    this.diagnostics={owner:this.owner,phase:this.phase,elapsed,scale,actorIds:actors.map(actor=>actor.node.instanceId),bounds,viewport:[w,h],contactPoint:point,contactErrorPx:Math.abs(this.contact.tipLocal[1]-this.contact.blockLocal[1])*scale,calibratedContact:this.contact.calibrated,defenderView:this.defenseTexture?'authored-left':'main',effectsOwner:this.firedContact?this.owner:null}
  }

  public finish(skipped=false) {
    if (!this.isActive || !this.actors) return
    const callback=this.params?.onComplete
    const [a,b]=this.actors
    a.node.group.position.copy(this.finalDestination);a.node.group.visible=true;a.node.isAnimating=false;a.node.animator?.playClip('idle',true)
    b.node.group.visible=false;b.node.isAnimating=false
    this.isActive=false
    this.effectTexture?.dispose();this.effectTexture=null
    this.defenseTexture?.dispose();this.defenseTexture=null
    this.camera.releaseEncounter(this.owner)
    if (this.canvas) this.canvas.style.display='none'
    this.actors=null;this.params=null
    this.diagnostics={...this.diagnostics,lastEncounterId:this.owner,owner:null,effectsOwner:null,phase:'COMPLETE',complete:true,skipped}
    callback?.()
  }

  public cancel() {
    if (!this.actors) return
    for (const actor of this.actors) { actor.node.group.position.copy(actor.position);actor.node.group.visible=actor.visible;actor.node.isAnimating=false;actor.node.animator?.playClip('idle',true) }
    this.camera.releaseEncounter(this.owner)
    this.effectTexture?.dispose();this.effectTexture=null
    this.defenseTexture?.dispose();this.defenseTexture=null
    this.isActive=false;this.actors=null;this.params=null
    if (this.canvas) this.canvas.style.display='none'
    this.diagnostics={}
  }
  public getSnapshot() { return this.diagnostics }
  public dispose() { this.cancel();this.canvas?.remove() }
}
