const assert = require('node:assert/strict')
const {mkdtempSync,rmSync}=require('node:fs')
const {execFileSync}=require('node:child_process')
const {resolve,join}=require('node:path')
const {tmpdir}=require('node:os')
const dir=mkdtempSync(join(tmpdir(),'app-business-'))
try {
 execFileSync(resolve('node_modules/.bin/tsc'),['src/appBusinessConfig.ts','--outDir',dir,'--module','commonjs','--moduleResolution','node','--target','ES2020','--skipLibCheck'],{stdio:'inherit'})
 const b=require(join(dir,'appBusinessConfig.js')),m=require(join(dir,'appConfigModel.js')),old=require(join(dir,'abTestConfig.js'))
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
 assert.throws(()=>b.publishOnline(s,badPage,'Editor'),/标题/)
 const historical=b.workspace(s).history.find(h=>h.action==='发布更新').snapshot
 assert.notEqual(historical.value.plan.contents['app.login.slideshow'].details.lists.slides[0].label,'Later online change','Historical snapshots remain immutable')
 console.log('APP business workflow checks passed')
} finally {rmSync(dir,{recursive:true,force:true})}
