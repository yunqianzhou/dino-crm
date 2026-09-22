import { englishDefaults } from './appProductCopy'
import { makeFlow, flowStandard, validateFlow, serializeFlow } from './appFlowConfig'
import type { FlowGraph } from './appFlowConfig'
import { devicePlatforms, platformOverlap, clone, makeId, newPlan, templates, validVersion, versionMatches, versionRangeExists } from './abTestConfig'
import type { Plan, Platform, Target, VersionCondition } from './abTestConfig'
import { defaultPageDetails, pageDetails, validAssetSource } from './abPageConfig'
import type { PageDetails } from './abPageConfig'

export const APP_CONFIG_KEY = 'dinoai_app_config_workbench_product_v4'
export type Kind = 'DIRECT' | 'EXPERIMENT'
export type Slot = { id: string; page: string; node: string; name: string; section: string; copy?: string[]; texts?: string[]; assets?: string[]; lists?: string[]; settings?: string[]; pending?: string; flow?: boolean; members?: boolean }
const slot = (node: string, page: string, id: string, name: string, section: string, fields: Partial<Slot> = {}): Slot => ({ node, page, id, name, section, ...fields })
const button = (node: string, page: string, key: string) => slot(node, page, key, '继续按钮', 'button', { copy: ['button', 'animation'] })
export const registry: Slot[] = [
 slot('value','首启价值页','app.value.slideshow','宣传图文轮播','hero',{lists:['slides']}),
 slot('value','首启价值页','app.value.new_user_button','新用户按钮','button',{copy:['button','animation']}),
 slot('value','首启价值页','app.value.existing_account_entry','已有账号入口','account',{texts:['accountHint','accountAction'],settings:['accountAnimation']}),
 slot('value','首启价值页','app.value.background','页面背景','bg',{assets:['background']}),
 slot('auth','注册登录','app.login.slideshow','卖点图文轮播','slides',{lists:['slides']}),
 slot('auth','前置注册登录','app.login.methods','登录方式与动效','login',{settings:['mainMethods','subMethods','animation_google','animation_apple','animation_phone','animation_facebook','animation_kakao']}),
 slot('auth','注册登录','app.login.background','页面背景','bg',{assets:['background']}),
 slot('auth-after','后置注册登录','app.login.post.hero','角色插画、标题与正文','post',{copy:['title','body'],assets:['hero']}),
 slot('auth-after','后置注册登录','app.login.post.methods','登录方式与动效','login',{settings:['mainMethods','subMethods','animation_google','animation_apple','animation_phone','animation_facebook','animation_kakao']}),
 slot('auth-after','后置注册登录','app.login.post.background','页面背景','bg',{assets:['background']}),
 ...(['name','age','level','goal'] as const).flatMap(node => {
  const page = ({name:'孩子称呼',age:'孩子年龄',level:'英语水平',goal:'学习目标'})[node]
  const key = `app.onboarding.${node}`
  return [slot(node,page,`${key}.question_title`,'问题标题','copy',{copy:['title']}),slot(node,page,`${key}.question_body`,'问题说明','copy',{copy:['body']}),
   ...(node==='name' ? [slot(node,page,`${key}.input_placeholder`,'输入提示','name',{texts:['placeholder']}),slot(node,page,`${key}.recommended_names`,'推荐名称','name',{lists:['names']}),slot(node,page,`${key}.dino_guide`,'Dino 引导与语音','guide',{texts:['guide'],assets:['guide','guideAudio'],settings:['showGuide']})] : [slot(node,page,`${key}.options`,'选项文案与内容','options',{lists:['options'],...(node==='goal'?{settings:['selectionMode']}:{ }),pending: node==='goal'?'仅选择既有演示目标；正式选项值由 APP 字典提供，不支持随意生成业务编号。':'编号、数量、顺序与默认状态由 APP 业务字典决定；当前为示例。'})]),button(node,page,`${key}.continue_button`),slot(node,page,`${key}.background`,'页面背景','bg',{assets:['background']})]
 }),
 ...(['phone','pad'] as const).flatMap(device=>(['regular','promo'] as const).flatMap(scene=>{
  const node=`paywall-${device}-${scene}`,page=`主购买页 · ${device==='pad'?'Pad':'手机'} · ${scene==='promo'?'Promo':'普通'}`,key=`app.paywall_main.${device}.${scene}`;
  return [slot(node,page,`${key}.slideshow`,'介绍图文','slides',{lists:['slides']}),slot(node,page,`${key}.members`,'会员档位与权益','members',{members:true}),slot(node,page,`${key}.products`,'商品与样式','products',{texts:['discountLabel'],settings:['productMode','skus','defaultSku','nameSize','nameColor','priceSize','priceColor','strikethrough','discountEnabled','memberTypes','periods']}),button(node,page,`${key}.purchase_button`),slot(node,page,`${key}.offer`,'活动资源位','offer',{texts:['offerTitle'],assets:['offer'],settings:['offerMode']})]
 })),
 ...(['retention-promo','retention-regular'] as const).flatMap(node => [
  slot(node,node==='retention-promo'?'挽留支付 · Promo':'挽留支付 · 普通',`${node}.tag`,'宣传标签','copy',{texts:['badge'],pending:'Promo / 普通使用同一页面；正式场景维度与配置键映射待统一。'}),
  slot(node,node==='retention-promo'?'挽留支付 · Promo':'挽留支付 · 普通',`${node}.title`,'标题与正文','copy',{copy:['title','body']}),
  slot(node,node==='retention-promo'?'挽留支付 · Promo':'挽留支付 · 普通',`${node}.activity`,'活动资源','offer',{texts:['offerTitle'],assets:['offer'],settings:['offerMode']}),
  slot(node,node==='retention-promo'?'挽留支付 · Promo':'挽留支付 · 普通',`${node}.products`,'商品配置','products',{settings:['period','productMode','skus','memberTypes','periods'],pending:'商品字段尚未定稿，当前仅演示周期或已上线商品选择。'}),
  button(node,node==='retention-promo'?'挽留支付 · Promo':'挽留支付 · 普通',`${node}.button`),
 ]),
 ...templates.map(t=>slot('flow','首次使用流程',`app.flow.${t.id.replace(/-/g,'_')}`,t.name,'flow',{flow:true})),
]
export type UnitContent = { translationSource?:Record<string,string>; baseLanguage?:string; copy: Record<string, string>; details: PageDetails; translations: Plan['translations']; pageTranslations: Plan['pageTranslations']; steps?: string[]; flow?:FlowGraph }
export type Definition = { id: string; slotId: string; name: string; description: string; kind: Kind; status: 'ENABLED'|'DISABLED'; createdAt: string }
export type ConfigVersion = { id: string; definitionId: string; no: number; minVersion: string; contractVersion: number; content: UnitContent; actor: string; at: string; summary: string; protocol?: ReturnType<typeof serializeContent> }
export type Audience = { countries: string[]; platforms: Platform[]; cities: string[]; channels: string[]; versions?:VersionCondition[] }
export type Release = { id:string; name:string; definitionId:string; audience:Audience; priority:number; startAt:string; endAt:string; status:'DRAFT'|'ACTIVE'|'ENDED'|'TERMINATED' }
export type ExperimentStatus = 'DRAFT'|'READY'|'RUNNING'|'PAUSED'|'ENDED'|'TERMINATED'
export type ConfigBinding = { definitionId: string; versionId: string }
export type Group = { id: string; name: string; weight: number; control: boolean; bindings: ConfigBinding[] }
export type AppExperiment = { id:string; name:string; audience:Audience; minVersion:string; status:ExperimentStatus; groups:Group[]; startedAt:string; endedAt:string; salt:string; traffic?:number; scheduledStartAt?:string; scheduledEndAt?:string; testPages?:string[]; sourceExperimentId?:string; legacyTraffic?:number }
export type Audit = { id:string; entityId:string; at:string; actor:string; action:string; snapshot:Definition|ConfigVersion|Release|AppExperiment }
export type AppConfigStore = { schema:3; configDrafts?: { definition:Definition; content:UnitContent; minVersion:string; summary:string }[]; definitions:Definition[]; versions:ConfigVersion[]; releases:Release[]; experiments:AppExperiment[]; audit:Audit[] }
export const audience = ():Audience => ({countries:['SA'],platforms:['Android'],cities:[],channels:[]})
export const audienceTarget = (a:Audience,minVersion='1.8.0'):Target => ({countries:a.countries,platforms:a.platforms,versions:scopeVersions(a,minVersion)})
// Old records without version conditions keep their original minimum-version scope.
export function scopeVersions(a:Audience,minVersion='1.8.0'):VersionCondition[]{
 const requested=a.versions??[{operator:'>=',value:minVersion} as VersionCondition]
 if(!validVersion(minVersion))return requested
 return versionRangeExists([...requested,{operator:'<',value:minVersion}])?[...requested,{operator:'>=',value:minVersion}]:requested
}
export function versionScopeErrors(a:Audience,minVersion:string):string[]{
 if(!validVersion(minVersion))return ['内容最低兼容版本无效。']
 if(a.versions&&!versionRangeExists(a.versions))return ['App 版本条件无效或范围没有交集，请检查版本号及上下界。']
 if(!versionRangeExists([...scopeVersions(a,minVersion),{operator:'>=',value:minVersion}]))return [`版本范围与内容兼容要求没有交集；当前内容最低支持 ${minVersion}。`]
 return []
}
const scopedAudience=(a:Audience,minVersion:string):Audience=>({...a,versions:scopeVersions(a,minVersion)})
const releaseMinimum=(store:AppConfigStore,r:Release)=>store.versions.filter(v=>v.definitionId===r.definitionId).map(v=>v.minVersion).sort(compareVersions)[0]??'0.0.0'
const releaseAudience=(store:AppConfigStore,r:Release)=>scopedAudience(r.audience,releaseMinimum(store,r))
export const getSlot = (id:string):Slot => {const base=id.split('@')[0];const old:Record<string,string>={'app.paywall_main.slideshow':'app.paywall_main.phone.regular.slideshow','app.paywall_main.member_plan_gourp':'app.paywall_main.phone.regular.members','app.paywall_main.purchase_button':'app.paywall_main.phone.regular.purchase_button','app.paywall.main.limited_offer':'app.paywall_main.phone.regular.offer'};const s=registry.find(s=>s.id===(old[base]??base));if(!s)throw Error(`未知配置项：${id}`);return {...s,id};}
export const scopeOf=(s:Slot)=>s.flow?'flow':s.node.startsWith('paywall')?'paywall':s.node;
export const testPageOptions=[{value:'flow',label:'首次使用流程'},{value:'value',label:'首启价值页'},{value:'auth',label:'前置注册登录'},{value:'auth-after',label:'后置注册登录'},{value:'name',label:'孩子称呼'},{value:'age',label:'孩子年龄'},{value:'level',label:'英语水平'},{value:'goal',label:'学习目标'},{value:'paywall',label:'主购买页'},{value:'retention-promo',label:'Promo 挽留'},{value:'retention-regular',label:'普通挽留'}];
export const experimentState=(e:AppExperiment,now=Date.now()):string=>['RUNNING','PAUSED'].includes(e.status)&&e.scheduledEndAt&&Date.parse(e.scheduledEndAt)<=now?'ENDED':e.status==='RUNNING'&&e.scheduledStartAt&&Date.parse(e.scheduledStartAt)>now?'SCHEDULED':e.status;

export function appPlan(node:string):Plan {
 const plan=newPlan();if(node.startsWith('paywall'))plan.copy[node]=clone(plan.copy.paywall); const d=pageDetails(plan,node)
 if(node==='value'){d.lists.slides=[{id:'slide-1',label:plan.copy.value.title,body:plan.copy.value.body,asset:{mode:'inherit'}}];d.assets.background={mode:'inherit'}}
 if(node==='auth'){d.settings.mainMethods=['google','apple'];d.settings.subMethods=['phone','facebook']}
 if(node==='name')d.assets.guideAudio={mode:'inherit'}
 if(node==='auth-after'){plan.copy[node]={title:'Keep your progress safe',body:'Log in or sign up to continue.',button:'Continue',animation:'static'};d.assets.hero={mode:'inherit'};d.assets.background={mode:'inherit'};d.settings.mainMethods=['google','apple'];d.settings.subMethods=['phone','facebook'];}
 if(node==='goal')d.settings.selectionMode='multiple';
 if(node.startsWith('paywall')){d.texts.discountLabel='Limited-time discount';d.settings.discountEnabled=false;d.settings.memberTypes=['PRO','MAX'];d.settings.periods=['MONTH','YEAR'];}
 if(node==='retention-promo'){d.settings.memberTypes=['PRO','MAX'];d.settings.periods=['MONTH','YEAR'];}
 plan.pages={...plan.pages,[node]:d};return englishDefaults(plan,node)
}
export function extractContent(plan:Plan,s:Slot):UnitContent {
 const d=pageDetails(plan,s.node);const pick=(obj:Record<string,any>,keys:string[]=[])=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,clone(obj[k])]))
 const keys=[...(s.copy??[]),...(s.texts??[])]
 const relevant=(k:string)=>keys.includes(k)||(s.lists??[]).some(list=>k.startsWith(`${list}.`))||(s.members&&k.startsWith('member.'))
 const details:PageDetails={texts:pick(d.texts,s.texts),assets:pick(d.assets,s.assets),lists:pick(d.lists,s.lists),settings:pick(d.settings,s.settings)}
 if(s.members) details.members=clone(d.members??defaultMembers())
 return {baseLanguage:plan.baseLanguage??'zh',copy:pick(plan.copy[s.node]??{},s.copy),details,translations:Object.fromEntries(Object.entries(plan.translations).map(([lang,pages])=>[lang,{[s.node]:pick(pages[s.node]??{},s.copy)}])) as Plan['translations'],pageTranslations:Object.fromEntries(Object.entries(plan.pageTranslations??{}).map(([lang,pages])=>[lang,{[s.node]:Object.fromEntries(Object.entries(pages[s.node]??{}).filter(([k])=>relevant(k)))}]))}
}
export function contentPlan(content:UnitContent,s:Slot,base=appPlan(s.node)):Plan {
 const plan=clone(base);plan.baseLanguage=content.baseLanguage??'zh';const d=pageDetails(plan,s.node)
 plan.copy[s.node]={...plan.copy[s.node],...content.copy}
 plan.pages={...plan.pages,[s.node]:{texts:{...d.texts,...content.details.texts},assets:{...d.assets,...content.details.assets},lists:{...d.lists,...content.details.lists},settings:{...d.settings,...content.details.settings},...((content.details.members??d.members)?{members:content.details.members??d.members}:{})}}
 for(const [lang,pages] of Object.entries(content.translations)){plan.translations[lang]={...plan.translations[lang],[s.node]:{...plan.translations[lang]?.[s.node],...pages[s.node]}}}
 for(const [lang,pages] of Object.entries(content.pageTranslations??{})){plan.pageTranslations={...plan.pageTranslations,[lang]:{...plan.pageTranslations?.[lang],[s.node]:{...plan.pageTranslations?.[lang]?.[s.node],...pages[s.node]}}}}
 return plan
}
export function initialContent(s:Slot):UnitContent {
 const c=extractContent(appPlan(s.node),s)
 if(s.flow)c.steps=clone(templates.find(t=>`app.flow.${t.id.replace(/-/g,'_')}`===s.id)?.nodes??templates[0].nodes).map(x=>x.startsWith('paywall')?'paywall':x)
 if(s.flow)c.flow=makeFlow(c.steps??[],flowStandard(s.id))
 return c
}
export type Member = { benefitHeading?:string; id:number; mode:'table'|'asset'; asset: import('./abPageConfig').Asset; columns:{id:string;label:string}[]; rows:{id:string;label:string;values:Record<string,boolean|string>}[]; cycles:{id:'MONTH'|'YEAR';label:string;priceSize:number;priceColor:string;original:boolean}[] }
export function defaultMembers():Member[] {return [1,2].map(id=>({id,benefitHeading:'Benefits',mode:'table',asset:{mode:'inherit'},columns:[{id:'pro',label:'Pro'},{id:'max',label:'Max'}],rows:[{id:'ai_lesson',label:'AI lessons',values:{pro:true,max:true}},{id:'speaking_practice',label:'Speaking practice',values:{pro:false,max:true}}],cycles:[{id:'MONTH',label:'Monthly',priceSize:16,priceColor:'#27344a',original:false},{id:'YEAR',label:'Yearly',priceSize:16,priceColor:'#27344a',original:true}]}))}
export const latestVersion=(store:AppConfigStore,id:string)=>store.versions.filter(v=>v.definitionId===id).sort((a,b)=>b.no-a.no)[0]
export function compatibleVersion(store:AppConfigStore,id:string,appVersion:string) {return store.versions.filter(v=>v.definitionId===id&&versionMatches(appVersion,[{operator:'>=',value:v.minVersion}])).sort((a,b)=>compareVersions(b.minVersion,a.minVersion)||b.no-a.no)[0]}
export const compareVersions=(a:string,b:string)=>{const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return 0}
export function validateContent(s:Slot,c:UnitContent):string[] {
 const errors:string[]=[];const d=c.details
 const required=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim())errors.push(`请填写${label}。`)}
 for(const [key,text] of Object.entries({...c.copy,...d.texts}))if(key!=='animation'&&/\{[^}]+\}/.test(text)&&/\{(?!(?:nickname|level|昵称|当前定级)\})[^}]+\}/.test(text))errors.push('仅支持昵称与当前定级变量。')
 if(s.lists?.includes('slides')){if(!d.lists.slides?.length)errors.push('图文轮播至少保留一组。')}
 if(s.copy)for(const key of s.copy)if(key==='animation'){if(!['static','breathe','shake'].includes(c.copy[key]))errors.push('请选择静态、呼吸或抖动动效。')}else if(typeof c.copy[key]!=='string')errors.push('文案格式无效。')
 if(s.texts?.includes('badge'))required(d.texts.badge,'宣传标签（固定展示）');
 if(s.section==='login'){const all=[...(d.settings.mainMethods as string[]??[]),...(d.settings.subMethods as string[]??[])];if(!all.length)errors.push('至少选择一种登录方式。');if(all.some(id=>!['google','apple','phone','facebook','kakao'].includes(id)))errors.push('登录方式不在现有能力清单中。');if(Object.entries(d.settings).some(([key,v])=>key.startsWith('animation_')&&!['static','breathe','shake'].includes(String(v))))errors.push('登录按钮动效无效。');if(new Set(all).size!==all.length)errors.push('主次登录方式不能重复。')}
 if(d.settings.accountAnimation&&!['static','breathe','shake'].includes(String(d.settings.accountAnimation)))errors.push('请选择合法的登录入口动效。')
 if(s.lists?.includes('options')){const ids=d.lists.options?.map(x=>x.id)??[];if(!ids.length||new Set(ids).size!==ids.length)errors.push('选项不能为空或重复。');if(s.node==='age'||s.node==='level'){if(JSON.stringify(ids)!==JSON.stringify(defaultPageDetails(s.node).lists.options.map(x=>x.id)))errors.push('年龄和水平的选项编号、数量及顺序不能修改。')}else if(ids.some(id=>!defaultPageDetails('goal').lists.options.some(x=>x.id===id)))errors.push('学习目标必须选择既有业务选项。');for(const x of d.lists.options??[])required(x.label,'选项文案')}
 if(s.section==='products'){
  if(s.node==='retention-promo'&&!['monthly','quarterly','yearly'].includes(String(d.settings.period)))errors.push('请选择有效订阅周期。');
  if(s.node!=='retention-promo'&&d.settings.productMode==='custom'){const ids=d.settings.skus as string[]??[];if(!ids.length||new Set(ids).size!==ids.length)errors.push('商品列表不能为空或重复。');if(s.node.startsWith('paywall')&&!ids.includes(String(d.settings.defaultSku)))errors.push('默认套餐须在已选商品列表内。');}
  if(s.node.startsWith('paywall')){for(const key of ['nameSize','priceSize'])if(!Number.isFinite(d.settings[key])||Number(d.settings[key])<10||Number(d.settings[key])>36)errors.push('商品字号须为 10–36。');for(const key of ['nameColor','priceColor'])if(!/^#[0-9a-f]{6}$/i.test(String(d.settings[key])))errors.push('请选择有效商品颜色。');if(d.settings.discountEnabled&&!d.texts.discountLabel?.trim())errors.push('开启折扣标签时请填写文案。');}
 }
 const assets=[...Object.entries(d.assets),...Object.values(d.lists).flatMap(xs=>xs.filter(x=>x.asset).map(x=>[x.id,x.asset!] as const))]
 for(const [key,a] of assets){if(key==='guide'||key==='guideAudio'){if(d.settings.showGuide===false)continue}if(key==='offer'&&d.settings.offerMode!=='asset')continue;if(a.mode==='custom'&&!validAssetSource(a.src??''))errors.push('请上传素材或填写有效的 HTTPS 资源地址。')}
 if(s.members){const members=d.members??[];if(!members.length||new Set(members.map(m=>m.id)).size!==members.length)errors.push('会员档位不能为空或重复。');for(const m of members){if(![1,2].includes(m.id))errors.push('会员档位仅支持 Pro / Max。');if(!m.cycles.length||new Set(m.cycles.map(c=>c.id)).size!==m.cycles.length)errors.push('订阅周期不能为空或重复。');for(const cy of m.cycles){required(cy.label,'周期名称');if(!['MONTH','YEAR'].includes(cy.id)||!Number.isFinite(cy.priceSize)||cy.priceSize<=0||!/^#[0-9a-f]{6}$/i.test(cy.priceColor))errors.push('请检查周期、价格字号与颜色。')}if(m.mode==='asset'&&(m.asset.mode==='custom'&&!validAssetSource(m.asset.src??'')))errors.push('请配置会员档位资源图片。');if(m.mode==='table'){const columns=m.columns.map(x=>x.id);if(!columns.length||new Set(columns).size!==columns.length||!m.rows.length||new Set(m.rows.map(x=>x.id)).size!==m.rows.length)errors.push('权益表列和行不能为空或重复。');for(const row of m.rows){required(row.label,'权益名称');if(columns.some(key=>!['boolean','string'].includes(typeof row.values[key])))errors.push('每项权益必须设置各列的包含状态。')}}}}
 if(s.flow&&c.flow){if(c.flow.standard!==flowStandard(s.id))errors.push('流程标准与当前方案不一致，请重新选择标准。');errors.push(...validateFlow(c.flow));return [...new Set(errors)]}
 if(s.flow)errors.push(...validateFlow(makeFlow(c.steps??[],flowStandard(s.id))));
 if(s.node==='goal'&&s.settings?.includes('selectionMode')&&!['single','multiple'].includes(String(d.settings.selectionMode)))errors.push('请选择学习目标的单选或多选方式。');
 return Array.from(new Set(errors))
}
export const translationLanguages=['zh','ar','ko','vi','ms'];
export function contentTexts(c:UnitContent):Record<string,string>{const texts:Record<string,string>={...c.details.texts};for(const [k,v] of Object.entries(c.copy))if(k!=='animation')texts[k]=v;for(const [list,rows]of Object.entries(c.details.lists))if(list!=='names')for(const r of rows){texts[`${list}.${r.id}.label`]=r.label;if(r.body!==undefined)texts[`${list}.${r.id}.body`]=r.body;}for(const m of c.details.members??[]){texts[`member.${m.id}.heading`]=m.benefitHeading??'Benefits';for(const col of m.columns)texts[`member.${m.id}.column.${col.id}`]=col.label;for(const row of m.rows){texts[`member.${m.id}.row.${row.id}`]=row.label;for(const [col,val]of Object.entries(row.values))if(typeof val==='string'&&/[a-zA-Z\u4e00-\u9fff]/.test(val))texts[`member.${m.id}.row.${row.id}.value.${col}`]=val;}for(const cy of m.cycles)texts[`member.${m.id}.cycle.${cy.id}`]=cy.label;}return texts}
export function changedTexts(s:Slot,c:UnitContent){const defaults=contentTexts(initialContent(s));return Object.entries(contentTexts(c)).filter(([key,text])=>text.trim()&&text!==defaults[key])}
export function translatedText(c:UnitContent,node:string,lang:string,key:string){return c.pageTranslations?.[lang]?.[node]?.[key]??(c.translations[lang]?.[node] as unknown as Record<string,string>)?.[key]??''}
export function translationErrors(s:Slot,c:UnitContent):string[]{if(s.flow)return [];return changedTexts(s,c).flatMap(([key,text])=>{const missing=translationLanguages.filter(l=>!translatedText(c,s.node,l,key).trim());return missing.length?[`修改的文案「${text}」缺少 ${missing.join(' / ')} 译文。`]:c.translationSource?.[key]!==text?[`修改的文案「${text}」需在多语言校对中确认译文。`]:[]})}
export function validateAudience(a:Audience):string[]{return [...(!a.countries.length?['请选择国家。']:[]),...(!a.platforms.length?['请选择终端。']:[]),...(a.versions&&!versionRangeExists(a.versions)?['App 版本条件无效或范围没有交集，请检查版本号及上下界。']:[]),...(a.platforms.some(p=>!['iOS','Android'].includes(p))?['实验终端只支持 iOS / Android；手机与 Pad 在主购买页分别配置。']:[])]}
const intersection=(a:string[],b:string[],wildcard=false)=>!a.length||!b.length||(wildcard&&(a.includes('*')||b.includes('*')))||a.some(x=>b.includes(x))
export function audienceOverlap(a:Audience,b:Audience){return intersection(a.countries,b.countries,true)&&platformOverlap(a.platforms,b.platforms)&&intersection(a.cities,b.cities)&&intersection(a.channels,b.channels)&&versionRangeExists([...(a.versions??[]),...(b.versions??[])])}
export const releaseState=(r:Release,now=Date.now())=>r.status==='ACTIVE'&&r.endAt&&Date.parse(r.endAt)<=now?'ENDED':r.status
export function validateRelease(store:AppConfigStore,r:Release):string[]{const d=store.definitions.find(x=>x.id===r.definitionId);const errors=[...validateAudience(r.audience),...versionScopeErrors(r.audience,releaseMinimum(store,r))];if(!r.name.trim())errors.push('请填写投放名称。');if(!d||d.kind!=='DIRECT'||d.status!=='ENABLED'||!latestVersion(store,d.id))errors.push('请选择有可用版本的启用普通配置。');if(!Number.isFinite(r.priority))errors.push('投放优先级须为数字。');if(r.startAt&&!Number.isFinite(Date.parse(r.startAt))||r.endAt&&!Number.isFinite(Date.parse(r.endAt)))errors.push('投放时间无效。');if(r.startAt&&r.endAt&&Date.parse(r.startAt)>=Date.parse(r.endAt))errors.push('结束时间必须晚于开始时间。');if(r.endAt&&Date.parse(r.endAt)<=Date.now())errors.push('结束时间必须晚于当前时间。');if(d&&store.releases.some(other=>other.id!==r.id&&releaseState(other)==='ACTIVE'&&store.definitions.find(x=>x.id===other.definitionId)?.slotId===d.slotId&&audienceOverlap(releaseAudience(store,r),releaseAudience(store,other))&&Math.max(r.startAt?Date.parse(r.startAt):0,other.startAt?Date.parse(other.startAt):0)<Math.min(r.endAt?Date.parse(r.endAt):Infinity,other.endAt?Date.parse(other.endAt):Infinity)))errors.push('同一配置项存在范围与时间重叠的有效投放，请先结束旧投放或调整范围。');return errors}
export function validateExperiment(store:AppConfigStore,e:AppExperiment):string[]{const errors=[...validateAudience(e.audience),...versionScopeErrors(e.audience,e.minVersion)];if(!e.name.trim())errors.push('请填写实验名称。');if(!validVersion(e.minVersion))errors.push('请填写有效最低 App 版本，如 1.8.0。');if(e.groups.length<2)errors.push('至少设置两个分组。');if(e.groups.filter(g=>g.control).length!==1)errors.push('必须且只能有一个对照组。');if(e.groups.reduce((n,g)=>n+g.weight,0)!==10000||e.groups.some(g=>!Number.isInteger(g.weight)||g.weight<=0))errors.push('组内比例必须大于 0%，合计 100%。');if(new Set(e.groups.map(g=>g.name.trim())).size!==e.groups.length||e.groups.some(g=>!g.name.trim()))errors.push('分组名称不能为空或重复。');if(!e.groups.some(g=>g.bindings.length))errors.push('至少为一个实验组绑定配置版本。');for(const g of e.groups){const slots:string[]=[];for(const b of g.bindings){const d=store.definitions.find(x=>x.id===b.definitionId),v=store.versions.find(x=>x.id===b.versionId&&x.definitionId===b.definitionId);if(!d||d.kind!=='EXPERIMENT'||!v||d.status!=='ENABLED'){errors.push(`${g.name}：绑定版本不可用。`);continue}slots.push(d.slotId);if(validVersion(e.minVersion)&&compareVersions(e.minVersion,v.minVersion)<0)errors.push(`${g.name}：最低 App 版本不能低于「${d.name}」V${v.no} 的 ${v.minVersion}。`);errors.push(...[...validateContent(getSlot(d.slotId),v.content),...translationErrors(getSlot(d.slotId),v.content)].map(x=>`${g.name} / ${d.name}：${x}`))}if(new Set(slots).size!==slots.length)errors.push(`${g.name}：同一配置项不能重复绑定。`)}const scopes=e.testPages??[...new Set(e.groups.flatMap(g=>g.bindings.map(b=>{const d=store.definitions.find(d=>d.id===b.definitionId);return d?scopeOf(getSlot(d.slotId)):''})))];
if(scopes.some(x=>!testPageOptions.some(p=>p.value===x)))errors.push('测试范围包含未知页面。');for(const g of e.groups){const actual=[...new Set(g.bindings.flatMap(b=>{const d=store.definitions.find(d=>d.id===b.definitionId);return d?[scopeOf(getSlot(d.slotId))]:[]}))];if(actual.length!==scopes.length||scopes.some(x=>!actual.includes(x)))errors.push(`${g.name}：所有分组必须覆盖相同测试范围。`);}
if(!scopes.length)errors.push('请选择本实验测试的页面或流程。');
if(!Number.isInteger(e.traffic)||e.traffic!<1||e.traffic!>10000)errors.push('实验总流量须大于 0%，不超过 100%。');
const start=Date.parse(e.scheduledStartAt??''),end=Date.parse(e.scheduledEndAt??'');
if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)errors.push('请选择有效的计划开始/结束时间，结束须晚于开始。');
if(Number.isFinite(end)&&end<=Date.now())errors.push('实验已到期，请复制为新实验后设置新的时间。');
if(store.experiments.some(x=>x.id!==e.id&&['RUNNING','PAUSED','SCHEDULED'].includes(experimentState(x))&&audienceOverlap(scopedAudience(x.audience,x.minVersion),scopedAudience(e.audience,e.minVersion))&&Math.max(start,Date.parse(x.scheduledStartAt??x.startedAt))<Math.min(end,Date.parse(x.scheduledEndAt??'9999-01-01'))&&(x.testPages??testPageOptions.map(p=>p.value)).some(page=>scopes.includes(page))))errors.push('实验的页面/流程、人群和时间与已有实验重叠，请调整范围或终止旧实验。');
return [...new Set(errors)]}
export function record<T extends Audit['snapshot']>(store:AppConfigStore,entity:T,action:string,actor:string):AppConfigStore{return {...store,audit:[...store.audit,{id:makeId(),entityId:entity.id,actor,action,at:new Date().toISOString(),snapshot:clone(entity)}]}}
export function saveVersion(store:AppConfigStore,definition:Definition,content:UnitContent,minVersion:string,actor:string,summary:string):AppConfigStore{
 const existing=store.definitions.find(d=>d.id===definition.id)
 if(existing&&(existing.kind!==definition.kind||existing.slotId!==definition.slotId))throw Error('配置的归属与类型创建后不可修改。')
 if(!definition.name.trim()||!validVersion(minVersion))throw Error('请填写配置名称和有效最低 App 版本。')
 const errors=validateContent(getSlot(definition.slotId),content);if(errors.length)throw Error(errors.join('\n'))
 const version:ConfigVersion={id:makeId(),definitionId:definition.id,no:(latestVersion(store,definition.id)?.no??0)+1,minVersion,contractVersion:1,content:clone(content),actor,summary,at:new Date().toISOString(),protocol:serializeContent(getSlot(definition.slotId),content,`${definition.id}.v${(latestVersion(store,definition.id)?.no??0)+1}`)}
 const next={...store,configDrafts:store.configDrafts?.filter(x=>x.definition.id!==definition.id),definitions:[...store.definitions.filter(x=>x.id!==definition.id),clone(definition)],versions:[...store.versions,version]}
 return record(next,version,`保存 V${version.no}`,actor)
}
export function transitionExperiment(store:AppConfigStore,id:string,status:ExperimentStatus,actor:string):AppConfigStore{
 const e=store.experiments.find(x=>x.id===id);if(!e)throw Error('实验不存在。')
 if(experimentState(e)==='ENDED')throw Error('实验已到期，不能修改或恢复；请复制为新实验。');
 const nexts:Record<ExperimentStatus,ExperimentStatus[]>={DRAFT:['READY'],READY:['DRAFT','RUNNING'],RUNNING:['PAUSED','ENDED','TERMINATED'],PAUSED:['RUNNING','ENDED','TERMINATED'],ENDED:[],TERMINATED:[]}
 if(!nexts[e.status].includes(status))throw Error('当前状态不能执行该操作。')
 if(status==='READY'||status==='RUNNING'){const errors=validateExperiment(store,e);if(errors.length)throw Error(errors.join('\n'))}
 const updated={...clone(e),status,startedAt:status==='RUNNING'&&!e.startedAt?new Date().toISOString():e.startedAt,endedAt:['ENDED','TERMINATED'].includes(status)?new Date().toISOString():e.endedAt}
 return record({...store,experiments:store.experiments.map(x=>x.id===id?updated:x)},updated,`实验${statusLabels[status]}`,actor)
}
export const statusLabels:Record<string,string>={SCHEDULED:'待生效',DRAFT:'草稿',READY:'就绪',RUNNING:'进行中',PAUSED:'已暂停',ENDED:'已结束',TERMINATED:'已终止',ACTIVE:'已生效',ENABLED:'启用',DISABLED:'停用'}
export function relatedExperiments(store:AppConfigStore,id:string,versionId?:string){return store.experiments.filter(e=>e.groups.some(g=>g.bindings.some(b=>b.definitionId===id&&(!versionId||b.versionId===versionId))))}
export function seedAppStore():AppConfigStore{
 let store:AppConfigStore={schema:3,definitions:[],versions:[],releases:[],experiments:[],audit:[]}
 for(const slotId of ['app.login.slideshow','app.login.methods','app.paywall_main.phone.regular.members','app.flow.register_first']){const s=getSlot(slotId);const def:Definition={id:makeId(),slotId,name:`${s.page} · ${s.name}（示例）`,description:'APP 协议示例，可复制创建实验配置。',kind:'DIRECT',status:'ENABLED',createdAt:new Date().toISOString()};store=saveVersion(store,def,initialContent(s),'1.8.0','示例数据','初始示例');store.releases.push({id:makeId(),name:`${s.page}默认投放（示例）`,definitionId:def.id,audience:audience(),priority:0,startAt:'',endAt:'',status:'ACTIVE'})}
 return store
}

export function saveExperimentDraft(store:AppConfigStore,e:AppExperiment,actor:string):AppConfigStore {
 const existing=store.experiments.find(x=>x.id===e.id)
 if(e.status!=='DRAFT'||existing&&existing.status!=='DRAFT')throw Error('实验已冻结，请复制为新实验。')
 return record({...store,experiments:[...store.experiments.filter(x=>x.id!==e.id),clone(e)]},e,'保存实验草稿',actor)
}
export function saveReleaseDraft(store:AppConfigStore,r:Release,actor:string):AppConfigStore {
 const existing=store.releases.find(x=>x.id===r.id)
 if(r.status!=='DRAFT'||existing&&existing.status!=='DRAFT')throw Error('生效投放不可直接修改，请新建投放。')
 return record({...store,releases:[...store.releases.filter(x=>x.id!==r.id),clone(r)]},r,'保存投放草稿',actor)
}
export function activateRelease(store:AppConfigStore,r:Release,actor:string):AppConfigStore {
 const draft=saveReleaseDraft(store,r,actor);const errors=validateRelease(draft,r)
 if(errors.length)throw Error(errors.join('\n'))
 const value={...clone(r),status:'ACTIVE' as const}
 return record({...draft,releases:draft.releases.map(x=>x.id===r.id?value:x)},value,'生效普通投放',actor)
}
export function setDefinitionStatus(store:AppConfigStore,id:string,status:Definition['status'],actor:string):AppConfigStore {
 const d=store.definitions.find(x=>x.id===id);if(!d)throw Error('配置不存在。')
 if(status==='DISABLED'&&(store.releases.some(r=>r.definitionId===id&&releaseState(r)==='ACTIVE')||relatedExperiments(store,id).some(e=>['READY','RUNNING','PAUSED'].includes(e.status))))throw Error('该配置仍有有效投放或就绪／运行／暂停实验引用，请先处理引用关系。')
 const value={...d,status};return record({...store,definitions:store.definitions.map(x=>x.id===id?value:x)},value,status==='ENABLED'?'启用配置':'停用配置',actor)
}
// Prototype serialization keeps business editing text separate from APP-facing keys.
// Local asset refs remain local; official upload and translation services are not connected.
export function serializeContent(s:Slot,c:UnitContent,namespace:string) {
 const baseLanguage=c.baseLanguage??'zh';const dictionary:Record<string,Record<string,string>>={[baseLanguage]:{}};const d=c.details
 const i18n=(field:string,base:string)=>{const key=`${namespace}.${field.replace(/[^\w.-]/g,'_')}`;dictionary[baseLanguage][key]=base;for(const [lang,pages] of Object.entries(c.pageTranslations??{})){const value=pages[s.node]?.[field];if(value!==undefined)(dictionary[lang]??={})[key]=value}for(const [lang,pages] of Object.entries(c.translations)){const value=(pages[s.node] as unknown as Record<string,string>)?.[field];if(value!==undefined)(dictionary[lang]??={})[key]=value}return key}
 const asset=(a?:import('./abPageConfig').Asset)=>a?.mode==='custom'?a.src??'':''
 let config:Record<string,unknown>={}
 if(s.flow&&c.flow)config=serializeFlow(c.flow)
 else if(s.flow){const pageNames:Record<string,string>={value:'app.value',auth:'app.login',name:'app.onboarding',age:'app.onboarding',level:'app.onboarding',goal:'app.onboarding',teacher:'app.teacher_select',lesson:'app.trial_lesson',report:'app.lesson_report',plan:'app.study_plan',paywall:'app.paywall_main',home:'app.home'};const steps=(c.steps??[]).map(node=>({page_key:pageNames[node],page_sub_key:['name','age','level','goal'].includes(node)?`app.onboarding.${node}`:''}));config={start_page_key:steps[0]?.page_key,end_page_key:steps[steps.length-1]?.page_key,steps}}
 else if(s.members) config={items:(d.members??[]).map(m=>({member_plan:m.id,content_resource:m.mode==='asset'?{resource_type:'ASSET',asset_url:asset(m.asset)}:{resource_type:'BENEFIT_TABLE',resource_items:{columns:[{column_key:'benefit',title_i18n_key:i18n(`member.${m.id}.heading`,m.benefitHeading??'Benefits')},...m.columns.map(col=>({column_key:col.id,title_i18n_key:i18n(`member.${m.id}.column.${col.id}`,col.label)}))],rows:m.rows.map(row=>({benefit_key:row.id,benefit_i18n_key:i18n(`member.${m.id}.row.${row.id}`,row.label),values:Object.fromEntries(m.columns.map(col=>[col.id,typeof row.values[col.id]==='boolean'?(row.values[col.id]?'INCLUDED':'EXCLUDED'):{text_i18n_key:i18n(`member.${m.id}.row.${row.id}.value.${col.id}`,String(row.values[col.id]??''))}]))}))}},products:{subscribe_cycles_items:m.cycles.map(cycle=>({cycles:cycle.id,cycles_i18n_key:i18n(`member.${m.id}.cycle.${cycle.id}`,cycle.label),price_font_size:cycle.priceSize,price_font_color:cycle.priceColor,is_display_origin_price:cycle.original?1:0}))}}))}
 else if(s.lists?.includes('slides'))config={items:d.lists.slides.map(row=>({asset_url:asset(row.asset),title_i18n_key:i18n(`slides.${row.id}.label`,row.label),body_i18n_key:i18n(`slides.${row.id}.body`,row.body??'')}))}
 else if(s.section==='button')config={i18n_key:i18n('button',c.copy.button),animation:c.copy.animation==='breathe'?'BREATH':c.copy.animation==='shake'?'SHAKE':'STATIC'}
 else if(s.section==='post')config={brand:'Dino English',hero:d.assets.hero,title_i18n_key:i18n('title',c.copy.title),body_i18n_key:i18n('body',c.copy.body)}
 else if(s.section==='bg')config={asset_url:asset(d.assets.background)}
 else if(s.section==='account')config={hint_i18n_key:i18n('accountHint',d.texts.accountHint),action_i18n_key:i18n('accountAction',d.texts.accountAction),animation:d.settings.accountAnimation==='breathe'?'BREATH':d.settings.accountAnimation==='shake'?'SHAKE':'STATIC'}
 else if(s.section==='login'){const methods:Record<string,string>={google:'GOOGLE',apple:'APPLE',phone:'MOBILE',facebook:'FACEBOOK',kakao:'KAKAO'};config={animations:Object.fromEntries(Object.entries(d.settings).filter(([k])=>k.startsWith('animation_'))),main_methods:(d.settings.mainMethods as string[]).map(x=>methods[x]),sub_methods:(d.settings.subMethods as string[]).map(x=>methods[x])}}
 else if(s.section==='guide')config={visible:!!d.settings.showGuide,asset_url:d.settings.showGuide?asset(d.assets.guide):'',text_i18n_key:d.settings.showGuide?i18n('guide',d.texts.guide):'',text_tts_url:d.settings.showGuide?asset(d.assets.guideAudio):''}
 else if(s.lists?.includes('names'))config={names:d.lists.names.map(x=>x.label)}
 else if(s.lists?.includes('options'))config={...(s.node==='goal'?{selection_mode:d.settings.selectionMode}:{}),options:d.lists.options.map(x=>({option_value:x.id,option_i18n_key:i18n(`options.${x.id}.label`,x.label),...(s.node==='goal'?{icon_url:asset(x.asset)}:{})}))}
 else if(s.section==='offer')config={type:d.settings.offerMode==='hidden'?'HIDDEN':d.settings.offerMode==='asset'?'ASSET':'COUNTDOWN',...(s.node.startsWith('retention')?{countdown_title_i18n_key:d.settings.offerMode==='countdown'?i18n('offerTitle',d.texts.offerTitle):''}:{title_i18n_key:d.settings.offerMode==='countdown'?i18n('offerTitle',d.texts.offerTitle):''}),asset_url:d.settings.offerMode==='asset'?asset(d.assets.offer):''}
 else if(s.section==='products')config={...clone(d.settings),...(s.node.startsWith('paywall')?{promo_policy:'REPLACE_ELIGIBLE_KEEP_POSITION',discount_policy:'VISIBLE_ONLY_WITH_VALID_OFFER'}:{}),discount_label_i18n_key:d.texts.discountLabel?i18n('discountLabel',d.texts.discountLabel):''}
 else if(s.texts?.includes('badge'))config={i18n_key:i18n('badge',d.texts.badge)}
 else if(s.texts?.includes('placeholder'))config={i18n_key:i18n('placeholder',d.texts.placeholder)}
 else if(s.copy?.length===1)config={i18n_key:i18n(s.copy[0],c.copy[s.copy[0]])}
 else config={title_i18n_key:i18n('title',c.copy.title),body_i18n_key:i18n('body',c.copy.body)}
 return {config,dictionary,hidden_text_fields:Object.entries(contentTexts(c)).filter(([,value])=>value==='').map(([key])=>key),asset_policies:Object.fromEntries([...Object.entries(d.assets),...Object.values(d.lists).flatMap(xs=>xs.filter(x=>x.asset).map(x=>[x.id,x.asset!] as const))].map(([k,a])=>[k,a.mode]))}
}
