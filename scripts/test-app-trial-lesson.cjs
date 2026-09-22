const assert=require('node:assert/strict'),{mkdtempSync,rmSync}=require('node:fs'),{execFileSync}=require('node:child_process'),{resolve,join}=require('node:path'),{tmpdir}=require('node:os')
const dir=mkdtempSync(join(tmpdir(),'app-trial-lesson-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/appBusinessConfig.ts','--outDir',dir,'--module','commonjs','--moduleResolution','node','--target','ES2020','--skipLibCheck'],{stdio:'inherit'})
 const b=require(join(dir,'appBusinessConfig.js')),m=require(join(dir,'appConfigModel.js')),l=require(join(dir,'appTrialLessonConfig.js'))
 const key=l.TRIAL_LESSON_SLOT,v1='demo-trial-v1',v2='demo-trial-v2',actor='Test'
 let store={schema:3,definitions:[],versions:[],releases:[],experiments:[],audit:[]}
 const online=b.newOnline();online.name='Base course';online.audience.versions=[{operator:'>=',value:'1.9.0'}]
 const choose=(plan,id)=>{const c=structuredClone(b.effectiveContent(plan,key));c.details.settings.lessonVersionId=id;plan.contents[key]=c;}
 choose(online.plan,v2);store=b.publishOnline(store,online,actor)
 let base=b.workspace(store).online[0]
 assert.equal(b.effectiveContent(base.plan,key).details.settings.lessonVersionId,v2)
 assert(store.versions.some(v=>v.protocol?.config.lesson_version_id===v2))
 const exp=b.newExperiment(base);exp.value.name='Course test';exp.value.testPages=['lesson'];const [a,bb]=exp.value.groups
 assert.equal(exp.visual.plans[a.id].contents[key].details.settings.lessonVersionId,v2,'Copy resolved base version to each group')
 choose(exp.visual.plans[bb.id],v1);assert.equal(exp.visual.plans[a.id].contents[key].details.settings.lessonVersionId,v2,'Group edits must be isolated')
 assert.deepEqual(b.experimentErrors(store,exp.value,exp.visual),[])
 store=b.saveVisualExperiment(store,exp.value,exp.visual,actor,true);let saved=store.experiments[0]
 for(const g of saved.groups){assert.equal(g.bindings.length,1);assert.equal(store.definitions.find(d=>d.id===g.bindings[0].definitionId).slotId,key)}
 const frozen=JSON.stringify(saved.groups),history=JSON.stringify(b.workspace(store).history)
 const revised={...structuredClone(base),status:'DRAFT',replaceId:base.id};choose(revised.plan,v1);store=b.publishOnline(store,revised,actor)
 assert.equal(JSON.stringify(store.experiments[0].groups),frozen)
 assert.equal(b.workspace(store).experiments[saved.id].plans[a.id].contents[key].details.settings.lessonVersionId,v2)
 assert(JSON.stringify(b.workspace(store).history).includes('demo-trial-v2'));assert(history.includes('demo-trial-v2'))
 store=b.changeExperimentStatus(store,saved,'RUNNING',actor);saved=store.experiments[0]
 assert.throws(()=>b.saveVisualExperiment(store,exp.value,exp.visual,actor),/冻结/)
 const another=b.newExperiment(base);another.value.name='Other course';another.value.testPages=['lesson'];assert(b.experimentErrors(store,another.value,another.visual).some(x=>x.includes('重叠')))
 another.value.testPages=['paywall'];assert.deepEqual(b.experimentErrors(store,another.value,another.visual),[],'Different page experiments can run together')
 const invalid=b.newExperiment(base);invalid.value.name='Incompatible';invalid.value.testPages=['lesson'];invalid.value.audience.versions=[{operator:'>=',value:'1.8.0'},{operator:'<',value:'1.9.0'}]
 assert(b.experimentErrors({...store,experiments:[]},invalid.value,invalid.visual).some(x=>x.includes('不兼容')))
 assert.throws(()=>b.saveVisualExperiment({...store,experiments:[]},invalid.value,invalid.visual,actor,true),/不兼容/)
 const badOnline={...b.newOnline(),name:'Bad base'};choose(badOnline.plan,v2);assert.throws(()=>b.publishOnline({...store,releases:[]},badOnline,actor),/不兼容/)
 for(const id of ['', 'missing', 'demo-trial-retired']){choose(badOnline.plan,id);assert.throws(()=>b.publishOnline({...store,releases:[]},badOnline,actor),/已发布且可用/)}
 assert.deepEqual(l.trialLessonErrors(v2,{countries:['SA'],platforms:['Android'],versions:[{operator:'>',value:'1.8.99'}]}),['体验课 V2.0 要求 App ≥ 1.9.0，当前适用范围包含不兼容版本。请在第一步调整 App 版本条件，或选择兼容的体验课版本。'])
 assert.deepEqual(l.trialLessonErrors(v2,{countries:['SA'],platforms:['Android'],versions:[{operator:'=',value:'1.9.0'}]}),[])
 const oldBase=structuredClone(base);delete oldBase.plan.contents[key];const inherited=b.newExperiment(oldBase);assert.equal(inherited.visual.plans[inherited.value.groups[0].id].contents[key].details.settings.lessonVersionId,v1,'Legacy baseline is explicitly materialized in new draft')
 const latest=b.blankPlan(),group=b.blankPlan();choose(latest,v2);choose(group,v1);assert.equal(b.mergeTestedPlan(latest,group,['paywall']).contents[key].details.settings.lessonVersionId,v2);assert.equal(b.mergeTestedPlan(latest,group,['lesson']).contents[key].details.settings.lessonVersionId,v1)
 assert.equal(l.resolveTrialLessonVersion(v2,v1),v1);assert.equal(l.resolveTrialLessonVersion(v2),v2)
 const wire=m.serializeContent(m.getSlot(key),b.effectiveContent(group,key),'test');assert.equal(wire.config.lesson_version_id,v1);assert.equal(wire.config.in_progress_policy,'KEEP_EXISTING_COURSE');assert.deepEqual(wire.dictionary,{en:{}})
 console.log('Trial lesson checks passed: basic configuration, group isolation, exact version snapshots, availability, compatibility, scope conflicts, freeze, promotion and in-progress course policy.')
} finally {rmSync(dir,{recursive:true,force:true})}
