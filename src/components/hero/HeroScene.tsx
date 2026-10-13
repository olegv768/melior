import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CORE, LINKS, NODES } from './nodes'
import type { NodeId } from './nodes'

export type LabelRefs = MutableRefObject<Partial<Record<NodeId, HTMLElement | null>>>

type SceneProps = {
  active: NodeId | null
  setActive: (id: NodeId | null) => void
  labelRefs: LabelRefs
  pointer: MutableRefObject<{ x: number; y: number }>
  reduced: boolean
  compact: boolean
}

const ACCENT = new THREE.Color('#4c7dff')
const VIOLET = new THREE.Color('#9b8cff')
const posOf = (id: NodeId) =>
  new THREE.Vector3(...(id === 'core' ? CORE.pos : NODES.find((n) => n.id === id)!.pos))

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function Core({ active, setActive, reduced }: Pick<SceneProps, 'active' | 'setActive' | 'reduced'>) {
  const crystal = useRef<THREE.Mesh>(null)
  const shell = useRef<THREE.LineSegments>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const ringB = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshPhysicalMaterial>(null)

  const shellGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.32, 1)), [])
  const isActive = active === 'core'

  useFrame((state, dt) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    const spin = reduced ? 0 : dt
    if (crystal.current) {
      crystal.current.rotation.y += spin * 0.18
      crystal.current.rotation.x = Math.sin(t * 0.3) * 0.15
      const s = THREE.MathUtils.damp(crystal.current.scale.x, isActive ? 1.08 : 1, 6, dt)
      crystal.current.scale.setScalar(s)
    }
    if (shell.current) {
      shell.current.rotation.y -= spin * 0.06
      shell.current.rotation.z += spin * 0.03
    }
    if (ringA.current) ringA.current.rotation.z += spin * 0.12
    if (ringB.current) ringB.current.rotation.z -= spin * 0.08
    if (mat.current) {
      mat.current.emissiveIntensity = THREE.MathUtils.damp(
        mat.current.emissiveIntensity,
        isActive ? 0.45 : 0.1 + Math.sin(t * 1.4) * 0.03,
        5,
        dt,
      )
    }
  })

  return (
    <group>
      <mesh
        ref={crystal}
        onPointerOver={(e) => {
          e.stopPropagation()
          setActive('core')
        }}
        onPointerOut={() => setActive(null)}
      >
        <icosahedronGeometry args={[0.82, 0]} />
        <meshPhysicalMaterial
          ref={mat}
          color="#141a28"
          metalness={0.75}
          roughness={0.18}
          clearcoat={1}
          clearcoatRoughness={0.12}
          emissive={ACCENT}
          emissiveIntensity={0.1}
          flatShading
        />
      </mesh>
      <lineSegments ref={shell} geometry={shellGeo}>
        <lineBasicMaterial color="#7f9bff" transparent opacity={0.16} />
      </lineSegments>
      <mesh ref={ringA} rotation={[Math.PI / 2.3, 0.2, 0]}>
        <torusGeometry args={[1.62, 0.006, 8, 160]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.55} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.8, -0.5, 0.4]}>
        <torusGeometry args={[1.86, 0.004, 8, 160]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

function NodeMesh({
  id,
  position,
  active,
  setActive,
  index,
  reduced,
}: {
  id: NodeId
  position: [number, number, number]
  active: NodeId | null
  setActive: SceneProps['setActive']
  index: number
  reduced: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshPhysicalMaterial>(null)
  const halo = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new RoundedBoxGeometry(0.42, 0.42, 0.42, 4, 0.1), [])
  const isActive = active === id

  useFrame((state, dt) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    const spin = reduced ? 0 : dt
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t * 0.8 + index * 1.3) * 0.06
    }
    if (body.current) {
      body.current.rotation.x += spin * (0.15 + index * 0.02)
      body.current.rotation.y += spin * 0.22
      const s = THREE.MathUtils.damp(body.current.scale.x, isActive ? 1.3 : 1, 7, dt)
      body.current.scale.setScalar(s)
    }
    if (mat.current) {
      mat.current.emissiveIntensity = THREE.MathUtils.damp(mat.current.emissiveIntensity, isActive ? 0.9 : 0.12, 6, dt)
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial
      m.opacity = THREE.MathUtils.damp(m.opacity, isActive ? 0.7 : 0.18, 6, dt)
      halo.current.rotation.z += spin * 0.4
    }
  })

  return (
    <group ref={group} position={position}>
      <mesh ref={body} geometry={geo}>
        <meshPhysicalMaterial
          ref={mat}
          color="#232838"
          metalness={0.6}
          roughness={0.28}
          clearcoat={0.8}
          emissive={ACCENT}
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh ref={halo} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.42, 0.435, 64, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#8fa8ff" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {/* generous invisible hit area */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          setActive(id)
        }}
        onPointerOut={() => setActive(null)}
        onClick={(e) => {
          e.stopPropagation()
          setActive(id)
        }}
      >
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

type Flow = {
  from: NodeId
  to: NodeId
  samples: THREE.Vector3[]
  line: THREE.Line
}

function Flows({ active, reduced, compact }: Pick<SceneProps, 'active' | 'reduced' | 'compact'>) {
  const perFlow = compact ? 3 : 5

  const flows = useMemo<Flow[]>(() => {
    const pairs: [NodeId, NodeId][] = [...NODES.map((n) => [n.id, 'core'] as [NodeId, NodeId]), ...LINKS]
    return pairs.map(([from, to]) => {
      const a = posOf(from)
      const b = posOf(to)
      const mid = a.clone().lerp(b, 0.5)
      const lift = to === 'core' ? 0.35 : 0.7
      mid.add(new THREE.Vector3(0, lift, 0.6))
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      const samples = curve.getSpacedPoints(80)
      const geo = new THREE.BufferGeometry().setFromPoints(samples)
      const matl = new THREE.LineBasicMaterial({
        color: to === 'core' ? '#5f86ff' : '#8c7fff',
        transparent: true,
        opacity: to === 'core' ? 0.28 : 0.12,
      })
      return { from, to, samples, line: new THREE.Line(geo, matl) }
    })
  }, [])

  const count = flows.length * perFlow
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    return geo
  }, [count])

  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.8)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  useEffect(
    () => () => {
      flows.forEach((f) => {
        f.line.geometry.dispose()
        ;(f.line.material as THREE.Material).dispose()
      })
      points.dispose()
      sprite.dispose()
    },
    [flows, points, sprite],
  )

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const cA = useMemo(() => new THREE.Color('#6f95ff'), [])
  const cB = useMemo(() => new THREE.Color('#b3a8ff'), [])
  const cHot = useMemo(() => new THREE.Color('#ffffff'), [])

  useFrame((state, dt) => {
    const t = reduced ? 0.0 : state.clock.elapsedTime
    const pos = points.attributes.position.array as Float32Array
    const col = points.attributes.color.array as Float32Array
    flows.forEach((f, fi) => {
      const hot = active !== null && (f.from === active || f.to === active)
      const m = f.line.material as THREE.LineBasicMaterial
      const base = f.to === 'core' ? 0.28 : 0.12
      m.opacity = THREE.MathUtils.damp(m.opacity, active === null ? base : hot ? 0.75 : base * 0.4, 6, dt)
      const speed = hot ? 0.32 : 0.14
      for (let k = 0; k < perFlow; k++) {
        const i = fi * perFlow + k
        const u = (k / perFlow + t * speed + fi * 0.137) % 1
        const fIdx = u * (f.samples.length - 1)
        const i0 = Math.floor(fIdx)
        const i1 = Math.min(i0 + 1, f.samples.length - 1)
        tmp.copy(f.samples[i0]).lerp(f.samples[i1], fIdx - i0)
        pos[i * 3] = tmp.x
        pos[i * 3 + 1] = tmp.y
        pos[i * 3 + 2] = tmp.z
        const c = hot ? cHot : f.to === 'core' ? cA : cB
        const fade = active !== null && !hot ? 0.25 : 1
        col[i * 3] = c.r * fade
        col[i * 3 + 1] = c.g * fade
        col[i * 3 + 2] = c.b * fade
      }
    })
    points.attributes.position.needsUpdate = true
    points.attributes.color.needsUpdate = true
  })

  return (
    <group>
      {flows.map((f, i) => (
        <primitive key={i} object={f.line} />
      ))}
      <points geometry={points}>
        <pointsMaterial
          size={compact ? 0.09 : 0.075}
          map={sprite}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

function Dust({ compact, reduced }: { compact: boolean; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const n = compact ? 120 : 260
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 3 + Math.random() * 4
      const th = Math.random() * Math.PI * 2
      const ph = (Math.random() - 0.5) * 1.4
      arr[i * 3] = Math.cos(th) * r
      arr[i * 3 + 1] = Math.sin(ph) * r * 0.6
      arr[i * 3 + 2] = Math.sin(th) * r - 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    return g
  }, [compact])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.y += dt * 0.012
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.018} color="#9fb2ff" transparent opacity={0.45} depthWrite={false} />
    </points>
  )
}

function SoftShadow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(60,90,200,0.35)')
    grd.addColorStop(0.5, 'rgba(30,40,90,0.12)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.75, 0]}>
      <planeGeometry args={[7, 7]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  )
}

function Rig({ labelRefs, pointer, reduced, children }: Pick<SceneProps, 'labelRefs' | 'pointer' | 'reduced'> & { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const world = useMemo(() => new THREE.Vector3(), [])
  const all = useMemo(() => [CORE, ...NODES], [])
  const intro = useRef(reduced ? 1 : 0)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    intro.current = Math.min(1, intro.current + dt * 0.6)
    const ease = 1 - Math.pow(1 - intro.current, 3)

    // keep the whole system (≈ 6.4 units wide) inside narrow viewports
    const aspect = size.width / Math.max(1, size.height)
    const fit = Math.max(1, (size.width < 600 ? 1.8 : 1.1) / aspect)
    camera.position.z = (10.2 - 2.1 * ease) * fit
    if (!reduced) {
      camera.position.x = Math.sin(t * 0.12) * 0.25
      camera.position.y = 0.35 + Math.cos(t * 0.1) * 0.15
    }
    camera.lookAt(0, 0, 0)

    if (root.current) {
      const tx = reduced ? 0 : pointer.current.y * 0.12
      const ty = reduced ? 0 : pointer.current.x * 0.22
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, tx, 3, dt)
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, ty, 3, dt)
    }

    // project label anchors into screen space
    all.forEach((n) => {
      const el = labelRefs.current[n.id]
      if (!el || !root.current) return
      world.set(...n.pos)
      root.current.localToWorld(world)
      v.copy(world).project(camera)
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = String(ease)
    })
  })

  return <group ref={root}>{children}</group>
}

export default function HeroScene(props: SceneProps & { running: boolean }) {
  const { active, setActive, labelRefs, pointer, reduced, compact, running } = props
  return (
    <Canvas
      className="hero-canvas"
      dpr={compact ? [1, 1.5] : [1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0.35, 9.6], fov: 36, near: 0.1, far: 60 }}
      frameloop={running ? 'always' : 'never'}
      onPointerMissed={() => setActive(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <Environment />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} color="#dfe6ff" />
      <pointLight position={[-4, -1, 3]} intensity={18} color="#4c7dff" distance={14} />
      <pointLight position={[4, -2, -3]} intensity={12} color="#9b8cff" distance={12} />
      <Rig labelRefs={labelRefs} pointer={pointer} reduced={reduced}>
        <Core active={active} setActive={setActive} reduced={reduced} />
        {NODES.map((n, i) => (
          <NodeMesh key={n.id} id={n.id} position={n.pos} active={active} setActive={setActive} index={i} reduced={reduced} />
        ))}
        <Flows active={active} reduced={reduced} compact={compact} />
        <SoftShadow />
      </Rig>
      <Dust compact={compact} reduced={reduced} />
    </Canvas>
  )
}
