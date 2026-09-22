/** Product V0.4. Authentication and payment exit handling are client policies. */
export type FlowStandard = 'REGISTER_FIRST' | 'EXPERIENCE_FIRST'
export type FlowNode = { id:string; page:string; configRef?:string; entitlement?:'PRO'|'MAX'; successTo?:string; failureTo?:string }
export type FlowGraph = { standard:FlowStandard; nodes:FlowNode[]; skipPaywallAfterSuccess:true }
export const flowStandards = [
 {id:'app.flow.register_first',standard:'REGISTER_FIRST' as const,name:'先注册，再体验'},
 {id:'app.flow.experience_first',standard:'EXPERIENCE_FIRST' as const,name:'先体验，支付后注册'},
 {id:'app.flow.double_paywall',standard:'EXPERIENCE_FIRST' as const,name:'课前和课后各一次购买页'},
]
export const flowPages = ['value','auth','name','age','level','goal','teacher','lesson','report','plan','paywall','home']
export const onboardingPages = ['name','age','level','goal']
export const isOnboardingPage = (page:string) => onboardingPages.includes(page)
export type FlowUnit = { nodes:FlowNode[]; onboarding:boolean }
export function flowUnits(nodes:FlowNode[]):FlowUnit[] {const units:FlowUnit[]=[];for(const n of nodes){const previous=units[units.length-1];if(isOnboardingPage(n.page)&&previous?.onboarding)previous.nodes.push(n);else units.push({nodes:[n],onboarding:isOnboardingPage(n.page)})}return units}
export function onboardingErrors(nodes:FlowNode[]):string[]{const first=nodes.findIndex(n=>isOnboardingPage(n.page)),selected=nodes.filter(n=>isOnboardingPage(n.page));return first>=0&&selected.length===4&&onboardingPages.every((page,i)=>nodes[first+i]?.page===page)?[]:['资料采集为必需的完整模块，须按「孩子称呼 → 孩子年龄 → 英语水平 → 学习目标」连续展示。']}
export function moveFlowUnit(nodes:FlowNode[],index:number,delta:number):FlowNode[]{const units=flowUnits(nodes),to=index+delta;if(index<=0||index>=units.length-1||to<=0||to>=units.length-1)return nodes;[units[index],units[to]]=[units[to],units[index]];return sequential(units.flatMap(u=>u.nodes))}
export function restoreOnboarding(nodes:FlowNode[],id:()=>string):FlowNode[]{const first=nodes.findIndex(n=>isOnboardingPage(n.page)),module=onboardingPages.map(page=>nodes.find(n=>n.page===page)??{id:id(),page});const clean=nodes.filter(n=>!isOnboardingPage(n.page));clean.splice(first<0?1:Math.min(first,clean.length-1),0,...module);return sequential(clean)}
export function sequential(nodes:FlowNode[]):FlowNode[]{return nodes.map((n,i)=>n.page==='paywall'?{...n,successTo:nodes[i+1]?.id,failureTo:nodes[i+1]?.id}:n)}
export function makeFlow(pages:string[],standard:FlowStandard):FlowGraph {let count=0;const nodes=pages.map((page,i)=>({id:`step-${i+1}`,page:page.startsWith('paywall')?'paywall':page,...(page.startsWith('paywall')?{configRef:`purchase-${++count}`,entitlement:'PRO' as const}:{})}));return {standard,nodes:sequential(nodes),skipPaywallAfterSuccess:true}}
export function flowStandard(id:string):FlowStandard{return id.endsWith('register_first')?'REGISTER_FIRST':'EXPERIENCE_FIRST'}
export function validateFlow(g:FlowGraph):string[]{
 const nodes=g.nodes,errors:string[]=onboardingErrors(nodes);if(!nodes.length)return ['请至少配置一个流程节点。'];
 if(!['REGISTER_FIRST','EXPERIENCE_FIRST'].includes(g.standard))errors.push('请选择流程标准。');
 if(new Set(nodes.map(n=>n.id)).size!==nodes.length||nodes.some(n=>!n.id))errors.push('流程节点标识不能为空或重复。');
 if(nodes.some(n=>!flowPages.includes(n.page)))errors.push('流程包含未支持的页面。');
 if(nodes[nodes.length-1]?.page!=='home'||nodes.slice(0,-1).some(n=>n.page==='home'))errors.push('首页必须且只能作为终点。');
 if(g.standard==='REGISTER_FIRST'&&(nodes[0].page!=='auth'||nodes.filter(n=>n.page==='auth').length!==1))errors.push('登录前置方案仅在起点配置一次前置注册登录。');
 if(g.standard==='EXPERIENCE_FIRST'){if(nodes[0].page!=='value')errors.push('登录后置方案以首启价值页为起点。');if(nodes.some(n=>n.page==='auth'))errors.push('后置登录由会员游客规则自动触发，不放入流程模块。');}
 if(nodes.filter(n=>n.page==='value').length>(g.standard==='EXPERIENCE_FIRST'?1:0))errors.push('首启价值页仅用作登录后置方案的起点。');
 for(const page of ['teacher','lesson','report','plan'])if(nodes.filter(n=>n.page===page).length>1)errors.push('仅购买页支持重复放置，其他业务模块不可重复。');
 const profileEnd=nodes.findIndex(n=>n.page==='goal'),lesson=nodes.findIndex(n=>n.page==='lesson');
 nodes.forEach((n,i)=>{if(['teacher','plan','lesson','home'].includes(n.page)&&(profileEnd<0||i<=profileEnd))errors.push(`${({teacher:'选老师',plan:'学习计划',lesson:'体验课',home:'首页'} as Record<string,string>)[n.page]}必须位于完整资料采集与定级之后。`);if(n.page==='report'&&(lesson<0||i<=lesson))errors.push('完课报告必须位于对应体验课之后。');if(n.page==='paywall'){if(!n.configRef)errors.push('购买节点须关联页面内容。');if(!['PRO','MAX'].includes(n.entitlement??''))errors.push('请选择购买页对应权益。');for(const key of ['successTo','failureTo'] as const)if(n[key]&&n[key]!==nodes[i+1]?.id)errors.push('购买成功或最终关闭后须继续下一模块，不能自定义跳过依赖。');}});
 return [...new Set(errors)]
}
export type Outcome='success'|'failure'|'closed'|'pending'|'cancel'|'restore'
export type TraceStep={id:string;page:string;event:'show'|'success'|'failure'|'skip-paid'|'waiting'|'login'|'stay';nextId?:string}
export function simulateFlow(g:FlowGraph,outcomes:Record<string,Outcome>={},alreadyPaid:boolean|'PRO'|'MAX'=false):TraceStep[]{
 if(validateFlow(g).length)return [];const trace:TraceStep[]=[];let entitlement=alreadyPaid===true?'MAX':alreadyPaid||'',guest=g.standard==='EXPERIENCE_FIRST';
 if(guest&&entitlement){trace.push({id:'auto-login-entry',page:'auth-after',event:'login'});guest=false;}
 for(const [i,n] of g.nodes.entries()){
  const nextId=g.nodes[i+1]?.id;if(n.page!=='paywall'){trace.push({id:n.id,page:n.page,event:'show',nextId});continue;}
  if(entitlement==='MAX'||entitlement===n.entitlement){trace.push({id:n.id,page:n.page,event:'skip-paid',nextId});continue;}
  const outcome=outcomes[n.id]??'closed';if(outcome==='pending'||outcome==='cancel'){trace.push({id:n.id,page:n.page,event:outcome==='pending'?'waiting':'stay'});break;}
  if(outcome==='success'||outcome==='restore'){entitlement=n.entitlement??'PRO';trace.push({id:n.id,page:n.page,event:'success',nextId});if(guest){trace.push({id:`auto-login-${n.id}`,page:'auth-after',event:'login',nextId});guest=false;}}else trace.push({id:n.id,page:n.page,event:'failure',nextId});
 }
 return trace
}
export function serializeFlow(g:FlowGraph){const pages:Record<string,string>={value:'app.value',auth:'app.login.pre',name:'app.onboarding',age:'app.onboarding',level:'app.onboarding',goal:'app.onboarding',teacher:'app.teacher_select',lesson:'app.trial_lesson',report:'app.lesson_report',plan:'app.study_plan',paywall:'app.paywall_main',home:'app.home'};return {product_contract:'PRD-V0.4',start_page_key:pages[g.nodes[0]?.page],end_page_key:'app.home',steps:g.nodes.map(n=>({node_id:n.id,page_key:pages[n.page],...(isOnboardingPage(n.page)?{page_sub_key:`app.onboarding.${n.page}`}:{ }),...(n.page==='paywall'?{page_config_ref:n.configRef,required_entitlement:n.entitlement}:{})})),policies:{member_guest_requires_login:true,payment_exit:'AFTER_RETENTION_AND_CONSULTATION',skip_paywall:'MATCHING_ENTITLEMENT'}}}
