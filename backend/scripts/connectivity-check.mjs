// Replica la secuencia de llamadas de cada pantalla de /app, por el proxy de
//  Verifica el contrato frontend <-> backend replicando la secuencia de
//  llamadas de cada pantalla de /app, por el proxy de Vite (mismo origen y
//  camino que usa el navegador), mas las lecturas on-chain que hacen las
//  paginas con viem.  Uso:  npm run check:conn   (con chain+backend+frontend)

// Vite (el mismo origen y camino que usa el navegador), y valida la FORMA de
// los datos que los componentes consumen.
import { createPublicClient, http } from 'viem'
const R = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const { projectVaultAbi, eligibilityRegistryAbi, mockUsdtAbi } = await import(`${R}/packages/shared/dist/index.js`)
const B = 'http://localhost:5173'

let ok = 0, bad = 0
const pass = (m) => { console.log(`   ok   ${m}`); ok++ }
const fail = (m) => { console.log(`   FALLA ${m}`); bad++ }
const check = (cond, m) => cond ? pass(m) : fail(m)
const get = async (p) => { const r = await fetch(B + p); if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json() }

// La red la dicta el backend: Anvil en local, HashKey Chain en testnet.
const health = await get('/api/health')
const chain = { id: health.chainId, name: `chain-${health.chainId}`, nativeCurrency:{name:'N',symbol:'N',decimals:18}, rpcUrls:{default:{http:[health.rpcUrl]}} }
const pub = createPublicClient({ chain, transport: http() })
const d = health.contracts
const INV = Object.keys(JSON.parse(await (await import('node:fs/promises')).readFile(`${R}/backend/data/demo-credentials.json`,'utf8')).credentials)[0]

console.log('\n── DeploymentProvider ──────────────────────────────────')
check(health.deployed === true, 'health.deployed = true')
check(/^0x[0-9a-fA-F]{40}$/.test(d.vault), `vault ${d.vault}`)
check(/^0x[0-9a-fA-F]{40}$/.test(d.eligibility), `eligibility ${d.eligibility}`)
check((await pub.getCode({ address: d.vault })) !== undefined, 'el vault tiene bytecode en la cadena')

console.log('\n── DashboardPage ───────────────────────────────────────')
const { projects } = await get('/api/projects')
check(projects.length > 0, `/api/projects -> ${projects.length} proyecto(s)`)
const p = projects.find(x => x.vaultAddress) ?? projects[0]
await fetch(B + '/api/sync', { method: 'POST' })
const st = await get(`/api/projects/${p.id}/chain`)
check(typeof st.locked === 'string' && /^\d+$/.test(st.locked), `chain.locked = "${st.locked}" (string entero)`)
check(Array.isArray(st.milestones) && st.milestones.length > 0, `chain.milestones -> ${st.milestones.length}`)
check(st.milestones.every(m => 'state' in m && 'amount' in m), 'cada hito trae state y amount')
check(Array.isArray(st.events), `chain.events -> ${st.events.length}`)
const invested = await pub.readContract({ address: d.vault, abi: projectVaultAbi, functionName: 'invested', args: [BigInt(p.onChainId), INV] })
const claimable = await pub.readContract({ address: d.vault, abi: projectVaultAbi, functionName: 'claimable', args: [BigInt(p.onChainId), INV] })
check(typeof invested === 'bigint' && typeof claimable === 'bigint', `lectura on-chain invested=${invested} claimable=${claimable}`)

console.log('\n── InvestPage ──────────────────────────────────────────')
const mk = await get('/api/marketplace')
check(Array.isArray(mk.projects), `/api/marketplace -> ${mk.projects.length}`)
const elig = await pub.readContract({ address: d.eligibility, abi: eligibilityRegistryAbi, functionName: 'isEligible', args: [BigInt(p.onChainId), INV] })
check(typeof elig === 'boolean', `isEligible(${p.onChainId}, inv) = ${elig}`)
const bal = await pub.readContract({ address: d.usdt, abi: mockUsdtAbi, functionName: 'balanceOf', args: [INV] })
check(typeof bal === 'bigint', `balanceOf = ${Number(bal)/1e6} USDT`)
const circuit = await get('/api/circuit/eligibility')
check(typeof circuit.bytecode === 'string' && circuit.bytecode.length > 100, `circuito servido (${circuit.bytecode.length} b64)`)
check(BigInt(p.eligibility.minNetWorth) >= 0n && p.eligibility.credentialRoot.startsWith('0x'), 'política de elegibilidad presente en el dossier')

console.log('\n── IdentityPage ────────────────────────────────────────')
const who = await get(`/api/investors/${INV}`)
check(who.investor.kycStatus === 'APPROVED', `kycStatus = ${who.investor.kycStatus}`)
check(who.credentials.length > 0, `credenciales emitidas: ${who.credentials.length}`)
const path = await get(`/api/issuer/path/${who.credentials[0].leaf}`)
check(path.path.length === 8 && path.indexBits.length === 8, 'camino de Merkle de profundidad 8')

console.log('\n── VerifyPage ──────────────────────────────────────────')
const rev = await get(`/api/projects/${p.id}/milestones/${st.nextMilestone}/review`)
check(!!rev.milestone && Array.isArray(rev.requiredEvidence), `hito ${rev.milestone.index}: "${rev.milestone.title}"`)
check(Array.isArray(rev.verifiers) && rev.verifiers.length > 0, `verificadores registrados: ${rev.verifiers.length}`)
check(Array.isArray(rev.missingKinds), `evidencia faltante: [${rev.missingKinds.join(', ') || 'ninguna'}]`)

console.log('\n── NewProjectPage (ciclo completo de escritura) ────────')
const iso = (dd) => new Date(Date.now() + dd*864e5).toISOString()
const A = (n) => (BigInt(n) * 1000000n).toString()
const draft = {
  name:'Prueba de conexión', city:'Cochabamba', type:'RESIDENCIAL', summary:'Creado por la prueba de integración.',
  developer:{id:'dev-test',legalName:'Test SRL',taxId:'1',address:'0x70997970C51812dc3A010C7d01b50e0d17dc79C8',completedProjects:1,yearsActive:1},
  spv:{legalName:'SPV Test',taxId:'2',commercialRegistry:'MC-1',incorporatedAt:iso(-10),jurisdiction:'Bolivia',treasuryAddress:'0x70997970C51812dc3A010C7d01b50e0d17dc79C8'},
  property:{cadastralId:'X',address:'Y',city:'Cochabamba',landArea:1,buildableArea:1,titleHolder:'SPV Test',appraisedValue:A(100000),appraisedAt:iso(-5),appraiser:'T',encumbrances:[],certificateVerifiedAt:iso(-1)},
  sourcesAndUses:{sources:{developerEquity:A(50000),investorFinancing:A(100000),bankFinancing:A(0),presales:A(0)},
    uses:{land:A(60000),construction:A(70000),permitsAndFees:A(0),professionalServices:A(0),marketing:A(0),contingency:A(20000),financialCosts:A(0)}},
  terms:{target:A(100000),minimumTicket:A(1000),maximumTicket:null,termMonths:12,interestBps:1000,repaymentModel:'BULLET',originationBps:200,successBps:1500,expectedRevenue:A(200000),fundingDeadline:iso(20)},
  milestones:[{index:0,title:'Cierre legal',description:'d',bps:5000,role:'LEGAL',deadline:iso(60),requiredEvidence:['CERTIFICADO']},
              {index:1,title:'Obra',description:'d',bps:5000,role:'SUPERVISOR',deadline:iso(200),requiredEvidence:['INFORME']}],
  eligibility:{minNetWorth:'100000',allowedJurisdiction:68,credentialRoot:'0x0'}, risk:null,
  verifiers:[{id:'vl',address:'0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',name:'L',role:'LEGAL',license:'1',organization:'o'},
             {id:'vs',address:'0x90F79bf6EB2c4f870365E785982E1f101E93b906',name:'S',role:'SUPERVISOR',license:'2',organization:'o'}],
  agreementHash:null, agreementVersion:null, vaultAddress:null, chainId:null,
}
const post = async (path, body) => { const r = await fetch(B+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body??{})}); const j = await r.json(); if(!r.ok) throw new Error(`${path} -> ${r.status} ${j.error}`); return j }
const created = await post('/api/projects', draft)
check(created.project.id.startsWith('S2D-'), `borrador creado: ${created.project.id} (onChainId ${created.project.onChainId})`)
await post(`/api/projects/${created.project.id}/submit`)
await post(`/api/projects/${created.project.id}/review`, {decision:'UNDER_REVIEW', note:'prueba', author:'test'})
const approved = await post(`/api/projects/${created.project.id}/review`, {decision:'APPROVED', note:'prueba', author:'test'})
check(approved.project.status === 'APPROVED', 'DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED')
const published = await post(`/api/projects/${created.project.id}/publish`)
check(!!published.transactions.createProject, `publicado en cadena, tx ${published.transactions.createProject.slice(0,14)}…`)
const onChain = await pub.readContract({ address: d.vault, abi: projectVaultAbi, functionName: 'projects', args: [BigInt(published.project.onChainId)] })
check(Number(onChain[6]) === 1, `el vault confirma el proyecto en estado FUNDING (status=${onChain[6]})`)

console.log('\n── T19 repayment ───────────────────────────────────────')
const sch = await post(`/api/projects/${p.id}/repayment/schedule`, {force:true})
check(sch.schedule.installments.length > 0, `cronograma: ${sch.schedule.installments.length} cuotas de ${Number(sch.schedule.installment)/1e6} USDT`)
check(sch.schedule.installments.every(i => /^\d+$/.test(i.capitalPortion) && /^\d+$/.test(i.interestPortion)), 'capital e interés como enteros en string')

console.log(`\n${'═'.repeat(56)}\n${ok} verificaciones correctas, ${bad} fallas\n${'═'.repeat(56)}`)
process.exit(bad ? 1 : 0)
