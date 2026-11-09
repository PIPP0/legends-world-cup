import { STORY_MATCHES } from '../src/data'
import { DEFAULT_PARAMS as D, lambdas } from '../src/engine/model'
const g = STORY_MATCHES.filter(m=>m.group)
console.log(g.length, 'goles/partido', g.reduce((a,m)=>a+m.hg+m.ag,0)/g.length)
const lf=(k:number)=>{let s=0;for(let i=2;i<=k;i++)s+=Math.log(i);return s}
const ll=(p:any)=>g.reduce((a,m)=>{const [x,y]=lambdas(m.home,m.away,p);return a+(-x+m.hg*Math.log(x)-lf(m.hg))+(-y+m.ag*Math.log(y)-lf(m.ag))},0)
console.log('actual',ll(D).toFixed(2))
let best:any=null
for (const s of [0.05,0.06,0.07,0.08,0.09]) for (const gb of [1.15,1.2,1.25,1.3,1.35]) for (const mu of [0,0.25,0.5,0.75,1]) { const v=ll({...D,sensitivity:s,goalBase:gb,matchup:mu}); if(!best||v>best.v)best={s,gb,mu,v}; if(gb===1.25&&mu===0.5) console.log(s,v.toFixed(2)) }
console.log(best)
import { probabilities } from '../src/engine/model'
for (const P of [D,{...D,sensitivity:0.07,goalBase:1.25}]) {
 let fav=0,n=0,br=0,bs=0
 for (const m of g){const p=probabilities(m.home,m.away,P);const pw=p.win>=p.loss?p.win:p.loss;const favHome=p.win>=p.loss;const r=m.hg===m.ag?0.5:(m.hg>m.ag)===favHome?1:0;br+=(r-(pw+p.draw/2))**2;n++;fav+=r}
 console.log('sens',P.sensitivity,'fav acc(score)',(fav/n).toFixed(2),'brier',(br/n).toFixed(3))
}
