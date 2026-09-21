import { flowStandard, makeFlow } from './appFlowConfig'
import { clone, makeId, validVersion, newPlan, versionMatches } from './abTestConfig'
import type { Plan } from './abTestConfig'
import { registry, initialContent, getSlot, contentPlan, latestVersion, compatibleVersion, audience, validateAudience, validateContent, saveVersion, validateRelease, activateRelease, saveExperimentDraft, transitionExperiment, validateExperiment, releaseState, compareVersions, statusLabels, versionScopeErrors, audienceTarget } from './appConfigModel'
import type { AppConfigStore, UnitContent, Audience, AppExperiment, Definition, ConfigVersion } from './appConfigModel'

export type VisualPlan = { flowId:string; contents:Record<string,UnitContent>; minimums?:Record<string,string> }
export type OnlinePlan = { id:string; name:string; audience:Audience; minVersion:string; plan:VisualPlan; status:'DRAFT'|'ACTIVE'|'ENDED'; releaseIds:string[]; versionIds:string[]; replaceId?:string }
export type ExperimentPlans = { baseId?:string; baseName:string; baseMinVersion?:string; plans:Record<string,VisualPlan> }
export type BusinessSnapshot = {kind:'online';value:OnlinePlan}|{kind:'experiment';value:AppExperiment;visual:ExperimentPlans}
export type BusinessHistory = {id:string;entityId:string;at:string;actor:string;action:string;snapshot:BusinessSnapshot}
export type Workspace = {online:OnlinePlan[];drafts:OnlinePlan[];experiments:Record<string,ExperimentPlans>;history:BusinessHistory[]}
export type BusinessStore = AppConfigStore & {workspace?:Workspace}
export function blankPlan():VisualPlan {return {flowId:'app.flow.register_first',contents:Object.fromEntries(registry.map(s=>[s.id,initialContent(s)]))}}
export function planSlots(p:VisualPlan){return registry.filter(s=>!s.flow||s.id===p.flowId)}
export function fullPlan(p:VisualPlan):Plan {return planSlots(p).reduce((base,s)=>contentPlan(p.contents[s.id]??initialContent(s),s,base),newPlan())}
export function effectiveContent(p:VisualPlan,id:string):UnitContent {const s=getSlot(id),c=p.contents[id]??initialContent(s);return s.flow?{...c,flow:c.flow??makeFlow(c.steps??[],flowStandard(id))}:c}
export function planMinimum(p:VisualPlan){return Object.values(p.minimums??{}).sort(compareVersions).slice(-1)[0]}
export function planErrors(p:VisualPlan):string[]{return planSlots(p).flatMap(s=>validateContent(s,effectiveContent(p,s.id)).map(e=>`${s.page} / ${s.name}：${e}`))}
export function infoErrors(p:{name:string;audience:Audience;minVersion:string}){return [...new Set([...(!p.name.trim()?['请填写名称。']:[]),...validateAudience(p.audience),...versionScopeErrors(p.audience,p.minVersion),...(!validVersion(p.minVersion)?['请填写有效的最低 App 版本，例如 1.8.0。']:[])])]}
export function newOnline():OnlinePlan {return {id:makeId(),name:'',audience:audience(),minVersion:'1.8.0',plan:blankPlan(),status:'DRAFT',releaseIds:[],versionIds:[]}}
function readBindings(store:AppConfigStore,bindings:{definitionId:string;versionId:string}[],base=blankPlan()) {const p=clone(base);for(const b of bindings){const d=store.definitions.find(x=>x.id===b.definitionId),v=store.versions.find(x=>x.id===b.versionId);if(!d||!v)continue;p.contents[d.slotId]=clone(v.content);p.minimums={...p.minimums,[d.slotId]:v.minVersion};if(getSlot(d.slotId).flow)p.flowId=d.slotId}return p}
// A view over existing records: grouping does not change any old release or version.
export function workspace(store:BusinessStore):Workspace {
 if(store.workspace){const minimums=(ids:string[])=>Object.fromEntries(ids.flatMap(id=>{const v=store.versions.find(x=>x.id===id),d=v&&store.definitions.find(x=>x.id===v.definitionId);return v&&d?[[d.slotId,v.minVersion]]:[]}));const online=store.workspace.online.map(p=>({...p,plan:{...p.plan,minimums:{...p.plan.minimums,...minimums(p.versionIds)}}}));return {...store.workspace,online,experiments:Object.fromEntries(Object.entries(store.workspace.experiments).map(([id,v])=>[id,{...v,plans:Object.fromEntries(Object.entries(v.plans).map(([gid,p])=>[gid,{...p,minimums:{...p.minimums,...minimums(store.experiments.find(e=>e.id===id)?.groups.find(g=>g.id===gid)?.bindings.map(b=>b.versionId)??[])}}]))}]))}}
 const groups:Record<string,typeof store.releases>={}
 for(const r of store.releases){let key=JSON.stringify([r.audience,r.status,r.startAt,r.endAt,r.priority]);const sameSlot=(a:typeof r)=>store.definitions.find(d=>d.id===a.definitionId)?.slotId===store.definitions.find(d=>d.id===r.definitionId)?.slotId;if(groups[key]?.some(sameSlot))key+=r.id;(groups[key]??=[]).push(r)}
 const online=Object.values(groups).map(rs=>{const bindings=rs.flatMap(r=>{const v=latestVersion(store,r.definitionId);return v?[{definitionId:r.definitionId,versionId:v.id}]:[]});return {id:`online-${rs[0].id}`,name:rs.length>1?'首次注册登录方案（已有配置）':rs[0].name,audience:clone(rs[0].audience),minVersion:bindings.map(b=>store.versions.find(v=>v.id===b.versionId)!.minVersion).sort(compareVersions).slice(-1)[0]??'1.8.0',plan:readBindings(store,bindings),status:rs.some(r=>releaseState(r)==='ACTIVE')?'ACTIVE' as const:rs.some(r=>r.status==='DRAFT')?'DRAFT' as const:'ENDED' as const,releaseIds:rs.map(r=>r.id),versionIds:bindings.map(b=>b.versionId)}})
 // Keep previously saved, unpublished unit drafts accessible as visual drafts.
 const drafts=(store.configDrafts??[]).map(d=>{const p=newOnline();p.id=`draft-${d.definition.id}`;p.name=d.definition.name||'已有配置草稿';p.minVersion=d.minVersion;p.plan.contents[d.definition.slotId]=clone(d.content);if(getSlot(d.definition.slotId).flow)p.plan.flowId=d.definition.slotId;return p})
 const experiments=Object.fromEntries(store.experiments.map(e=>[e.id,{baseName:'已有实验内容',plans:Object.fromEntries(e.groups.map(g=>[g.id,readBindings(store,g.bindings)]))}]))
 return {online,drafts,experiments,history:[]}
}
function history(store:BusinessStore,snapshot:BusinessSnapshot,action:string,actor:string):BusinessStore {const w=workspace(store);return {...store,workspace:{...w,history:[...w.history,{id:makeId(),entityId:snapshot.value.id,at:new Date().toISOString(),actor,action,snapshot:clone(snapshot)}]}}}
export function saveOnlineDraft(store:BusinessStore,p:OnlinePlan,actor:string):BusinessStore {const w=workspace(store);return history({...store,workspace:{...w,drafts:[...w.drafts.filter(x=>x.id!==p.id),clone(p)]}},{kind:'online',value:p},'保存草稿',actor)}
function addVersions(store:BusinessStore,p:VisualPlan,minVersion:string,name:string,kind:Definition['kind'],actor:string,previous:string[]=[]){let next=store;const bindings=[];for(const s of planSlots(p)){const prior=previous.map(id=>next.versions.find(v=>v.id===id)).find(v=>v&&next.definitions.find(d=>d.id===v.definitionId)?.slotId===s.id);const old=prior&&next.definitions.find(d=>d.id===prior.definitionId);const content=effectiveContent(p,s.id);if(p.minimums?.[s.id]&&compareVersions(minVersion,p.minimums[s.id])<0)throw Error(`${s.page} / ${s.name} 的最低 App 版本不能低于 ${p.minimums[s.id]}。`);if(prior&&prior.minVersion===minVersion&&JSON.stringify(prior.content)===JSON.stringify(content)){bindings.push({definitionId:prior.definitionId,versionId:prior.id});continue}const d:Definition=old??{id:makeId(),slotId:s.id,name:`${name} · ${s.page} · ${s.name}`,description:'由可视化方案自动维护',kind,status:'ENABLED',createdAt:new Date().toISOString()};next=saveVersion(next,d,content,minVersion,actor,'可视化方案保存') as BusinessStore;bindings.push({definitionId:d.id,versionId:latestVersion(next,d.id).id})}return {store:next,bindings}}
export function publishOnline(store:BusinessStore,p:OnlinePlan,actor:string):BusinessStore {
 const errors=[...infoErrors(p),...planErrors(p.plan),...(validVersion(p.minVersion)&&planMinimum(p.plan)&&compareVersions(p.minVersion,planMinimum(p.plan)!)<0?[`最低 App 版本不能低于原配置要求的 ${planMinimum(p.plan)}。`]:[])];if(errors.length)throw Error(errors.join('\n'))
 const w=workspace(store),old=p.replaceId?w.online.find(x=>x.id===p.replaceId):undefined;
 if(p.replaceId&&!old)throw Error('要替换的线上配置已不存在，请重新选择。')
 // Commit all releases and versions in one localStorage write; failures leave the old plan intact.
 let next:BusinessStore={...store,workspace:clone(w),releases:store.releases.map(r=>old?.releaseIds.includes(r.id)?{...r,status:'ENDED'}:r)}
 const saved=addVersions(next,p.plan,p.minVersion,p.name,'DIRECT',actor,old?.versionIds);next=saved.store
 const releaseIds:string[]=[]
 for(const b of saved.bindings){const r={id:makeId(),name:p.name,definitionId:b.definitionId,audience:{...clone(p.audience),versions:audienceTarget(p.audience,p.minVersion).versions},priority:0,startAt:'',endAt:'',status:'DRAFT' as const};const issues=validateRelease(next,r);if(issues.length)throw Error(issues.join('\n'));next=activateRelease(next,r,actor) as BusinessStore;releaseIds.push(r.id)}
 const value:OnlinePlan={...clone(p),id:old?.id??(w.online.some(x=>x.id===p.id)?makeId():p.id),status:'ACTIVE',releaseIds,versionIds:saved.bindings.map(b=>b.versionId),replaceId:undefined}
 next.workspace={...w,online:[...w.online.filter(x=>x.id!==value.id),value],drafts:w.drafts.filter(x=>x.id!==p.id)}
 return history(next,{kind:'online',value},old?'发布更新':'首次发布',actor)
}
export function endOnline(store:BusinessStore,p:OnlinePlan,actor:string):BusinessStore {const w=workspace(store);const value={...p,status:'ENDED' as const};return history({...store,releases:store.releases.map(r=>p.releaseIds.includes(r.id)?{...r,status:'ENDED'}:r),workspace:{...w,online:w.online.map(x=>x.id===p.id?value:x)}},{kind:'online',value},'结束线上配置',actor)}
export function newExperiment(base?:OnlinePlan):{value:AppExperiment;visual:ExperimentPlans}{const groups=['A 组','B 组'].map((name,i)=>({id:makeId(),name,weight:5000,control:i===0,bindings:[]}));return {value:{id:makeId(),name:'',audience:clone(base?.audience??audience()),minVersion:base?([base.minVersion,planMinimum(base.plan)??base.minVersion].sort(compareVersions).slice(-1)[0]):'1.8.0',status:'DRAFT',groups,startedAt:'',endedAt:'',salt:makeId()},visual:{baseId:base?.id,baseName:base?.name??'默认方案',baseMinVersion:base?.minVersion,plans:Object.fromEntries(groups.map(g=>[g.id,clone(base?.plan??blankPlan())]))}}}
export function experimentErrors(store:BusinessStore,e:AppExperiment,v:ExperimentPlans):string[]{
 // Validate the exact contents users see, before materializing immutable APP versions.
 const defs:Definition[]=[],versions:ConfigVersion[]=[]
 const groups=e.groups.map(g=>({...g,bindings:planSlots(v.plans[g.id]??blankPlan()).map(s=>{const id=`preview-${g.id}-${s.id}`;defs.push({id,slotId:s.id,name:s.name,description:'',kind:'EXPERIMENT',status:'ENABLED',createdAt:''});versions.push({id,definitionId:id,no:1,minVersion:v.plans[g.id]?.minimums?.[s.id]??e.minVersion,contractVersion:1,content:effectiveContent(v.plans[g.id]??blankPlan(),s.id),actor:'',at:'',summary:''});return {definitionId:id,versionId:id}})}))
 return [...(v.baseMinVersion&&validVersion(e.minVersion)&&compareVersions(e.minVersion,v.baseMinVersion)<0?[`最低 App 版本不能低于基准方案的 ${v.baseMinVersion}。`]:[]),...validateExperiment({...store,definitions:[...store.definitions,...defs],versions:[...store.versions,...versions]},{...e,groups})]
}
export function saveVisualExperiment(store:BusinessStore,e:AppExperiment,v:ExperimentPlans,actor:string,ready=false):BusinessStore {
 let next=saveExperimentDraft(store,e,actor) as BusinessStore
 let value=clone(e)
 if(ready){const errors=experimentErrors(store,e,v);if(errors.length)throw Error(errors.join('\n'));for(const g of value.groups){const saved=addVersions(next,v.plans[g.id]??blankPlan(),e.minVersion,`${e.name} · ${g.name}`,'EXPERIMENT',actor,g.bindings.map(b=>b.versionId));next=saved.store;g.bindings=saved.bindings}next=saveExperimentDraft(next,value,actor) as BusinessStore;next=transitionExperiment(next,e.id,'READY',actor) as BusinessStore;value=next.experiments.find(x=>x.id===e.id)!}
 const w=workspace(store);next.workspace={...w,experiments:{...w.experiments,[e.id]:clone(v)}}
 return history(next,{kind:'experiment',value,visual:v},ready?'检查通过，设为就绪':'保存实验草稿',actor)
}
export function changeExperimentStatus(store:BusinessStore,e:AppExperiment,status:AppExperiment['status'],actor:string){const next=transitionExperiment(store,e.id,status,actor) as BusinessStore;return history(next,{kind:'experiment',value:next.experiments.find(x=>x.id===e.id)!,visual:workspace(store).experiments[e.id]},`实验${statusLabels[status]}`,actor)}
export function relatedTo(store:BusinessStore,p:OnlinePlan){const w=workspace(store);return store.experiments.filter(e=>w.experiments[e.id]?.baseId===p.id||e.groups.some(g=>g.bindings.some(b=>p.versionIds.includes(b.versionId))))}
export function resolvedOnline(store:BusinessStore,p:OnlinePlan,appVersion=p.minVersion):VisualPlan|undefined {if(!versionMatches(appVersion,audienceTarget(p.audience,p.minVersion).versions))return undefined;const bindings=p.releaseIds.flatMap(id=>{const r=store.releases.find(x=>x.id===id),v=r&&compatibleVersion(store,r.definitionId,appVersion);return v?[{definitionId:r!.definitionId,versionId:v.id}]:[]});return bindings.length?readBindings(store,bindings):clone(p.plan)}
