import { canSeePoint, makeBuildingVisitRoute, makeTownPatrolRoute, makeThiefArrivalRoute, planTownPopulation, routeMetrics, routeIntersectsPlots, type TownPersonRole, type TownPersonBehavior } from '../../data/town-life';
import { townTravelRoutes, type TownLayout, type Point } from '../../data/town-layout';
import { samplePath, pointInPolygon } from '../../data/town-spatial';

export type LifeState = 'walking'|'lurking'|'entering'|'inside'|'resident'|'exiting'|'escaping'|'gone';
export type Citizen = {
  role: TownPersonRole; behavior: TownPersonBehavior; state: LifeState;
  route: Point[]; metrics: ReturnType<typeof routeMetrics>; distance: number;
  speed: number; direction: 1|-1; position: Point; facing: Point;
  opacity: number; timer: number; stay: boolean; pair?: number;
  conversation: number; conversationLeft: number; cooldown: number;
  chasing: boolean; moving: boolean; returning: boolean;
};
export function atDistance(route: Point[], distances: number[], distance: number) {
  let i=1; while(i<route.length-1&&distances[i]<distance)i++;
  const a=route[Math.max(0,i-1)]??{x:0,z:0},b=route[i]??a;
  const t=Math.max(0,Math.min(1,(distance-(distances[i-1]??0))/Math.max(0.001,(distances[i]??0)-(distances[i-1]??0))));
  const length=Math.hypot(b.x-a.x,b.z-a.z)||1;
  return {position:{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},facing:{x:(b.x-a.x)/length,z:(b.z-a.z)/length}};
}
export function createLife(layout: TownLayout, night: boolean, rainy: boolean, random:()=>number):Citizen[] {
  const plans=planTownPopulation({plotCount:layout.plots.length,night,rainy,random});
  const patrol=makeTownPatrolRoute(townTravelRoutes,samplePath);
  const citizens:Citizen[]=plans.map((plan,i)=>{
    const target=layout.plots[i%layout.plots.length];
    const route=plan.role==='guard'?patrol:plan.role==='thief'?makeThiefArrivalRoute(target,townTravelRoutes,samplePath,layout.plots):plan.behavior==='visit'?makeBuildingVisitRoute(target,layout.plots[(i+1)%layout.plots.length],townTravelRoutes,samplePath,layout.plots):samplePath(Object.values(townTravelRoutes)[i%4],8);
    const metrics=routeMetrics(route),distance=plan.role==='thief'?0:plan.role==='guard'?metrics.totalDistance*0.38:plan.behavior==='visit'?0.15:metrics.totalDistance*(0.35+random()*0.15);
    const pose=atDistance(route,metrics.distances,distance);
    return {...plan,state:'walking',route,metrics,distance,speed:plan.role==='thief'?0.38:plan.role==='guard'?0.6:0.43,direction:1,position:pose.position,facing:pose.facing,opacity:1,timer:0,stay:random()<0.22,pair:plan.interactionGroup,conversation:0,conversationLeft:0,cooldown:12,moving:true,chasing:false,returning:false};
  });
  const pair=citizens.filter(p=>p.pair!==undefined);
  if(pair.length===2){
    const route=samplePath(townTravelRoutes.main,8),metrics=routeMetrics(route);
    const centerIndex=route.reduce((best,p,i)=>Math.hypot(p.x,p.z)<Math.hypot(route[best].x,route[best].z)?i:best,0);
    pair.forEach((p,i)=>{p.route=route;p.metrics=metrics;p.distance=Math.max(0,metrics.distances[centerIndex]+i*0.48);p.speed=0.43;p.behavior='commute';p.cooldown=3;p.position=atDistance(route,metrics.distances,p.distance).position;});
  }
  return citizens;
}

/** Fixed delta integration: no absolute-time speed multiplication, endpoint
 * teleport or world-coordinate offset accumulation. All fades are per citizen. */
export function tickLife(people:Citizen[],dt:number,layout:TownLayout) {
  const thief=people.find(p=>p.role==='thief'&&p.state!=='gone'&&p.opacity>0.5);
  for(const guard of people.filter(p=>p.role==='guard')) {
    guard.chasing=!!thief&&canSeePoint(guard.position,thief.position,guard.facing,6.2,layout.plots,100);
    if(guard.chasing&&thief&&thief.state!=='inside') { thief.state='escaping';thief.direction=-1; }
  }
  const social=people.filter(p=>p.pair!==undefined&&p.role!=='guard'&&p.role!=='thief');
  if(social.length===2) {
    const [a,b]=social;
    if(a.cooldown<=0&&b.cooldown<=0&&a.state==='walking'&&b.state==='walking'&&Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<0.9) {
      a.conversationLeft=b.conversationLeft=3.2;a.cooldown=b.cooldown=28;
    }
  }
  for(const p of people) {
    p.cooldown-=dt;p.moving=false;
    p.conversationLeft=Math.max(0,p.conversationLeft-dt);
    const targetBlend=p.conversationLeft>0?1:0;
    p.conversation+=(targetBlend-p.conversation)*Math.min(1,dt*5);
    if(p.conversationLeft>0){
      const partner=social.find(q=>q!==p);
      if(partner){const dx=partner.position.x-p.position.x,dz=partner.position.z-p.position.z,len=Math.hypot(dx,dz)||1;p.facing={x:dx/len,z:dz/len};}
      continue;
    }
    if(p.role==='guard'&&(p.chasing||p.returning)){
      const target=p.chasing&&thief?thief.position:atDistance(p.route,p.metrics.distances,p.distance).position;
      const dx=target.x-p.position.x,dz=target.z-p.position.z,length=Math.hypot(dx,dz);
      if(length<0.08&&!p.chasing){p.returning=false;}
      else if(length>0.15){
        const step=Math.min(length,dt*(p.chasing?1.15:0.65));
        const next={x:p.position.x+dx/length*step,z:p.position.z+dz/length*step};
        const water=layout.regions.some(r=>r.kind==='river'&&pointInPolygon(next,r.polygon));
        const road=layout.regions.some(r=>r.kind==='road'&&pointInPolygon(next,r.polygon));
        if(!routeIntersectsPlots([p.position,next],layout.plots,0.16)&&(!water||road)){
          p.position=next;p.facing={x:dx/length,z:dz/length};p.moving=true;p.returning=true;continue;
        }
      }
      if(p.chasing)continue;
    }
    if(p.state==='resident'||p.state==='gone') {p.opacity=0;continue;}
    if(p.state==='entering') {
      p.timer+=dt;p.opacity=Math.max(0,1-p.timer/0.8);
      if(p.timer>=0.8){p.state=p.role==='townsperson'&&p.stay?'resident':'inside';p.timer=0;}continue;
    }
    if(p.state==='inside') {p.timer+=dt;if(p.timer>=4.2){p.state='exiting';p.timer=0;}continue;}
    if(p.state==='exiting') {
      p.timer+=dt;p.opacity=Math.min(1,p.timer/0.8);
      if(p.timer>=0.8){p.state=p.role==='thief'?'escaping':'walking';p.direction=p.direction===1?-1:1;p.timer=0;}continue;
    }
    if(p.state==='lurking') {p.timer+=dt;p.facing={x:Math.sin(p.timer)*0.25,z:-1};if(p.timer>=3.5){p.state='entering';p.timer=0;}continue;}
    p.moving=true;
    p.distance+=dt*p.speed*(p.state==='escaping'?2.8:p.chasing?1.9:1)*p.direction;
    const end=p.metrics.totalDistance;
    if(p.distance>=end||p.distance<=0) {
      p.distance=Math.max(0,Math.min(end,p.distance));
      if(p.role==='thief') {p.state=p.direction===-1?'gone':'lurking';p.timer=0;}
      else if(p.behavior==='visit') {p.state='entering';p.timer=0;}
      else p.direction=p.direction===1?-1:1;
    }
    const pose=atDistance(p.route,p.metrics.distances,p.distance);
    p.position=pose.position;p.facing={x:pose.facing.x*p.direction,z:pose.facing.z*p.direction};
  }
}
