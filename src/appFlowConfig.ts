/** Visual prototype contract for the updated flow rules. Server field names await APP agreement. */
export type FlowStandard = 'REGISTER_FIRST' | 'EXPERIENCE_FIRST'
export type FlowNode = { id:string; page:string; successTo?:string; failureTo?:string }
export type FlowGraph = { standard:FlowStandard; nodes:FlowNode[]; skipPaywallAfterSuccess:true }
export const flowStandards = [
 {id:'app.flow.register_first',standard:'REGISTER_FIRST' as const,name:'先注册，再体验',desc:'先完成注册登录，再进入体验流程。'},
 {id:'app.flow.experience_first',standard:'EXPERIENCE_FIRST' as const,name:'先体验付费，再登录注册',desc:'先以游客进入体验与购买流程，再衔接注册登录。'},
]
export const flowPages = ['value','auth','name','age','level','goal','teacher','lesson','report','plan','paywall','home']
export const onboardingPages = ['name','age','level','goal']
export const isOnboardingPage = (page:string) => onboardingPages.includes(page)
export type FlowUnit = { nodes:FlowNode[]; onboarding:boolean }
/** Keep storage page IDs stable while editing the four onboarding pages as one unit. */
export function flowUnits(nodes:FlowNode[]):FlowUnit[] {
 const units:FlowUnit[]=[]
 for(const n of nodes){const previous=units[units.length-1];if(isOnboardingPage(n.page)&&previous?.onboarding)previous.nodes.push(n);else units.push({nodes:[n],onboarding:isOnboardingPage(n.page)})}
 return units
}
export function onboardingErrors(nodes:FlowNode[]):string[]{
 const first=nodes.findIndex(n=>isOnboardingPage(n.page));if(first<0)return []
 const selected=nodes.filter(n=>isOnboardingPage(n.page))
 return selected.length===4&&onboardingPages.every((page,i)=>nodes[first+i]?.page===page)?[]:['资料采集是完整模块，须按「孩子称呼 → 孩子年龄 → 英语水平 → 学习目标」连续展示，不能拆分、重复或调整内部顺序。']
}
export function moveFlowUnit(nodes:FlowNode[],index:number,delta:number):FlowNode[]{
 const units=flowUnits(nodes),to=index+delta
 if(index<=0||index>=units.length-1||to<=0||to>=units.length-1)return nodes
 ;[units[index],units[to]]=[units[to],units[index]]
 return units.flatMap(u=>u.nodes)
}
export function restoreOnboarding(nodes:FlowNode[],id:()=>string):FlowNode[]{
 const first=nodes.findIndex(n=>isOnboardingPage(n.page));if(first<0)return nodes
 const module=onboardingPages.map(page=>nodes.find(n=>n.page===page)??{id:id(),page})
 const oldIds=new Set(nodes.filter(n=>isOnboardingPage(n.page)).map(n=>n.id))
 return nodes.flatMap((n,i)=>i===first?module:isOnboardingPage(n.page)?[]:[n]).map(n=>({...n,...(n.successTo&&oldIds.has(n.successTo)?{successTo:module[0].id}:{}),...(n.failureTo&&oldIds.has(n.failureTo)?{failureTo:module[0].id}:{})}))
}
export function makeFlow(pages:string[],standard:FlowStandard):FlowGraph {
 const nodes:FlowNode[]=pages.map((page,i)=>({id:`step-${i+1}`,page:page.startsWith('paywall')?'paywall':page}))
 nodes.forEach((n,i)=>{if(n.page==='paywall'){n.successTo=nodes[i+1]?.id;n.failureTo=nodes[i+1]?.id}})
 return {standard,nodes,skipPaywallAfterSuccess:true}
}
export function flowStandard(id:string):FlowStandard{return id.endsWith('register_first')?'REGISTER_FIRST':'EXPERIENCE_FIRST'}
export function validateFlow(g:FlowGraph):string[]{
 const nodes=g.nodes,errors:string[]=onboardingErrors(nodes)
 if(!nodes.length)return ['请至少配置一个流程节点。']
 if(!['REGISTER_FIRST','EXPERIENCE_FIRST'].includes(g.standard))errors.push('请选择流程标准。')
 if(g.skipPaywallAfterSuccess!==true)errors.push('支付成功后必须跳过后续全部购买页。')
 if(new Set(nodes.map(n=>n.id)).size!==nodes.length||nodes.some(n=>!n.id))errors.push('流程节点标识不能为空或重复。')
 if(nodes.some(n=>!flowPages.includes(n.page)))errors.push('流程包含未支持的页面。')
 if(nodes[nodes.length-1].page!=='home'||nodes.slice(0,-1).some(n=>n.page==='home'))errors.push('首页必须且只能作为终点。')
 if(nodes.filter(n=>n.page==='auth').length!==1)errors.push('流程必须且只能保留一个注册登录节点。')
 if(!nodes.some(n=>n.page==='lesson'))errors.push('两套标准均须保留体验课。')
 if(g.standard==='REGISTER_FIRST'&&nodes[0].page!=='auth')errors.push('先注册再体验：第一个节点必须是注册登录。')
 if(g.standard==='EXPERIENCE_FIRST'&&nodes[0].page!=='value')errors.push('先体验付费再登录注册：第一个节点必须是首启价值页。')
 if(g.standard==='EXPERIENCE_FIRST'&&!nodes.some(n=>n.page==='paywall'))errors.push('先体验付费再登录注册：须配置购买页。')
 for(const [i,n] of nodes.entries())if(n.page==='paywall')for(const [key,label] of [['successTo','支付成功'],['failureTo','支付失败／取消']] as const){const target=nodes.findIndex(x=>x.id===n[key]);if(target<0)errors.push(`第 ${i+1} 步购买页：请选择${label}后的去向。`);else if(isOnboardingPage(nodes[target].page)&&nodes[target].page!=='name')errors.push(`第 ${i+1} 步购买页：分支只能进入资料采集模块起点，不能跳入模块内部。`);else if(target<=i)errors.push(`第 ${i+1} 步购买页：${label}分支须指向后续节点，不能循环或重入。`)}
 if(errors.length)return [...new Set(errors)]
 const visited=new Set<string>(),reachable=new Set<string>()
 const walk=(i:number,auth:boolean,lesson:boolean,payment:boolean,paid:boolean)=>{
  const state=`${i}-${auth}-${lesson}-${payment}-${paid}`;if(visited.has(state))return;visited.add(state)
  const n=nodes[i];if(!n)return;reachable.add(n.id)
  if(n.page==='auth'){if(g.standard==='EXPERIENCE_FIRST'&&(!payment||!lesson&&!paid))errors.push('先体验付费再登录注册：到达注册登录前须经过购买页；未支付成功的路径还须先完成体验课。');auth=true}
  if(n.page==='lesson'){if(g.standard==='REGISTER_FIRST'&&!auth)errors.push('体验前必须完成注册登录。');lesson=true}
  if(n.page==='paywall')payment=true
  if(n.page==='home'){if(!auth)errors.push('分支不能绕过注册登录直接进入首页。');if(!lesson&&!paid)errors.push('未支付成功的分支不能绕过体验课直接结束流程。');return}
  if(n.page==='paywall'){walk(nodes.findIndex(x=>x.id===n.successTo),auth,lesson,payment,true);if(!paid)walk(nodes.findIndex(x=>x.id===n.failureTo),auth,lesson,payment,false)}else walk(i+1,auth,lesson,payment,paid)
 }
 walk(0,false,false,false,false)
 if(nodes.some(n=>!reachable.has(n.id)))errors.push('存在所有分支都不会到达的节点，请调整去向或移除该节点。')
 return [...new Set(errors)]
}
export type TraceStep={id:string;page:string;event:'show'|'success'|'failure'|'skip-paid'|'waiting';nextId?:string}
export function simulateFlow(g:FlowGraph,outcomes:Record<string,'success'|'failure'|'pending'>={},alreadyPaid=false):TraceStep[]{
 if(validateFlow(g).length)return []
 const trace:TraceStep[]=[],seen=new Set<string>();let i=0,paid=alreadyPaid
 while(i>=0&&i<g.nodes.length){const n=g.nodes[i];if(seen.has(n.id))break;seen.add(n.id)
  if(n.page==='paywall'){
   if(paid){trace.push({id:n.id,page:n.page,event:'skip-paid',nextId:n.successTo});i=g.nodes.findIndex(x=>x.id===n.successTo);continue}
   const outcome=outcomes[n.id]??'failure';if(outcome==='pending'){trace.push({id:n.id,page:n.page,event:'waiting'});break}
   if(outcome==='success')paid=true;const nextId=outcome==='success'?n.successTo:n.failureTo
   trace.push({id:n.id,page:n.page,event:outcome,nextId});i=g.nodes.findIndex(x=>x.id===nextId)
  }else{trace.push({id:n.id,page:n.page,event:'show'});i++;}
 }
 return trace
}
export function serializeFlow(g:FlowGraph){const pages:Record<string,string>={value:'app.value',auth:'app.login',name:'app.onboarding',age:'app.onboarding',level:'app.onboarding',goal:'app.onboarding',teacher:'app.teacher_select',lesson:'app.trial_lesson',report:'app.lesson_report',plan:'app.study_plan',paywall:'app.paywall_main',home:'app.home'};return {
 prototype_contract_version:2,standard:g.standard,start_node_id:g.nodes[0]?.id,end_node_id:g.nodes[g.nodes.length-1]?.id,
 policies:{skip_all_paywalls_after_payment_success:true,payment_pending:'WAIT'},
 nodes:g.nodes.map((n,i)=>({node_id:n.id,page_key:pages[n.page],page_sub_key:['name','age','level','goal'].includes(n.page)?`app.onboarding.${n.page}`:'',...(n.page==='paywall'?{on_success:n.successTo,on_failure_or_cancel:n.failureTo,on_already_paid:n.successTo}:{next_node_id:g.nodes[i+1]?.id??null})}))
}}
