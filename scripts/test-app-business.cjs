const assert = require('node:assert/strict')
const {mkdtempSync,rmSync}=require('node:fs')
const {execFileSync}=require('node:child_process')
const {resolve,join}=require('node:path')
const {tmpdir}=require('node:os')
const dir=mkdtempSync(join(tmpdir(),'app-business-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/appBusinessConfig.ts','--outDir',dir,'--module','commonjs','--moduleResolution','node','--target','ES2020','--skipLibCheck'],{stdio:'inherit'})
 const b=require(join(dir,'appBusinessConfig.js')),m=require(join(dir,'appConfigModel.js')),old=require(join(dir,'abTestConfig.js'))
 function translate(plan){for(const slot of b.planSlots(plan)){const c=plan.contents[slot.id];if(!c)continue;for(const [key,text]of m.changedTexts(slot,c)){for(const lang of m.translationLanguages){c.pageTranslations??={};c.pageTranslations[lang]??={};c.pageTranslations[lang][slot.node]??={};c.pageTranslations[lang][slot.node][key]=`${lang}: ${text}`;}c.translationSource={...c.translationSource,[key]:text};}}}
 let s=m.seedAppStore(),base=b.workspace(s).online[0]
 assert.equal(b.workspace(s).online.length,1,'Group existing page releases into one business plan')
 assert.equal(base.releaseIds.length,4)
 assert.deepEqual(b.planErrors(base.plan),[])
 const draft={...old.clone(base),name:'Updated online',status:'DRAFT',replaceId:base.id}
 const original=JSON.stringify(s)
 draft.plan.contents['app.login.slideshow'].details.lists.slides[0].label='Updated slide'
 s=b.saveOnlineDraft(s,draft,'Editor')
 assert.equal(s.releases.filter(r=>r.status==='ACTIVE').length,4,'Saving a draft must not affect live content')
 assert.notEqual(JSON.stringify(b.workspace(s).drafts[0].plan),JSON.stringify(base.plan))
 assert.deepEqual(JSON.parse(original).versions,s.versions,'Drafts must not publish implicit config versions')
 translate(draft.plan)
 s=b.publishOnline(s,draft,'Editor')
 base=b.workspace(s).online[0]
 assert.equal(b.workspace(s).drafts.length,0)
 assert.equal(base.name,'Updated online')
 assert.equal(base.releaseIds.length,b.planSlots(base.plan).length)
 const ex=b.newExperiment(base);ex.value.name='Test experiment'
 ex.visual.plans[ex.value.groups[1].id].contents['app.login.slideshow'].details.lists.slides[0].label='Group B'
 assert.notEqual(ex.visual.plans[ex.value.groups[0].id].contents['app.login.slideshow'].details.lists.slides[0].label,'Group B','Groups are independent')
 const bad=old.clone(ex);bad.value.groups[0].weight=4000
 assert(b.experimentErrors(s,bad.value,bad.visual).some(x=>x.includes('100%')))
 assert.throws(()=>b.saveVisualExperiment(s,bad.value,bad.visual,'Editor',true),/100%/)
 s=b.saveVisualExperiment(s,ex.value,ex.visual,'Editor',true)
 assert.equal(s.experiments[0].status,'READY')
 assert.equal(b.relatedTo(s,base).length,1)
 const fixed=JSON.stringify(s.experiments[0].groups)
 const expVersions=s.experiments[0].groups.flatMap(g=>g.bindings.map(x=>x.versionId))
 const before=s.versions.filter(v=>expVersions.includes(v.id))
 const edit={...old.clone(base),status:'DRAFT',replaceId:base.id}
 edit.plan.contents['app.login.slideshow'].details.lists.slides[0].label='Later online change'
 translate(edit.plan)
 s=b.publishOnline(s,edit,'Editor')
 assert.equal(JSON.stringify(s.experiments[0].groups),fixed,'Online updates cannot change fixed experiment bindings')
 assert.deepEqual(s.versions.filter(v=>expVersions.includes(v.id)),before)
 assert.throws(()=>b.saveVisualExperiment(s,ex.value,ex.visual,'Editor'),/冻结/)
 s=b.changeExperimentStatus(s,s.experiments[0],'RUNNING','Editor')
 assert.equal(s.experiments[0].status,'RUNNING')
 const competing=b.newExperiment(base);competing.value.name='Competing'
 assert(b.experimentErrors(s,competing.value,competing.visual).some(x=>x.includes('重叠')))
 const duplicate={...b.newOnline(),name:'Conflicting new plan'}
 const saved=JSON.stringify(s)
 assert.throws(()=>b.publishOnline(s,duplicate,'Editor'),/重叠/)
 assert.equal(JSON.stringify(s),saved,'Failed publication must not partially publish')
 const badPage=old.clone(edit);badPage.plan.contents['app.login.slideshow'].details.lists.slides[0].label=''
 assert.deepEqual(b.planErrors(badPage.plan),[],'Clearing a permitted title hides it')
 const historical=b.workspace(s).history.find(h=>h.action==='发布更新').snapshot
 assert.notEqual(historical.value.plan.contents['app.login.slideshow'].details.lists.slides[0].label,'Later online change','Historical snapshots remain immutable')
 // Version targeting is independent from the content compatibility floor.
 const range=(lower,upper)=>[{operator:'>=',value:lower},{operator:'<',value:upper}]
 let rangeStore={schema:3,definitions:[],versions:[],releases:[],experiments:[],audit:[]}
 const lower={...b.newOnline(),name:'1.8 range'};lower.audience.versions=range('1.8.0','1.9.0')
 const upper={...b.newOnline(),name:'1.9 range'};upper.audience.versions=range('1.9.0','2.0.0')
 rangeStore=b.publishOnline(rangeStore,lower,'Test');rangeStore=b.publishOnline(rangeStore,upper,'Test')
 assert.equal(b.workspace(rangeStore).online.length,2,'Disjoint version ranges may coexist in the same country/device')
 const released=b.workspace(rangeStore).online.find(p=>p.name==='1.9 range')
 assert.equal(released.minVersion,'1.8.0','Targeting a newer version must not raise the content compatibility floor')
 assert.deepEqual(released.audience.versions,upper.audience.versions)
 assert(rangeStore.releases.filter(r=>released.releaseIds.includes(r.id)).every(r=>JSON.stringify(r.audience.versions)===JSON.stringify(upper.audience.versions)))
 assert(b.resolvedOnline(rangeStore,released,'1.9.0'))
 assert.equal(b.resolvedOnline(rangeStore,released,'2.0.0'),undefined,'Exclusive upper bound must apply during resolution')
 assert.equal(b.resolvedOnline(rangeStore,released,'1.8.9'),undefined)
 const overlap={...b.newOnline(),name:'Overlapping'};overlap.audience.versions=range('1.8.9','1.9.1')
 const prior=JSON.stringify(rangeStore);assert.throws(()=>b.publishOnline(rangeStore,overlap,'Test'),/重叠/);assert.equal(JSON.stringify(rangeStore),prior)
 const eq={...b.newOnline(),name:'Exact 2.0'};eq.audience.versions=[{operator:'=',value:'2.0.0'}]
 rangeStore=b.publishOnline(rangeStore,eq,'Test')
 assert(b.resolvedOnline(rangeStore,b.workspace(rangeStore).online.find(p=>p.name==='Exact 2.0'),'2.0.0'))
 const conflict={...b.newOnline(),name:'Invalid'};conflict.audience.versions=range('1.9.0','1.8.0');assert(b.infoErrors(conflict).some(x=>x.includes('没有交集')))
 conflict.audience.versions=[{operator:'=',value:'1.7.0'}];assert(b.infoErrors(conflict).some(x=>x.includes('兼容要求')))
 conflict.audience.versions=[{operator:'>=',value:'1.8'}];assert(b.infoErrors(conflict).length)
 conflict.audience.versions=[];assert.deepEqual(m.audienceTarget(conflict.audience,conflict.minVersion).versions,[{operator:'>=',value:'1.8.0'}])
 assert.deepEqual(m.audienceTarget(m.audience(),'2.0.0').versions,[{operator:'>=',value:'2.0.0'}],'Legacy records retain their old minimum scope')
 const exLower=b.newExperiment(b.workspace(rangeStore).online.find(p=>p.name==='1.8 range'));exLower.value.name='Range A'
 rangeStore=b.saveVisualExperiment(rangeStore,exLower.value,exLower.visual,'Test',true)
 rangeStore=b.changeExperimentStatus(rangeStore,rangeStore.experiments[0],'RUNNING','Test')
 const exUpper=b.newExperiment(released);exUpper.value.name='Range B';assert.deepEqual(b.experimentErrors(rangeStore,exUpper.value,exUpper.visual),[])
 rangeStore=b.saveVisualExperiment(rangeStore,exUpper.value,exUpper.visual,'Test',true)
 rangeStore=b.changeExperimentStatus(rangeStore,rangeStore.experiments.find(e=>e.name==='Range B'),'RUNNING','Test')
 assert.equal(rangeStore.experiments.filter(e=>e.status==='RUNNING').length,2,'Experiments with disjoint version ranges may both run')
 const competingRange=b.newExperiment(released);competingRange.value.name='Overlapping experiment'
 assert(b.experimentErrors(rangeStore,competingRange.value,competingRange.visual).some(x=>x.includes('重叠')))
 assert.deepEqual(b.workspace(rangeStore).history.find(h=>h.snapshot.value.name==='Range B').snapshot.value.audience.versions,upper.audience.versions,'History retains the version conditions')
 console.log('APP business workflow checks passed')
} finally {rmSync(dir,{recursive:true,force:true})}
