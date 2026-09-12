// Alta de inversionista de punta a punta: registro -> KYC on-chain ->
// credencial ZK -> camino de Merkle. Por el proxy de Vite, igual que el navegador.
import { createPublicClient, http } from 'viem'
const R='/Users/luisdanielrojascaceres/Downloads/programacion_etc/build_trust'
const { projectVaultAbi } = await import(`${R}/packages/shared/dist/index.js`)
const B='http://localhost:5173'
const j = async (m,p,b) => { const r=await fetch(B+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}); const d=await r.json(); if(!r.ok) throw new Error(`${p} -> ${r.status} ${d.error}`); return d }
const pub = createPublicClient({ chain:{id:31337,name:'a',nativeCurrency:{name:'E',symbol:'E',decimals:18},rpcUrls:{default:{http:['http://127.0.0.1:8545']}}}, transport: http() })
const { contracts } = await j('GET','/api/health')

// Wallet nueva: nunca vista por la plataforma.
const wallet = '0x' + Array.from({length:40},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('')
console.log(`\nwallet nueva: ${wallet}\n`)

const before = await pub.readContract({address:contracts.vault,abi:projectVaultAbi,functionName:'kycApproved',args:[wallet]})
console.log(`1. Antes de registrarse, el vault dice kycApproved = ${before}`)
if (before !== false) throw new Error('una wallet desconocida no deberia estar aprobada')

const { investor } = await j('POST','/api/investors',{address:wallet,displayName:'Inversionista de prueba',email:'prueba@example.bo'})
console.log(`2. Registrado: ${investor.displayName} -> kycStatus = ${investor.kycStatus}`)
if (investor.kycStatus !== 'PENDING') throw new Error('deberia arrancar en PENDING')

const kyc = await j('POST',`/api/investors/${wallet}/kyc`,{approved:true})
const after = await pub.readContract({address:contracts.vault,abi:projectVaultAbi,functionName:'kycApproved',args:[wallet]})
console.log(`3. KYC aprobado -> tx ${kyc.txHash.slice(0,18)}…`)
console.log(`   el vault ahora dice kycApproved = ${after}`)
if (after !== true) throw new Error('el KYC no llego a la cadena')

const cred = await j('POST',`/api/investors/${wallet}/credential`,{jurisdiction:68,netWorth:'250000',expiresAt:Math.floor(Date.now()/1000)+31536000})
console.log(`4. Credencial emitida -> hoja ${cred.credential.leaf.slice(0,20)}…`)
console.log(`   el secreto vuelve UNA vez: ${cred.secret.secret.slice(0,14)}… (el servidor no lo guarda)`)

const stored = await j('GET',`/api/investors/${wallet}`)
const leak = JSON.stringify(stored).includes(cred.secret.secret.replace('0x','').slice(0,20))
console.log(`5. ¿El servidor devuelve el secreto al releer? ${leak ? 'SI — FUGA' : 'no'}`)
if (leak) throw new Error('el servidor esta guardando el secreto')
const guardaPatrimonio = JSON.stringify(stored).includes('250000')
console.log(`   ¿Guarda el patrimonio en claro? ${guardaPatrimonio ? 'SI — FUGA' : 'no'}`)
if (guardaPatrimonio) throw new Error('el servidor esta guardando el patrimonio')

const path = await j('GET',`/api/issuer/path/${cred.credential.leaf}`)
console.log(`6. Camino de Merkle: profundidad ${path.path.length}, indice ${path.index}, raiz ${path.root.slice(0,18)}…`)
console.log(`\n   La wallet queda con las DOS condiciones separadas:`)
console.log(`     kycApproved  = ${after}   <- lo AFIRMA el operador, en cadena`)
console.log(`     credencial   = emitida    <- lo PRUEBA el inversionista, sin revelar nada`)
console.log('\n════ KYC DE ALTA: OK ════\n')
